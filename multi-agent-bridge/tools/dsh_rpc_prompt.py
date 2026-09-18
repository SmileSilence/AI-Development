#!/usr/bin/env python3
"""把协调器的回调回复发送到既有 DSH 会话。"""

from __future__ import annotations

import argparse
import sys

from dsh_new_session import prompt_session


def main() -> int:
    parser = argparse.ArgumentParser(description="向既有 DSH 会话发送回调回复")
    parser.add_argument("--session", required=True, help="DSH 会话 ID")
    parser.add_argument("--text", required=True, help="回复内容")
    args = parser.parse_args()

    ok, result = prompt_session(args.session, args.text)
    if not ok:
        print(result, file=sys.stderr)
        return 1
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
