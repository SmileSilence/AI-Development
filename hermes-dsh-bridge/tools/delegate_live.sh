#!/usr/bin/env bash
# 实时委派：把任务派给 DSH，并在完成后自动：
#   1. 给新会话补上 agentPreset（模式）
#   2. 实时挂到 bridge 工作区（无需重启桌面端）
#
# 用法:
#   ./delegate_live.sh "任务描述" [工作目录] [模式]
#   模式: standard(标准) | ptc | minimal(极简) | cordis(创造)  默认 standard
set -euo pipefail

BRIDGE="/d/Work/AI-Development/hermes-dsh-bridge"
PY="/c/Users/19163/AppData/Local/Microsoft/WindowsApps/python3"
TASK="${1:?用法: delegate_live.sh \"任务\" [工作目录] [模式]}"
CWD="${2:-$BRIDGE}"
PRESET="${3:-standard}"
WS_ID="e0f71147-b38e-4a70-a266-b23d739da180"   # bridge 工作区 ID（workspace.json 里）

echo "=== 委派前: 记录现有会话 ===" >&2
BEFORE=$("$PY" -c "
import sys; sys.path.insert(0, r'$BRIDGE/tools')
from dsh_rpc import list_sessions
ok, res = list_sessions()
print('|'.join(sorted(s['id'] for s in res)) if ok else '')
" 2>&1 | grep -E '^session-')
echo "现有会话: ${BEFORE:-（无）}" >&2

echo "=== 委派任务给 DSH (模式=$PRESET) ===" >&2
OUTPUT=$(bash "$BRIDGE/tools/delegate.sh" dsh "$TASK" "$CWD" 2>&1) || true
echo "$OUTPUT" | tail -3

echo "=== 委派后: 找新会话 ===" >&2
AFTER=$("$PY" -c "
import sys; sys.path.insert(0, r'$BRIDGE/tools')
from dsh_rpc import list_sessions
ok, res = list_sessions()
print('|'.join(sorted(s['id'] for s in res)) if ok else '')
" 2>&1 | grep -E '^session-')
echo "委派后会话: ${AFTER:-（无）}" >&2

# 找出新增会话
NEW=""
for sid in $(echo "$AFTER" | tr '|' ' '); do
  case "|$BEFORE|" in
    *"|$sid|"*) ;;
    *) NEW="$sid" ;;
  esac
done

if [ -n "$NEW" ]; then
  echo "=== 新会话: $NEW ===" >&2
  echo "--- 1. 补 agentPreset=$PRESET ---" >&2
  "$PY" "$BRIDGE/tools/patch_agent_preset.py" "$NEW" "$PRESET" 2>&1 || true
  echo "--- 2. 实时挂到工作区 ---" >&2
  "$PY" "$BRIDGE/tools/dsh_rpc.py" attach-session --workspace "$WS_ID" --session "$NEW" 2>&1 || true
  echo "✅ 完成：会话已带模式 $PRESET 并实时挂载，DSH 窗口应已更新" >&2
else
  echo "⚠️ 未检测到新会话（可能任务失败或会话未写入）" >&2
fi
