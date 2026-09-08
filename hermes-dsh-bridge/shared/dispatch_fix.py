# -*- coding: utf-8 -*-
"""一次性派发脚本：创建 cordis 会话 → 切完全权限 → 发任务。"""
import sys, json, uuid

sys.path.insert(0, r"D:\Work\AI-Development\hermes-dsh-bridge\tools")
from dsh_rpc import unary

WORKSPACE_ID = "5cb342c8-2a7f-48ef-a915-2e9bdb0827d9"  # AI_Plugins
TASK_FILE = "D:/Work/AI-Development/hermes-dsh-bridge/shared/task-dsh-fix-20260907.md"

PROMPT = (
    "请阅读并严格执行任务书：" + TASK_FILE + " 。"
    "工作目录是 D:\\Work\\AI-Development\\AI_Plugins\\DSH\\SmilePlugin\\dsh-plugin-manager。"
    "按任务书顺序完成：四处代码改名（宿主/客户端 manifest 两端同步）→ 版本号与 CHANGELOG → "
    "pnpm build + pnpm test 自验 → 确认 lib 产物无残留 → npm pack → 重装到 profile web → "
    "git 提交（用任务书里给定的规范中文 message，只暂存真实源码改动）。"
    "本会话已具备完全权限（danger-full-access），允许写 C:\\Users\\19163\\.dsh\\profiles\\web。"
    "每一步报告真实命令输出摘要，遇到与任务书不符的情况先停下报告，不要自行发挥。"
)

def main():
    # 1. 创建 cordis（创造）模式会话
    ok, res = unary("session/create", {"request": {"workspaceId": WORKSPACE_ID, "agentPreset": "cordis"}})
    print("create:", ok, json.dumps(res, ensure_ascii=False)[:300])
    if not ok:
        sys.exit(1)
    sid = res.get("sessionId")
    print("sessionId:", sid)

    # 2. 切换权限预设为完全权限
    ok2, res2 = unary("commands/execute", {
        "agentId": sid,
        "line": "permission danger-full-access",
        "submittedAttachments": [],
    })
    print("permission:", ok2, json.dumps(res2, ensure_ascii=False)[:300])

    # 3. 发出任务
    ok3, res3 = unary("session/prompt", {
        "request": {
            "sessionId": sid,
            "requestId": "rpc-" + uuid.uuid4().hex[:12],
            "mode": "queue",
            "content": [{"type": "text", "text": PROMPT}],
        }
    })
    print("prompt:", ok3, json.dumps(res3, ensure_ascii=False)[:300])
    if ok3:
        print("TASK_DISPATCHED", sid)

if __name__ == "__main__":
    main()
