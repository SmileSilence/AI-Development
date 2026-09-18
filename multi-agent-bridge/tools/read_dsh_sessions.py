#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
读取 DSH 会话记录（zstd 压缩的 JSONL）。
DSH 会话位于 ~/.dsh/sessions/<项目路径编码>/<session-id>/session.v2.jsonl.zstd

用法：
  python read_dsh_sessions.py                 # 列出所有会话
  python read_dsh_sessions.py --latest        # 读最近的会话（按修改时间）
  python read_dsh_sessions.py --session <id> # 按 ID 读
  python read_dsh_sessions.py --limit 30     # 限制显示条数
  python read_dsh_sessions.py --human        # 只显示人类可读的对话（默认显示全部结构化）
"""
import os, sys, json, glob, argparse, time, datetime

try:
    import zstandard
except ImportError:
    print("需要 zstandard 库：pip install zstandard", file=sys.stderr)
    sys.exit(1)

DSH_SESSIONS = os.path.join(os.path.expanduser("~"), ".dsh", "sessions")

def list_sessions():
    """返回所有会话文件 [(path, mtime, size)]"""
    out = []
    for root, dirs, files in os.walk(DSH_SESSIONS):
        for f in files:
            if f.endswith(".zstd") or f.endswith(".jsonl.zstd"):
                p = os.path.join(root, f)
                st = os.stat(p)
                out.append((p, st.st_mtime, st.st_size))
    out.sort(key=lambda x: -x[1])
    return out

def read_session(path):
    """解压并解析 DSH 会话文件，返回行对象列表"""
    dctx = zstandard.ZstdDecompressor()
    with open(path, "rb") as fh:
        data = dctx.stream_reader(fh).read()
    rows = []
    for line in data.decode("utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            rows.append({"type": "raw", "data": line[:200]})
    return rows

def fmt_time(ms):
    """毫秒时间戳 → 可读时间"""
    try:
        return datetime.datetime.fromtimestamp(ms/1000).strftime("%H:%M:%S")
    except Exception:
        return str(ms)

def content_text(content):
    """从 content 数组提取纯文本"""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for c in content:
            if isinstance(c, dict):
                if c.get("type") == "text":
                    parts.append(c.get("text", ""))
                elif c.get("type") == "reasoning":
                    parts.append(f"[推理] {c.get('text','')[:200]}")
                elif c.get("type") == "tool_use":
                    parts.append(f"[工具] {c.get('name','')} {json.dumps(c.get('input',{}), ensure_ascii=False)[:200]}")
            elif isinstance(c, str):
                parts.append(c)
        return "\n".join(p for p in parts if p)
    return str(content)

def human_view(rows, limit=50):
    """提取对话主线：user/assistant 消息"""
    lines = []
    count = 0
    for r in rows:
        t = r.get("type")
        if t == "session":
            lines.append(f"## 会话 {r.get('id')}  cwd={r.get('cwd')}  created={fmt_time(r.get('createdAt',0))}")
        elif t == "user/message":
            d = r.get("data", {})
            txt = content_text(d.get("content"))
            lines.append(f"\n[用户 {fmt_time(r.get('time',0))}] {txt}")
        elif t == "assistant/message":
            d = r.get("data", {})
            msg = d.get("message", {})
            txt = content_text(msg.get("content"))
            if txt:
                lines.append(f"\n[助手 {fmt_time(r.get('time',0))}] {txt[:800]}")
            count += 1
        elif t == "tool/call":
            d = r.get("data", {})
            lines.append(f"\n  🛠 [{d.get('name','')}] {json.dumps(d.get('input',{}), ensure_ascii=False)[:150]}")
        elif t == "tool/result":
            d = r.get("data", {})
            out = d.get("output", "")
            if isinstance(out, dict):
                out = json.dumps(out, ensure_ascii=False)
            lines.append(f"  ⬅ 结果: {str(out)[:200]}")
        elif t in ("session/title",):
            d = r.get("data", {})
            lines.append(f"# 📌 {d.get('title','')}")
        if count >= limit:
            break
    return "\n".join(lines)

def main():
    ap = argparse.ArgumentParser(description="读 DSH 会话")
    ap.add_argument("--latest", action="store_true", help="读最近的会话")
    ap.add_argument("--session", help="会话 ID 或路径片段")
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--human", action="store_true", help="只显示对话主线")
    ap.add_argument("--json", action="store_true", help="输出原始 JSON 行")
    args = ap.parse_args()

    sessions = list_sessions()
    if not sessions:
        print("未找到 DSH 会话", file=sys.stderr)
        sys.exit(1)

    if args.session:
        matches = [s for s in sessions if args.session in s[0]]
        if not matches:
            print(f"未找到含 '{args.session}' 的会话", file=sys.stderr)
            sys.exit(1)
        target = matches[0]
    elif args.latest:
        target = sessions[0]
    else:
        # 列出所有
        for i, (p, mt, sz) in enumerate(sessions):
            rel = p.replace(DSH_SESSIONS, "").strip(os.sep)
            print(f"[{i}] {time.strftime('%m-%d %H:%M', time.localtime(mt))} {sz//1024}KB {rel[:90]}")
        idx = input("选择序号: ") if sys.stdin.isatty() else "0"
        idx = idx.strip() if idx.strip() else "0"
        target = sessions[int(idx)]

    path = target[0]
    print(f"# 读取: {path.replace(DSH_SESSIONS, '~/.dsh/sessions')}", file=sys.stderr)
    rows = read_session(path)
    if args.json:
        for r in rows:
            print(json.dumps(r, ensure_ascii=False))
    else:
        print(human_view(rows, args.limit))

if __name__ == "__main__":
    main()
