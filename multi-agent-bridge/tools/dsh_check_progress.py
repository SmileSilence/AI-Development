#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""检查 DSH 任务会话最新状态：是否完成、进展、写操作、异常。"""
import zstandard, json, os, datetime, sys
from collections import Counter

SID = "session-7882c85f-a529-44eb-8e10-90f1643e37d2"
P = os.path.join(r'C:\Users\19163\.dsh\sessions\--D-Work-AI-Development-AI_Plugins--', SID, 'session.v2.jsonl.zstd')

def fmt(ms):
    return datetime.datetime.fromtimestamp(ms/1000).strftime('%H:%M:%S') if ms else '?'

def read_rows():
    dctx = zstandard.ZstdDecompressor()
    with open(P, 'rb') as f:
        data = dctx.stream_reader(f).read()
    return [json.loads(l) for l in data.decode('utf-8', errors='replace').splitlines() if l.strip()]

if not os.path.exists(P):
    print("❌ 会话文件不存在:", P)
    sys.exit(1)

rows = read_rows()
mt = datetime.datetime.fromtimestamp(os.path.getmtime(P)).strftime('%H:%M:%S')
print(f"=== DSH 任务检查 ===")
print(f"会话: {SID}")
print(f"文件修改时间: {mt} | 记录数: {len(rows)} | 最后seq: {rows[-1].get('seq')}")

# 完成判定
types = Counter(r.get('type') for r in rows)
done = 'turn/end' in types
print(f"完成(turn/end): {'✅ 是' if done else '❌ 否'}")

# 工具调用统计
tools = Counter(r.get('data', {}).get('name') for r in rows if r.get('type') == 'tool/call')
print(f"工具调用: {dict(tools)}")

# 写操作
writes = [r for r in rows if r.get('type') == 'tool/call' and r.get('data', {}).get('name') in ('write', 'edit', 'str_replace', 'str_replace_editor')]
print(f"写/编辑操作数: {len(writes)}")
for w in writes[-6:]:
    print("  ", w.get('data', {}).get('name'), str(w.get('data', {}).get('arguments', ''))[:100])

# 最近助手文本
texts = []
for r in rows:
    if r.get('type') == 'assistant/message':
        t = [c.get('text', '') for c in r.get('data', {}).get('message', {}).get('content', [])
             if isinstance(c, dict) and c.get('type') == 'text' and c.get('text', '').strip()]
        if t:
            texts.append((r.get('seq'), ' '.join(t)))
print(f"\n=== 最近 3 条助手文本 ===")
for seq, t in texts[-3:]:
    print(f"[{seq}] {t[:300]}")

# 异常/重试
retries = [r for r in rows if 'retry' in r.get('type', '')]
print(f"\n重试/异常事件数: {len(retries)}")
for r in retries[-3:]:
    print("  ", r.get('type'), r.get('seq'))

# 最近活动（最后6条非纯事件）
print(f"\n=== 最后活动 ===")
for r in rows[-8:]:
    t = r.get('type'); d = r.get('data', {})
    ts = fmt(r.get('time'))
    if t == 'assistant/message':
        tt = [c.get('text', '')[:100] for c in d.get('message', {}).get('content', []) if isinstance(c, dict) and c.get('type') == 'text']
        if tt: print(f"[{r.get('seq')}] {ts} assistant: {' '.join(tt)[:130]}")
    elif t == 'tool/call':
        print(f"[{r.get('seq')}] {ts} 🛠 {d.get('name')}: {str(d.get('arguments', ''))[:90]}")
    elif t in ('step/start', 'step/end', 'turn/end', 'turn/start'):
        print(f"[{r.get('seq')}] {ts} {t}" + (f" step {d.get('step')}" if t == 'step/start' else ''))
