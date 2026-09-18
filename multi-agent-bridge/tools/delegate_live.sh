#!/usr/bin/env bash
# 兼容旧入口：实时可见性已由统一 DSH RPC 适配器负责。
set -euo pipefail

PROJECT_ROOT="/d/Work/AI-Development/multi-agent-bridge"
TASK="${1:?用法: delegate_live.sh \"任务\" [工作目录] [模式]}"
WORKSPACE="${2:-$PROJECT_ROOT}"
PRESET="${3:-standard}"

export MAB_DSH_PRESET="$PRESET"
bash "$PROJECT_ROOT/tools/delegate.sh" dsh "$TASK" "$WORKSPACE" 900 analysis
