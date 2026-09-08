#!/usr/bin/env bash
# 四方协作统一委派入口：把任务派给 DSH / Codex / Claude。
# 用法:
#   ./delegate.sh dsh     "任务描述" [工作目录] [超时秒]
#   ./delegate.sh codex   "任务描述" [工作目录] [超时秒]
#   ./delegate.sh claude  "任务描述" [工作目录] [超时秒]
#
# 任务经文件传递（避免多行参数在 argv 中被截断）：
#   DSH/Codex/Claude 通过读取任务文件完成工作。
set -euo pipefail

BRIDGE="/d/Work/AI-Development/hermes-dsh-bridge"
AGENT="${1:?用法: delegate.sh <dsh|codex|claude> \"任务\" [工作目录] [超时秒]}"
TASK="${2:?任务描述不能为空}"
CWD="${3:-$BRIDGE}"
TIMEOUT="${4:-300}"

# 写任务文件
TASK_FILE="$BRIDGE/shared/task-$AGENT-$(date +%H%M%S).md"
cat > "$TASK_FILE" <<EOF
# 任务（来自 Hermes 主控）

你是 Hermes 协调下的协作子代理（agent=$AGENT）。请完成以下任务，并在最后用【完成情况】段落说明你做了什么、结果如何、有无遗留问题。

## 任务内容
${TASK}

## 协作规则
- 专注完成任务，不要向用户提问
- 需要交接给其他代理时，把交接内容写到 $BRIDGE/inbox/ 下对应目录
- 完成后用中文简要汇报
EOF

# 把任务正文提取成单行摘要（给 argv 用的提示词 + 指向任务文件）
ONE_LINER="你是 Hermes 委派的子代理($AGENT)。请先读取任务文件 $TASK_FILE 并完成其中任务，最后用【完成情况】汇报。"

echo "=== 委派给 [$AGENT] ===" >&2
echo "任务文件: $TASK_FILE" >&2
echo "超时: ${TIMEOUT}s" >&2

case "$AGENT" in
  dsh)
    # 插件型任务自动开启后端监管（AI_Plugins 目录或插件/DSH 配置关键词）。
    # 任务结束（含异常退出）由 trap 自动关闭，见 EXIT。
    if { echo "$CWD"; echo "$TASK"; } | grep -qiE "AI_Plugins|plugin|插件|\.dsh|profiles/web|deepseek-harness|package\.json"; then
      SUP_FLAG="/d/Work/AI-Development/hermes-dsh-bridge/logs/supervisor-active.flag"
      mkdir -p "$(dirname "$SUP_FLAG")"
      touch "$SUP_FLAG"
      trap 'rm -f "$SUP_FLAG"' EXIT
      echo "🛡️ 插件型任务：后端监管已开启" >&2
    fi
    # DSH 的工作区 = process.cwd()，所以在目标目录下运行，让它能写目标目录内的文件
    cd "$CWD"
    OUTPUT=$(timeout "$TIMEOUT" node "D:/Program Files/DSH/deepseek-harness/apps/cli/lib/bin.js" --profile headless "$ONE_LINER" 2>&1) || {
      RC=$?; echo "DSH 执行失败 (退出码 $RC):" >&2; echo "$OUTPUT" | tail -30 >&2; exit $RC; }
    ;;
  codex)
    cd "$CWD"
    if [ ! -d .git ]; then git init -q 2>/dev/null || true; fi
    OUTPUT=$(timeout "$TIMEOUT" codex exec --sandbox workspace-write "$ONE_LINER" 2>&1) || {
      RC=$?; echo "Codex 执行失败 (退出码 $RC):" >&2; echo "$OUTPUT" | tail -30 >&2; exit $RC; }
    ;;
  claude)
    cd "$CWD"
    OUTPUT=$(timeout "$TIMEOUT" claude -p "$ONE_LINER" --allowedTools "Read,Edit,Write,Bash,WebSearch,WebFetch" --max-turns 15 2>&1) || {
      RC=$?; echo "Claude 执行失败 (退出码 $RC):" >&2; echo "$OUTPUT" | tail -30 >&2; exit $RC; }
    ;;
  *)
    echo "未知代理: $AGENT (可选 dsh|codex|claude)" >&2; rm -f "$TASK_FILE"; exit 1;;
esac

echo "$OUTPUT"
echo "=== [$AGENT] 执行完成 ===" >&2
