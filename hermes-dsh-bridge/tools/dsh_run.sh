#!/usr/bin/env bash
# 委派任务给 DSH（headless 模式）并返回结果。
# 用法: ./dsh_run.sh "任务描述" [工作目录] [超时秒数]
set -euo pipefail

DSH_ROOT="/d/Program Files/DSH/deepseek-harness"
TASK="${1:?用法: dsh_run.sh \"任务\" [工作目录] [超时秒]}"
CWD="${2:-}"
TIMEOUT="${3:-300}"

# 生成带上下文的完整提示词
PROMPT="你是一个被 Hermes 委派执行任务的 DSH 子代理。请完成以下任务，并在最后输出【完成情况】段落说明你做了什么、结果如何。

【任务】
${TASK}

【要求】
- 专注完成任务本身，不需要向用户提问
- 完成后用中文简要汇报做了什么
"

echo "=== 委派给 DSH (headless) ===" >&2
echo "任务: ${TASK:0:80}..." >&2
echo "工作目录: ${CWD:-默认}" >&2
echo "超时: ${TIMEOUT}s" >&2

# 插件型任务自动开启后端监管（AI_Plugins 目录或插件/DSH 配置关键词）
if { echo "${CWD:-}"; echo "$TASK"; } | grep -qiE "AI_Plugins|plugin|插件|\.dsh|profiles/web|deepseek-harness|package\.json"; then
  SUP_FLAG="/d/Work/AI-Development/hermes-dsh-bridge/logs/supervisor-active.flag"
  mkdir -p "$(dirname "$SUP_FLAG")"
  touch "$SUP_FLAG"
  trap 'rm -f "$SUP_FLAG"' EXIT
  echo "🛡️ 插件型任务：后端监管已开启" >&2
fi

cd "$DSH_ROOT"
# 捕获输出；headless 的 dsh 会把最终结果打到 stdout
OUTPUT=$(timeout "$TIMEOUT" pnpm dsh --profile headless "$PROMPT" 2>&1) || {
    RC=$?
    echo "DSH 执行失败 (退出码 $RC):" >&2
    echo "$OUTPUT" | tail -30 >&2
    exit $RC
}

echo "$OUTPUT"
echo "=== DSH 执行完成 ===" >&2
