#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
导出 Hermes 会话，供 DSH / Codex / Claude 读取。
Hermes 会话存在 SQLite C:\Users\19163\AppData\Local\hermes\state.db

用法：
  python export-hermes-sessions.py                          # 导出最近会话到 stdout（JSONL）
  python export-hermes-sessions.py --out <file>             # 导出到文件
  python export-hermes-sessions.py --session <id>           # 指定会话
  python export-hermes-sessions.py --limit 5                # 最近 N 个会话
"""
import os, sys, json, sqlite3, argparse, datetime

HERMES_DB = os.path.join(os.path.expanduser("~"), "AppData", "Local", "hermes", "state.db")

def fmt_time(ts):
    try:
        return datetime.datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return str(ts)

def export_session(con, sid, out):
    """导出单个会话为 JSONL"""
    sess = con.execute(
        "SELECT id, title, model, cwd, started_at, last_activity_at, message_count FROM sessions WHERE id=?", (sid,)
    ).fetchone()
    if not sess:
        return None
    meta = {
        "type": "hermes/session",
        "id": sess[0], "title": sess[1], "model": sess[2], "cwd": sess[3],
        "started_at": fmt_time(sess[4]), "last_activity_at": fmt_time(sess[5]),
        "message_count": sess[6],
    }
    out.append(json.dumps(meta, ensure_ascii=False))
    msgs = con.execute(
        "SELECT role, content, tool_name, timestamp FROM messages "
        "WHERE session_id=? AND role IN ('user','assistant') AND active=1 "
        "ORDER BY timestamp", (sid,)
    ).fetchall()
    for role, content, tool_name, ts in msgs:
        if not content:
            continue
        rec = {"type": "hermes/message", "role": role, "time": fmt_time(ts), "tool": tool_name,
               "content": content[:4000]}
        out.append(json.dumps(rec, ensure_ascii=False))
    return meta

def main():
    ap = argparse.ArgumentParser(description="导出 Hermes 会话给其他代理读")
    ap.add_argument("--out", help="输出文件（默认 stdout）")
    ap.add_argument("--session", help="指定会话 ID")
    ap.add_argument("--limit", type=int, default=3, help="导出最近 N 个会话")
    args = ap.parse_args()

    if not os.path.exists(HERMES_DB):
        print("找不到 Hermes 数据库: %s" % HERMES_DB, file=sys.stderr)
        sys.exit(1)

    con = sqlite3.connect(HERMES_DB)
    out = []
    if args.session:
        export_session(con, args.session, out)
    else:
        sessions = con.execute(
            "SELECT id FROM sessions ORDER BY last_activity_at DESC LIMIT ?", (args.limit,)
        ).fetchall()
        for (sid,) in sessions:
            export_session(con, sid, out)

    payload = "\n".join(out)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(payload + "\n")
        print("已导出 %d 条记录到 %s" % (len(out), args.out), file=sys.stderr)
    else:
        print(payload)

if __name__ == "__main__":
    main()
