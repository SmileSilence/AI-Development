#!/usr/bin/env bash
set -euo pipefail

# 兼容旧入口：创建异步任务后立即返回 JSON，不再写入 inbox/outbox。
TARGET_AGENT="${1:?用法: delegate.sh <target-agent> <prompt> [workspace] [timeout-seconds] [analysis|write]}"
PROMPT="${2:?缺少任务内容}"
WORKSPACE="${3:-$PWD}"
TIMEOUT_SECONDS="${4:-900}"
MODE="${5:-analysis}"
ORIGIN_AGENT="${MAB_ORIGIN_AGENT:-codex}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

node "$PROJECT_ROOT/dist/cli.js" delegate \
  --origin "$ORIGIN_AGENT" \
  --target "$TARGET_AGENT" \
  --workspace "$WORKSPACE" \
  --mode "$MODE" \
  --prompt "$PROMPT" \
  --timeout "$TIMEOUT_SECONDS"

