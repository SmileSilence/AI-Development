#!/usr/bin/env bash
# DSH 监管器启动脚本：后台运行 watchdog，自动检测后端重启并恢复运行中的会话。
# 用法:
#   ./dsh_watchdog.sh start     启动监管（后台）
#   ./dsh_watchdog.sh stop      停止监管
#   ./dsh_watchdog.sh status    查看状态
set -euo pipefail

BRIDGE="D:/Work/AI-Development/hermes-dsh-bridge"
PY="/c/Users/19163/AppData/Local/Microsoft/WindowsApps/python3"
LOG="$BRIDGE/shared/dsh-watchdog.log"
PID_FILE="$BRIDGE/shared/dsh-watchdog.pid"

case "${1:-}" in
  start)
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      echo "监管器已在运行 (PID $(cat "$PID_FILE"))"
      exit 0
    fi
    # 启动后台监管器，输出到日志
    nohup "$PY" "$BRIDGE/tools/dsh_watchdog.py" --check-interval 5 --max-fail 3 >> "$LOG" 2>&1 &
    echo $! > "$PID_FILE"
    echo "✅ DSH 监管器已启动 (PID $(cat "$PID_FILE"))"
    echo "日志: $LOG"
    echo "提示: 它会在后端重启后自动恢复运行中被中断的会话并发送'继续'"
    ;;
  stop)
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      kill "$(cat "$PID_FILE")"
      rm -f "$PID_FILE"
      echo "✅ 监管器已停止"
    else
      echo "监管器未在运行"
    fi
    ;;
  status)
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      echo "✅ 监管器运行中 (PID $(cat "$PID_FILE"))"
      echo "--- 最近日志 ---"
      tail -10 "$LOG" 2>/dev/null || echo "(无日志)"
    else
      echo "❌ 监管器未运行"
    fi
    ;;
  *)
    echo "用法: $0 {start|stop|status}"
    ;;
esac
