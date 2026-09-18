#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""通过 DSH 官方 RPC 创建实时可见且原子归属工作区的任务会话。"""
import argparse
import glob
import hashlib
import json
import os
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

try:
    import zstandard
except ImportError:
    print("需要 zstandard 库：pip install zstandard", file=sys.stderr)
    sys.exit(1)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dsh_rpc import create_workspace, rename_session, rename_workspace, verify_session_membership
from dsh_new_session import create_session, prompt_session

TITLE_LIMIT = 80


def normalize(path):
    return os.path.normcase(os.path.normpath(os.path.abspath(path)))


def readable_write_workspace_name(workspace_name, task_name):
    title = f"{workspace_name} · {task_name}"
    if len(title) <= TITLE_LIMIT:
        return title
    return title[:TITLE_LIMIT - 1].rstrip() + "…"


def ensure_workspace(path, requested_name, rename_existing=False, conflict_fallback=False):
    """通过当前 Gateway 幂等解析工作区，并按策略设置可读名称。"""
    ok, result = create_workspace(path)
    if not ok:
        raise RuntimeError(f"无法通过 DSH RPC 创建或复用工作区：{json.dumps(result, ensure_ascii=False)}")
    workspace = result.get("workspace", {}) if isinstance(result, dict) else {}
    workspace_id = workspace.get("workspaceId")
    if not workspace_id:
        raise RuntimeError(f"DSH RPC 未返回 workspaceId：{json.dumps(result, ensure_ascii=False)}")
    created = bool(result.get("created"))
    current_name = workspace.get("title") or requested_name
    final_name = current_name
    if created or rename_existing:
        final_name = rename_workspace_with_policy(
            workspace_id,
            current_name,
            requested_name,
            path,
            conflict_fallback,
        )
    return workspace_id, final_name, created


def rename_workspace_with_policy(
        workspace_id, current_name, requested_name, path, conflict_fallback):
    if current_name == requested_name:
        return current_name
    ok, result = rename_workspace(workspace_id, requested_name)
    if ok:
        return requested_name
    is_conflict = isinstance(result, dict) and result.get("code") == "workspace/name-conflict"
    if not is_conflict or not conflict_fallback:
        raise RuntimeError(f"DSH 工作区重命名失败：{json.dumps(result, ensure_ascii=False)}")
    digest = hashlib.sha256(normalize(path).encode("utf-8")).hexdigest()[:8]
    suffix = f" · {digest}"
    fallback = requested_name[:TITLE_LIMIT - len(suffix)].rstrip() + suffix
    ok, result = rename_workspace(workspace_id, fallback)
    if not ok:
        raise RuntimeError(f"DSH 工作区冲突名称回退失败：{json.dumps(result, ensure_ascii=False)}")
    return fallback


def read_rows(path):
    dctx = zstandard.ZstdDecompressor()
    with open(path, "rb") as handle:
        data = dctx.stream_reader(handle).read()
    rows = []
    for line in data.decode("utf-8", errors="replace").splitlines():
        if line.strip():
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows


def session_path(session_id):
    root = os.path.join(os.path.expanduser("~"), ".dsh", "sessions")
    matches = glob.glob(os.path.join(root, "**", session_id, "session.v*.jsonl.zstd"), recursive=True)
    if not matches:
        return None
    return max(matches, key=os.path.getmtime)


def text_from_message(row):
    message = row.get("data", {}).get("message", {})
    content = message.get("content", [])
    return "\n".join(
        item.get("text", "") for item in content
        if isinstance(item, dict) and item.get("type") == "text" and item.get("text", "").strip()
    ).strip()


def wait_for_result(session_id, timeout):
    deadline = time.time() + timeout
    latest_text = ""
    while time.time() < deadline:
        path = session_path(session_id)
        if path:
            rows = read_rows(path)
            for row in rows:
                if row.get("type") == "assistant/message":
                    latest_text = text_from_message(row) or latest_text
            if any(row.get("type") == "turn/end" for row in rows):
                if latest_text:
                    print(latest_text)
                    return
                raise RuntimeError("DSH 会话已结束，但没有返回文本。")
        time.sleep(1)
    raise TimeoutError(f"DSH 会话超过 {timeout} 秒仍未结束：{session_id}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--run-cwd", required=True)
    parser.add_argument("--workspace-name", required=True)
    parser.add_argument("--workspace-name-explicit", action="store_true")
    parser.add_argument("--task-name", required=True)
    parser.add_argument("--mode", choices=("analysis", "write"), required=True)
    parser.add_argument("--preset", default="standard")
    parser.add_argument("--timeout", type=int, required=True)
    parser.add_argument("--prompt", required=True)
    args = parser.parse_args()

    is_write = args.mode == "write"
    target_path = args.run_cwd if is_write else args.workspace
    target_kind = "worktree" if is_write else "logical"
    requested_name = (
        readable_write_workspace_name(args.workspace_name, args.task_name)
        if is_write else args.workspace_name
    )
    workspace_id, workspace_name, workspace_created = ensure_workspace(
        target_path,
        requested_name,
        rename_existing=is_write or args.workspace_name_explicit,
        conflict_fallback=is_write or not args.workspace_name_explicit,
    )
    ok, result = create_session(workspace_id=workspace_id, preset=args.preset)
    if not ok:
        raise RuntimeError(f"DSH RPC 创建会话失败：{json.dumps(result, ensure_ascii=False)}")
    session_id = result.get("sessionId")
    if not session_id:
        raise RuntimeError(f"DSH RPC 未返回 sessionId：{json.dumps(result, ensure_ascii=False)}")

    ok, membership = verify_session_membership(workspace_id, session_id)
    if not ok:
        raise RuntimeError(f"DSH 会话归属验证失败：{json.dumps(membership, ensure_ascii=False)}")
    projection = membership.get("workspace", {}) if isinstance(membership, dict) else {}
    if session_id not in projection.get("sessionIds", []):
        raise RuntimeError(f"DSH 工作区投影未包含新会话：{session_id}")

    ok, result = rename_session(session_id, args.task_name)
    if not ok:
        raise RuntimeError(f"DSH 会话重命名失败：{json.dumps(result, ensure_ascii=False)}")
    print("MAB_DSH_SESSION:" + json.dumps({
        "workspaceId": workspace_id,
        "workspaceName": workspace_name,
        "workspacePath": target_path,
        "workspaceKind": target_kind,
        "workspaceCreated": workspace_created,
        "sessionId": session_id,
        "sessionName": args.task_name,
    }, ensure_ascii=False), flush=True)
    ok, result = prompt_session(session_id, args.prompt)
    if not ok:
        raise RuntimeError(f"DSH RPC 发送任务失败：{json.dumps(result, ensure_ascii=False)}")
    wait_for_result(session_id, args.timeout)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
