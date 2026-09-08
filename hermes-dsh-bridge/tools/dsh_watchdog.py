#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DSH 监管器（watchdog）：检测 DSH 后端重启导致的连接中断，
自动等待恢复 → 找到被中断的运行中会话 → 发送"继续"恢复执行。

原理：
- 通过 3080 的 RPC（自签 cookie）轮询 session/list 检测连通性
- 连接失败 = 后端重启/挂了；持续重试直到恢复
- 恢复后扫描 ~/.dsh/sessions/ 下所有会话，找"最后不是 turn/end"的
  （= 运行中被重启打断的会话）
- 对这些会话发 session/prompt "继续执行"（resolveAgent 会自动 resume）

用法：
  python dsh_watchdog.py [--check-interval 5] [--max-detect 30] [--continue-text "继续执行"]
"""
import os, sys, json, time, glob, argparse, datetime, subprocess

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dsh_rpc import unary, list_sessions

DSH_SESSIONS = os.path.join(os.path.expanduser("~"), ".dsh", "sessions")
DEFAULT_CONTINUE = "（自动恢复）刚才后端重启打断了执行，请继续完成你正在进行的任务。"

def rpc_alive():
    """RPC 是否可用（3080 通 + 认证有效）"""
    ok, _ = list_sessions()
    return ok

def find_interrupted_sessions():
    """扫描会话文件，找最后一条不是 turn/end 的会话（被中断）"""
    interrupted = []
    import zstandard
    for root, dirs, files in os.walk(DSH_SESSIONS):
        for f in files:
            if not f.endswith('.zstd'):
                continue
            p = os.path.join(root, f)
            sid = os.path.basename(root)
            try:
                dctx = zstandard.ZstdDecompressor()
                with open(p, 'rb') as fh:
                    data = dctx.stream_reader(fh).read()
                rows = [json.loads(l) for l in data.decode('utf-8', errors='replace').splitlines() if l.strip()]
                if not rows:
                    continue
                # 会话 header 的 cwd（判断它是不是真会话）
                header = rows[0] if rows[0].get('type') == 'session' else None
                last = rows[-1].get('type')
                # 被中断判定：turn/start 与 turn/end 数量不等（存在未完成 turn），
                # 或最后一个 turn 未闭合。正常会话无论结尾是 turn/end 还是
                # session/end-seed，其 turn/start 和 turn/end 都成对。
                types = [r.get('type') for r in rows]
                turns_started = types.count('turn/start')
                turns_ended = types.count('turn/end')
                has_activity = any(t in ('user/message', 'assistant/message', 'turn/start') for t in types)
                # 会话是否还在跑（有 turn 但未结束 = 被中断）
                interrupted_turn = turns_started > turns_ended
                # 或者：最后不是结束标记（turn/end 或 session/end-seed）
                last_type = rows[-1].get('type')
                not_clean_end = last_type not in ('turn/end', 'session/end-seed')
                if has_activity and (interrupted_turn or (not_clean_end and turns_started > 0)):
                    interrupted.append({
                        'sid': sid,
                        'path': p,
                        'last': last_type,
                        'turns': f'{turns_ended}/{turns_started}',
                        'cwd': header.get('cwd') if header else None,
                        'mtime': datetime.datetime.fromtimestamp(os.path.getmtime(p)).strftime('%H:%M:%S'),
                    })
            except Exception:
                continue
    return interrupted

def continue_session(sid, text):
    """给会话发继续（resolveAgent 自动 resume）"""
    return unary('session/prompt', {
        'request': {
            'sessionId': sid,
            'requestId': f'watchdog-{int(time.time())}',
            'mode': 'queue',
            'content': [{'type': 'text', 'text': text}],
        }
    })

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check-interval', type=int, default=5, help='连通性检查间隔秒')
    ap.add_argument('--max-fail', type=int, default=3, help='连续失败几次判定为重启')
    ap.add_argument('--continue-text', default=DEFAULT_CONTINUE, help='发送给被中断会话的继续指令')
    ap.add_argument('--once', action='store_true', help='只检测一次并恢复，不持续监听')
    args = ap.parse_args()

    print(f"=== DSH 监管器启动 ===")
    print(f"检查间隔: {args.check_interval}s | 连续失败阈值: {args.max_fail} | 持续: {'否(单次)' if args.once else '是'}")
    print(f"监控会话目录: {DSH_SESSIONS}")

    fail_count = 0
    while True:
        if rpc_alive():
            if fail_count >= args.max_fail:
                # 刚从故障恢复 → 检查被中断会话并继续
                print(f"\n[{datetime.datetime.now().strftime('%H:%M:%S')}] ✅ RPC 已恢复（之前连续失败 {fail_count} 次）")
                interrupted = find_interrupted_sessions()
                if interrupted:
                    print(f"找到 {len(interrupted)} 个被中断的会话：")
                    for it in interrupted:
                        print(f"  - {it['sid']}  cwd={it['cwd']}  最后={it['last']}  修改={it['mtime']}")
                        ok, res = continue_session(it['sid'], args.continue_text)
                        print(f"    发送继续: {'✅' if ok else '❌'} {json.dumps(res, ensure_ascii=False)[:120] if not ok else ''}")
                else:
                    print("未找到被中断的会话（都正常结束或为空）")
                fail_count = 0
                if args.once:
                    break
            else:
                # 正常状态，静默
                pass
        else:
            fail_count += 1
            if fail_count == args.max_fail:
                print(f"\n[{datetime.datetime.now().strftime('%H:%M:%S')}] ⚠️ RPC 连接失败（连续 {fail_count} 次）→ 检测到后端重启/中断，开始等待恢复...")
            elif fail_count > args.max_fail:
                print(f"  ...仍不可用（{fail_count - args.max_fail}s 已过）", end='\r')
        time.sleep(args.check_interval)

if __name__ == '__main__':
    main()
