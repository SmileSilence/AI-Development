#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DSH 实时 RPC 客户端：通过自签 cookie 调用桌面端 gateway (3080) 的 Typert Remote 方法。
让 headless 会话创建后**实时**挂到工作区，DSH 桌面窗口无需重启即可看到新会话。

协议（已逆向确认）：
- 认证: 自签 HMAC cookie（secret 来自 ~/.dsh/.credentials.yaml）
- unary 调用: POST http://127.0.0.1:3080/api/<endpoint>
    body: {"type":"client-request","rpcId":"<uuid>","method":"<endpoint>","payload":{"args":{...}}}
    响应: {"type":"server-response","rpcId":"...","result":{"ok":true,"value":...}}
- stream 调用: WebSocket ws://127.0.0.1:3080/api/remote.mux
    send: {"type":"open","streamId":"...","endpoint":"<ep>","payload":{"args":{...}}}

用法：
  python dsh_rpc.py list-sessions
  python dsh_rpc.py list-workspaces
  python dsh_rpc.py attach-session --workspace <wid> --session <sid>
  python dsh_rpc.py create-workspace --path <绝对路径>
"""
import os, sys, json, time, argparse, uuid, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dsh_cookie import make_cookie, load_secret

BASE = "http://127.0.0.1:3080"
WS_URL = "ws://127.0.0.1:3080/api/remote.mux"

def cookie_header():
    secret = load_secret()
    name, value, _ = make_cookie("127.0.0.1:3080", secret)
    return f"{name}={value}"

def unary(endpoint, args, timeout=15):
    """unary RPC: POST /api/<endpoint>"""
    body = json.dumps({
        "type": "client-request",
        "rpcId": uuid.uuid4().hex,
        "method": endpoint,
        "payload": {"args": args},
    }).encode()
    req = urllib.request.Request(
        f"{BASE}/api/{endpoint}", data=body,
        headers={
            "Host": "127.0.0.1:3080",
            "Cookie": cookie_header(),
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        return False, {"transport_error": str(e)}
    result = data.get("result", {})
    if result.get("ok") is True:
        return True, result.get("value")
    return False, result.get("error")

def list_sessions():
    ok, val = unary("session/list", {"_request": {}})
    if not ok:
        return ok, val
    items = val.get("items", [])
    return True, [{
        "id": it.get("sessionId"),
        "cwd": it.get("cwd"),
        "title": (it.get("projections") or {}).get("values", {}).get("title", ""),
        "updated": it.get("updatedAt"),
    } for it in items]

def list_workspaces():
    ok, val = unary("workspace/list", {"_request": {}}) if False else (None, None)
    # workspace/list 不是 unary 端点，改走 storage 读
    return False, "workspace/list 非 unary；从 workspace.json 读"

def attach_session(workspace_id, session_id):
    return unary("workspace/insertSessionBefore", {
        "request": {"workspaceId": workspace_id, "sessionId": session_id}
    })

def create_workspace(path):
    return unary("workspace/create", {"request": {"path": path}})

def list_workspaces_from_storage():
    """读 workspace.json 列出工作区（workspace/list 不是 unary 端点）"""
    import os
    p = os.path.join(os.path.expanduser("~"), ".dsh", "storages", "workspace.json")
    with open(p, "r", encoding="utf-8") as f:
        d = json.load(f)
    out = []
    for wid, w in d.get("tables", {}).get("workspaces", {}).items():
        out.append({"workspaceId": wid, "path": w.get("path"), "title": w.get("title"),
                    "sessions": len(w.get("sessionIds", []))})
    out.sort(key=lambda x: x.get("path") or "")
    return True, out

def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("list-sessions")
    p = sub.add_parser("attach-session")
    p.add_argument("--workspace", required=True)
    p.add_argument("--session", required=True)
    p = sub.add_parser("create-workspace")
    p.add_argument("--path", required=True)
    args = ap.parse_args()

    if args.cmd == "list-sessions":
        ok, res = list_sessions()
        if ok:
            for s in sorted(res, key=lambda x: -(x["updated"] or 0)):
                t = s["title"] or ""
                print(f"  {s['id']}  cwd={s['cwd']}  title={t[:40]}")
        else:
            print("失败:", json.dumps(res, ensure_ascii=False))
    elif args.cmd == "attach-session":
        ok, res = attach_session(args.workspace, args.session)
        print("attach:", "✅ 成功" if ok else "❌ 失败")
        if ok and isinstance(res, dict) and "workspace" in res:
            w = res["workspace"]
            print(f"  工作区 {w['title']} ({w['workspaceId']})")
            print(f"  sessionIds: {w['sessionIds']}")
        else:
            print(json.dumps(res, ensure_ascii=False))
    elif args.cmd == "create-workspace":
        ok, res = create_workspace(args.path)
        print("create:", "✅ 成功" if ok else "❌ 失败")
        print(json.dumps(res, ensure_ascii=False))

if __name__ == "__main__":
    main()
