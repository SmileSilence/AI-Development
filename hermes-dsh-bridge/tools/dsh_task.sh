#!/usr/bin/env bash
# DSH 正常流程任务工具：像用户操作桌面端一样，
# 通过官方 RPC 创建带模式的会话 → 发任务 → 等待执行 → 返回结果。
# 创建出的会话天生带 agentPreset，挂到工作区，桌面端实时可见（无需重启）。
#
# 用法:
#   ./dsh_task.sh "任务内容" [模式] [工作区ID]
#   模式: standard(标准) | ptc | minimal(极简) | cordis(创造)  默认 standard
#   工作区ID 默认: e0f71147... (hermes-dsh-bridge)
set -euo pipefail

BRIDGE="D:/Work/AI-Development/hermes-dsh-bridge"
PY="/c/Users/19163/AppData/Local/Microsoft/WindowsApps/python3"
TASK="${1:?用法: dsh_task.sh \"任务\" [模式] [工作区ID]}"
PRESET="${2:-standard}"
WS_ID="${3:-e0f71147-b38e-4a70-a266-b23d739da180}"
POLL_MAX=60   # 最多轮询次数
POLL_INT=5    # 轮询间隔秒

# 插件型任务自动开启后端监管：任务文本含插件/DSH 配置关键词，或工作区指向 AI_Plugins。
# 任务结束（含异常退出）由 trap 自动关闭。
if { echo "$TASK"; echo "$WS_ID"; } | grep -qiE "AI_Plugins|plugin|插件|\.dsh|profiles/web|deepseek-harness|package\.json|5cb342c8"; then
  SUP_FLAG="/d/Work/AI-Development/hermes-dsh-bridge/logs/supervisor-active.flag"
  mkdir -p "$(dirname "$SUP_FLAG")"
  touch "$SUP_FLAG"
  trap 'rm -f "$SUP_FLAG"' EXIT
  echo "🛡️ 插件型任务：后端监管已开启" >&2
fi

echo "=== DSH 正常流程任务 ===" >&2
echo "任务: ${TASK:0:60}..." >&2
echo "模式: $PRESET | 工作区: $WS_ID" >&2

# 1. 创建带模式的会话（官方 RPC，自动挂到工作区）
echo "--- 1. 创建会话 ---" >&2
CREATE_OUTPUT=$("$PY" "$BRIDGE/tools/dsh_new_session.py" create --workspace "$WS_ID" --preset "$PRESET" 2>&1)
SID=$(echo "$CREATE_OUTPUT" | grep -oE 'session-[a-f0-9-]+' | head -1)
if [ -z "$SID" ]; then
  echo "❌ 创建会话失败:" >&2; echo "$CREATE_OUTPUT" >&2; exit 1
fi
echo "✅ 会话: $SID (模式=$PRESET)" >&2

# 2. 发任务
echo "--- 2. 发送任务 ---" >&2
PROMPT_OUTPUT=$("$PY" "$BRIDGE/tools/dsh_new_session.py" prompt --session "$SID" --text "$TASK" 2>&1)
if ! echo "$PROMPT_OUTPUT" | grep -q '"accepted": true'; then
  echo "❌ 任务发送失败:" >&2; echo "$PROMPT_OUTPUT" >&2; exit 1
fi
echo "✅ 任务已发送，等待执行..." >&2

# 3. 等待助手回复（轮询会话文件里的 assistant/message 文本）
echo "--- 3. 等待完成 ---" >&2
SESS_DIR="$HOME/.dsh/sessions"
SID_DIR=$(find "$SESS_DIR" -maxdepth 2 -type d -name "$SID" 2>/dev/null | head -1)
if [ -z "$SID_DIR" ]; then SID_DIR=""; fi

for i in $(seq 1 "$POLL_MAX"); do
  sleep "$POLL_INT"
  if [ -n "$SID_DIR" ] && [ -f "$SID_DIR/session.v2.jsonl.zstd" ]; then
    REPLY=$("$PY" -c "
import zstandard, json, sys
p = r'$SID_DIR/session.v2.jsonl.zstd'
dctx = zstandard.ZstdDecompressor()
try:
    with open(p,'rb') as f: data = dctx.stream_reader(f).read()
except Exception: sys.exit(0)
rows = [json.loads(l) for l in data.decode('utf-8',errors='replace').splitlines() if l.strip()]
for r in reversed(rows):
    if r.get('type')=='assistant/message':
        msg = r.get('data',{}).get('message',{})
        texts = [c.get('text','') for c in msg.get('content',[]) if c.get('type')=='text' and c.get('text','').strip()]
        if texts:
            print('|'.join(texts)[:1500]); sys.exit(0)
sys.exit(0)
" 2>/dev/null)
    if [ -n "$REPLY" ]; then
      echo "✅ 任务完成（${i}x${POLL_INT}s）" >&2
      echo "=== 会话: $SID (模式=$PRESET) ==="
      echo "$REPLY" | tr '|' '\n'
      echo "=== 桌面端已实时可见（无需重启）==="
      exit 0
    fi
  fi
done

echo "⚠️ 超时（$((POLL_MAX*POLL_INT))s）未检测到回复。会话仍在执行或失败。" >&2
echo "会话ID: $SID" >&2
exit 1
