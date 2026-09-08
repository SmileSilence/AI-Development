#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DSH 监管器（配合 Hermes cron 每 5 分钟跑一次，watchdog 模式）。

职责：检测 DSH 后端（127.0.0.1:3080）是否健康；
一旦失联，执行完整恢复流程：
  1. 完全关闭桌面端 + 后端（含按命令行兜底清理残留 node 进程）
  2. 重启桌面端（DeepSeek Harness.exe）
  3. 等待后端 3080 端口就绪（首启 tsx 编译可能 30s+，上限 90s）
  4. 扫描所有「未正常结束」的会话（turn/start > turn/end，即被打断）
  5. 对每个未完成会话通过官方 RPC 发「继续」，让它接着干

健康时**零 stdout**（Hermes cron no_agent 模式：空输出不投递）；
只有恢复动作发生时才输出报告。动作全程写日志到 <bridge>/logs/dsh_supervisor.log。

依赖：zstandard（读会话日志）、同目录 dsh_rpc.py/dsh_cookie.py（RPC 认证）。
必须用已装 zstandard 的解释器运行：
  /c/Users/19163/AppData/Local/Microsoft/WindowsApps/python3
"""
import os, sys, time, json, socket, subprocess, glob, datetime, uuid
from collections import Counter

HOST = "127.0.0.1"
PORT = 3080
DESKTOP_EXE = r"D:\Program Files\DSH\DSH-Desktop\DeepSeek Harness.exe"
DESKTOP_DIR = r"D:\Program Files\DSH\DSH-Desktop"
SESSIONS = r"C:\Users\19163\.dsh\sessions"
# 监管开关标记：委派脚本发插件型任务时 touch，任务结束（EXIT trap）删除。
# 无此标记时 main() 秒退静默，实现「仅在插件任务期间守护」。
FLAG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "logs", "supervisor-active.flag")
WAIT_BACKEND_TIMEOUT = 90
CONTINUE_TEXT = "继续执行之前未完成的任务，从上次中断处继续。"

# 复用桥目录的 RPC 客户端（同目录）
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dsh_rpc import unary  # noqa: E402


def log(msg: str) -> None:
    logdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "logs")
    os.makedirs(logdir, exist_ok=True)
    line = f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    with open(os.path.join(logdir, "dsh_supervisor.log"), "a", encoding="utf-8") as f:
        f.write(line + "\n")


def port_open(host: str, port: int, timeout: float = 2.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def full_kill() -> None:
    """完全关闭客户端及后端，含按命令行兜底清理残留后端 node 进程。"""
    # 1. 杀桌面端（/T 连带整个进程树，后端 node 是它 spawn 的子进程）
    subprocess.run(
        ["taskkill", "/F", "/T", "/IM", "DeepSeek Harness.exe"],
        capture_output=True, timeout=30,
    )
    # 2. 兜底：杀残留的独立后端 node 进程。必须同时限定 Name=node.exe 且排除
    #    自身 $PID（否则查询者命令行里含 bin.ts 字面串会匹配到自己/父 bash）。
    ps = (
        "Get-CimInstance Win32_Process | Where-Object { "
        "$_.Name -eq 'node.exe' -and $_.CommandLine -like '*bin.ts*' -and "
        "$_.CommandLine -like '*--profile*' -and $_.ProcessId -ne $PID } | "
        "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
    )
    subprocess.run(
        ["powershell.exe", "-NoProfile", "-Command", ps],
        capture_output=True, timeout=30,
    )
    time.sleep(2)


def start_desktop() -> None:
    ps = (f'Start-Process -FilePath "{DESKTOP_EXE}" '
          f'-WorkingDirectory "{DESKTOP_DIR}"')
    subprocess.run(
        ["powershell.exe", "-NoProfile", "-Command", ps],
        capture_output=True, timeout=30,
    )


def wait_backend(timeout: int = WAIT_BACKEND_TIMEOUT) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if port_open(HOST, PORT):
            return True
        time.sleep(3)
    return False


def unfinished_sessions() -> list:
    """扫描所有会话日志，返回 turn/start > turn/end（被打断未完成）的 sessionId。"""
    result = []
    for zf in glob.glob(os.path.join(SESSIONS, "*", "*", "*.zstd")):
        try:
            dctx = __import__("zstandard").ZstdDecompressor()
            with open(zf, "rb") as f:
                data = dctx.stream_reader(f).read()
            rows = [json.loads(l) for l in data.decode("utf-8", errors="replace").splitlines() if l.strip()]
        except Exception:
            continue
        c = Counter(r.get("type") for r in rows)
        if c.get("turn/start", 0) > c.get("turn/end", 0):
            sid = os.path.basename(os.path.dirname(zf))
            result.append(sid)
    return result


def live_session_ids() -> set:
    """后端前会话列表（session/list RPC），用于过滤确实存在的 sid。"""
    ok, val = unary("session/list", {"_request": {}})
    if not ok:
        return set()
    return {it.get("sessionId") for it in (val or {}).get("items", []) if it.get("sessionId")}


def continue_session(sid: str):
    req = {
        "sessionId": sid,
        "requestId": f"supervisor-{uuid.uuid4().hex[:12]}",
        "mode": "queue",
        "content": [{"type": "text", "text": CONTINUE_TEXT}],
    }
    return unary("session/prompt", {"request": req})


def main() -> None:
    if not os.path.exists(FLAG):
        return  # 无插件任务进行中：秒退静默（守护仅限插件型任务期间）
    if port_open(HOST, PORT):
        return  # 健康：watchdog 静默

    log("检测到 3080 失联，开始恢复")
    full_kill()
    log("已完全关闭客户端/后端，开始重启桌面端")
    start_desktop()

    if not wait_backend():
        log("重启后 90s 内后端未就绪")
        print("❌ DSH 后端失联，已关闭并重启桌面端，但 90 秒内 127.0.0.1:3080 仍未就绪，请人工检查（可能与 BOM/插件启动失败有关）。")
        return

    log("后端已就绪，等待会话加载")
    time.sleep(5)

    live = live_session_ids()
    pending = [s for s in unfinished_sessions() if s in live]

    lines = [
        "🔄 DSH 后端曾失联，监管器已完成自动恢复：",
        "  · 完全关闭客户端/后端 → 重启桌面端 → 后端已就绪 (127.0.0.1:3080)",
    ]
    if pending:
        lines.append(f"  · 检测到 {len(pending)} 个未完成会话，已发送「继续」：")
        for s in pending:
            ok, res = continue_session(s)
            if ok:
                lines.append(f"      - ✅ {s}")
                log(f"续跑会话 {s}")
            else:
                lines.append(f"      - ⚠️ {s} 发送失败: {res}")
                log(f"续跑失败 {s}: {res}")
    else:
        lines.append("  · 无未完成会话（无需续跑）")
    log("恢复流程完成")
    print("\n".join(lines))


if __name__ == "__main__":
    main()