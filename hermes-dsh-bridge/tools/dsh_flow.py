#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DSH 任务正确流程工具：1.选择/添加工作区 → 2.选择模式 → 3.输入任务 → 4.发出执行
走 DSH 官方 RPC，会话带模式并实时出现在桌面端窗口（无需重启）。

用法：
  python dsh_flow.py list-workspaces          # 列出工作区
  python dsh_flow.py add-workspace --path <绝对路径>   # 添加工作区
  python dsh_flow.py run --workspace <wid> --preset standard --text "任务"
      # 完整流程：创建带模式会话→发任务→返回 sessionId
  python dsh_flow.py interactive              # 交互式向导（推荐）
"""
import os, sys, json, uuid, argparse, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dsh_rpc import unary, list_workspaces_from_storage

PRESETS = ("standard", "ptc", "minimal", "cordis")
PRESET_NAMES = {"standard": "标准", "ptc": "PTC", "minimal": "极简", "cordis": "创造"}

def create_session(workspace_id=None, cwd=None, preset="standard", session_id=None):
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
    req = {
        "sessionId": session_id,
        "requestId": request_id or f"rpc-{uuid.uuid4().hex[:12]}",
        "mode": "queue",
        "content": [{"type": "text", "text": text}],
    }
    return unary("session/prompt", {"request": req})

def add_workspace(path):
    return unary("workspace/create", {"request": {"path": path}})

def cmd_list_workspaces():
    ok, res = list_workspaces_from_storage()
    if not ok:
        print("失败:", res)
        return
    for i, w in enumerate(res):
        print(f"[{i}] {w['title'] or w['path']}  ({w['path']})  sessions={w['sessions']}  id={w['workspaceId']}")

def cmd_add_workspace(path):
    ok, res = add_workspace(path)
    if ok:
        w = res.get("workspace", {})
        print(f"✅ 工作区已添加: {w.get('title')}  id={w.get('workspaceId')}")
    else:
        print("❌ 失败:", json.dumps(res, ensure_ascii=False))

def cmd_run(workspace_id, preset, text):
    # 步骤3: 创建带模式的会话（自动挂到工作区）
    ok, res = create_session(workspace_id=workspace_id, preset=preset)
    if not ok:
        print("❌ 创建会话失败:", json.dumps(res, ensure_ascii=False))
        sys.exit(1)
    sid = res.get("sessionId")
    print(f"✅ 会话已创建: {sid}  模式={res.get('agentPreset','?')}")
    # 步骤4: 发出任务
    ok2, res2 = prompt_session(sid, text)
    if not ok2:
        print("❌ 任务发送失败:", json.dumps(res2, ensure_ascii=False))
        sys.exit(1)
    print(f"✅ 任务已发出，DSH 开始执行。会话: {sid}")
    return sid

def cmd_interactive():
    print("=== DSH 任务创建（正确流程）===")
    # 步骤1: 选择/添加工作区
    ok, ws = list_workspaces_from_storage()
    if ok and ws:
        print("\n[1/4] 选择工作区:")
        for i, w in enumerate(ws):
            print(f"  [{i}] {w['title'] or w['path']}  ({w['path']})")
        print(f"  [n] 新建工作区")
        choice = input("  选择 (0-{} 或 n): ".format(len(ws)-1)).strip()
        if choice.lower() == "n":
            path = input("  新工作区路径: ").strip()
            ok2, r2 = add_workspace(path)
            if not ok2:
                print("❌ 添加失败:", r2); sys.exit(1)
            wid = r2.get("workspace", {}).get("workspaceId")
            print(f"  ✅ 已添加: {wid}")
        else:
            try:
                wid = ws[int(choice)]["workspaceId"]
            except (ValueError, IndexError):
                print("❌ 无效选择"); sys.exit(1)
    else:
        print("\n[1/4] 没有工作区，请先添加:")
        path = input("  工作区路径: ").strip()
        ok2, r2 = add_workspace(path)
        if not ok2:
            print("❌ 添加失败:", r2); sys.exit(1)
        wid = r2.get("workspace", {}).get("workspaceId")
        print(f"  ✅ 已添加: {wid}")
    # 步骤2: 选择模式
    print("\n[2/4] 选择任务模式:")
    for i, p in enumerate(PRESETS):
        print(f"  [{i}] {PRESET_NAMES[p]} ({p})")
    pchoice = input(f"  选择 (0-{len(PRESETS)-1}, 默认0标准): ").strip()
    try:
        preset = PRESETS[int(pchoice)] if pchoice else "standard"
    except (ValueError, IndexError):
        preset = "standard"
    # 步骤3: 输入任务
    print(f"\n[3/4] 输入任务（模式: {PRESET_NAMES[preset]}）:")
    text = input("  > ").strip()
    if not text:
        print("❌ 任务不能为空"); sys.exit(1)
    # 步骤4: 发出
    print(f"\n[4/4] 发出任务到 DSH...")
    cmd_run(wid, preset, text)

def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list-workspaces")
    p = sub.add_parser("add-workspace"); p.add_argument("--path", required=True)
    p = sub.add_parser("run")
    p.add_argument("--workspace", required=True)
    p.add_argument("--preset", default="standard", choices=PRESETS)
    p.add_argument("--text", required=True)
    sub.add_parser("interactive")
    args = ap.parse_args()

    if args.cmd == "list-workspaces": cmd_list_workspaces()
    elif args.cmd == "add-workspace": cmd_add_workspace(args.path)
    elif args.cmd == "run": cmd_run(args.workspace, args.preset, args.text)
    elif args.cmd == "interactive": cmd_interactive()

if __name__ == "__main__":
    main()
