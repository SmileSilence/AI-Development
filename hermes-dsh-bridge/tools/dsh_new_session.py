#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DSH 正常流程工具：像用户操作桌面端一样，通过官方 RPC 创建会话 → 发任务 → 执行。
创建出的会话带模式（agentPreset）、挂到工作区，桌面端实时可见（无需重启）。

用法：
  python dsh_new_session.py create --workspace <wid> [--preset standard]
      # 创建会话，返回 sessionId（带模式，已挂到工作区）
  python dsh_new_session.py prompt --session <sid> --text "任务内容"
      # 向会话发任务消息（异步，返回 accepted）
  python dsh_new_session.py run --workspace <wid> --preset standard --text "任务内容"
      # 完整流程：创建 + 发任务（推荐）
"""
import os, sys, json, time, uuid, argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dsh_rpc import unary

PRESETS = ("standard", "ptc", "minimal", "cordis")

def create_session(workspace_id=None, cwd=None, preset="standard", session_id=None):
    """创建会话。返回 (ok, {sessionId, agentPreset} 或 error)"""
    req = {}
    if session_id:
        req["sessionId"] = session_id
    if workspace_id:
        req["workspaceId"] = workspace_id
    elif cwd:
        req["cwd"] = cwd
    if preset:
        req["agentPreset"] = preset
    return unary("session/create", {"request": req})

def prompt_session(session_id, text, request_id=None):
    """向会话发任务。content 是 text part 数组。mode=queue（排队执行）。返回 (ok, {accepted})"""
    req = {
        "sessionId": session_id,
        "requestId": request_id or f"rpc-{uuid.uuid4().hex[:12]}",
        "mode": "queue",
        "content": [{"type": "text", "text": text}],
    }
    return unary("session/prompt", {"request": req})

def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("create")
    p.add_argument("--workspace", default=None)
    p.add_argument("--cwd", default=None)
    p.add_argument("--preset", default="standard", choices=PRESETS)
    p.add_argument("--session", default=None)

    p = sub.add_parser("prompt")
    p.add_argument("--session", required=True)
    p.add_argument("--text", required=True)

    p = sub.add_parser("run")
    p.add_argument("--workspace", default=None)
    p.add_argument("--cwd", default=None)
    p.add_argument("--preset", default="standard", choices=PRESETS)
    p.add_argument("--text", required=True)

    args = ap.parse_args()

    if args.cmd == "create":
        ok, res = create_session(args.workspace, args.cwd, args.preset, args.session)
        print("create:", "✅ 成功" if ok else "❌ 失败")
        print(json.dumps(res, ensure_ascii=False, indent=2))
    elif args.cmd == "prompt":
        ok, res = prompt_session(args.session, args.text)
        print("prompt:", "✅ 已发送" if ok else "❌ 失败")
        print(json.dumps(res, ensure_ascii=False, indent=2))
    elif args.cmd == "run":
        ok, res = create_session(args.workspace, args.cwd, args.preset)
        if not ok:
            print("创建会话失败:", json.dumps(res, ensure_ascii=False))
            sys.exit(1)
        sid = res.get("sessionId")
        print(f"✅ 会话已创建: {sid} (preset={res.get('agentPreset','?')})")
        ok2, res2 = prompt_session(sid, args.text)
        print("✅ 任务已发送" if ok2 else f"❌ 任务发送失败: {json.dumps(res2, ensure_ascii=False)}")
        print(f"会话ID: {sid}")

if __name__ == "__main__":
    main()
