#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""归档 DSH 写任务会话并删除桥接器创建的 worktree 工作区注册。"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dsh_rpc import archive_session, delete_workspace


def is_not_found(result):
    return isinstance(result, dict) and result.get("code") == "workspace/not-found"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace-id", required=True)
    parser.add_argument("--session-id", required=True)
    args = parser.parse_args()

    ok, result = archive_session(args.session_id)
    if not ok:
        raise RuntimeError(f"DSH 会话归档失败：{json.dumps(result, ensure_ascii=False)}")
    ok, result = delete_workspace(args.workspace_id)
    if not ok and not is_not_found(result):
        raise RuntimeError(f"DSH 任务工作区删除失败：{json.dumps(result, ensure_ascii=False)}")
    print(json.dumps({
        "archived": True,
        "workspaceDeleted": True,
        "workspaceId": args.workspace_id,
        "sessionId": args.session_id,
    }, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
