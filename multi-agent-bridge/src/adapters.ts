import { existsSync } from "node:fs";
import { delimiter, extname, isAbsolute } from "node:path";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { AdapterCommand, AgentAvailability, AgentName, TaskRecord } from "./types.js";

const DEFAULT_DSH_CLI = "D:\\Program Files\\DSH\\deepseek-harness\\apps\\cli\\lib\\bin.js";

export function listAgentAvailability(): AgentAvailability[] {
  return (["codex", "claude", "dsh"] as AgentName[]).map((name) => {
    const resolved = resolveAgentCommand(name);
    return {
      name,
      available: resolved !== null,
      command: resolved,
      reason: resolved === null ? `未找到 ${name} 的可执行入口。` : null,
      modes: ["analysis", "write"]
    };
  });
}

export function buildAdapterCommand(task: TaskRecord): AdapterCommand {
  const prompt = delegatedPrompt(task);
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    MAB_ORIGIN_AGENT: task.targetAgent,
    MAB_DELEGATION_DEPTH: String(task.delegationDepth + 1),
    MAB_ROOT_TASK_ID: task.rootTaskId
  };

  if (task.targetAgent === "codex") {
    const command = requireAgentCommand("codex");
    return {
      command,
      args: ["exec", "--json", "--sandbox", task.mode === "write" ? "workspace-write" : "read-only", prompt],
      env: childEnv
    };
  }

  if (task.targetAgent === "claude") {
    const command = requireAgentCommand("claude");
    const tools = task.mode === "write"
      ? "Read,Glob,Grep,Edit,Write,Bash,WebSearch,WebFetch"
      : "Read,Glob,Grep,WebSearch,WebFetch";
    const args = [
      "-p", prompt,
      "--allowedTools", tools,
      "--max-turns", "30",
      "--output-format", "stream-json",
      "--verbose",
      "--session-id", task.id,
      "--name", `${task.workspaceName} · ${task.taskName}`
    ];
    if (extname(command).toLowerCase() === ".ps1") {
      return {
        command: "powershell.exe",
        args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", command, ...args],
        env: childEnv,
        sessionIdHint: task.id
      };
    }
    return { command, args, env: childEnv, sessionIdHint: task.id };
  }

  // 测试或用户显式覆盖入口时保留直接 CLI 模式；正式 DSH 使用 RPC 挂载到可见工作区。
  const dshOverride = process.env.MAB_DSH_COMMAND;
  if (dshOverride !== undefined && dshOverride.trim() !== "") {
    const dshCli = requireAgentCommand("dsh");
    return {
      command: process.execPath,
      args: [dshCli, "--profile", process.env.MAB_DSH_PROFILE ?? "headless", prompt],
      env: childEnv
    };
  }
  const python = resolveCommand(process.env.MAB_PYTHON_COMMAND ?? "python") ?? resolveCommand("python3");
  if (python === null) throw new Error("DSH RPC 适配需要 Python 命令；请设置 MAB_PYTHON_COMMAND。");
  const rpcScript = join(dirname(fileURLToPath(import.meta.url)), "..", "tools", "dsh_rpc_task.py");
  return {
    command: python,
    args: [
      rpcScript,
      "--workspace", task.workspace,
      "--run-cwd", task.runWorkspace ?? task.workspace,
      "--workspace-name", task.workspaceName,
      ...(task.workspaceNameExplicit ? ["--workspace-name-explicit"] : []),
      "--task-name", task.taskName,
      "--mode", task.mode,
      "--preset", process.env.MAB_DSH_PRESET ?? "standard",
      "--timeout", String(task.timeoutSeconds),
      "--prompt", prompt
    ],
    env: childEnv
  };
}

export function buildCallbackResponseCommand(task: TaskRecord, response: string): AdapterCommand {
  if (task.agentSessionId === null) throw new Error(`${task.targetAgent} 尚未返回原生会话 ID。`);
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    MAB_ORIGIN_AGENT: task.targetAgent,
    MAB_DELEGATION_DEPTH: String(task.delegationDepth + 1),
    MAB_ROOT_TASK_ID: task.rootTaskId
  };
  if (task.targetAgent === "codex") {
    return {
      command: requireAgentCommand("codex"),
      args: ["exec", "resume", "--json", task.agentSessionId, response],
      env: childEnv
    };
  }
  if (task.targetAgent === "claude") {
    const command = requireAgentCommand("claude");
    const args = ["-p", "--resume", task.agentSessionId, response, "--output-format", "stream-json", "--verbose"];
    if (extname(command).toLowerCase() === ".ps1") {
      return {
        command: "powershell.exe",
        args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", command, ...args],
        env: childEnv
      };
    }
    return { command, args, env: childEnv };
  }
  throw new Error("DSH callback 回复应通过 RPC 发送。");
}

export function resolveAgentCommand(agent: AgentName): string | null {
  const override = process.env[`MAB_${agent.toUpperCase()}_COMMAND`];
  if (override !== undefined && override.trim() !== "") return resolveCommand(override.trim());
  if (agent === "dsh") {
    const dshCli = process.env.MAB_DSH_CLI ?? DEFAULT_DSH_CLI;
    return existsSync(dshCli) ? dshCli : null;
  }
  return resolveCommand(agent);
}

function requireAgentCommand(agent: AgentName): string {
  const command = resolveAgentCommand(agent);
  if (command === null) throw new Error(`Agent 不可用：${agent}`);
  return command;
}

function resolveCommand(command: string): string | null {
  if (isAbsolute(command)) return existsSync(command) ? command : null;
  if (process.platform === "win32") {
    const result = spawnSync("where.exe", [command], { encoding: "utf8", windowsHide: true });
    const matches = result.status === 0
      ? result.stdout.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
      : [];
    const executable = matches.find((item) => [".exe", ".com"].includes(extname(item).toLowerCase()));
    if (executable !== undefined) return executable;
    const extensionless = matches.find((item) => extname(item) === "");
    if (extensionless !== undefined && existsSync(`${extensionless}.ps1`)) return `${extensionless}.ps1`;
    const script = matches.find((item) => [".ps1", ".cmd", ".bat"].includes(extname(item).toLowerCase()));
    if (script !== undefined) return script;
    if (matches[0] !== undefined) return matches[0];
  }
  for (const part of (process.env.PATH ?? "").split(delimiter)) {
    const candidate = `${part}/${command}`;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function delegatedPrompt(task: TaskRecord): string {
  const modeRule = task.mode === "write"
    ? "你可以在当前隔离 worktree 中修改文件。完成后运行相关测试并汇报修改与验证结果。"
    : "这是只读分析任务。不得创建、修改、删除或格式化任何项目文件。";
  return [
    `任务：${task.taskName}`,
    "",
    "你正在执行 Multi-Agent Bridge 委派的单层任务。",
    `来源 Agent：${task.originAgent}`,
    `目标 Agent：${task.targetAgent}`,
    `根任务：${task.rootTaskId}`,
    `原始项目工作区：${task.workspace}`,
    `实际执行目录：${task.runWorkspace ?? task.workspace}`,
    "禁止继续委派其他 Agent，也不要调用 multi-agent-bridge 的 delegate 工具。",
    "如果执行中必须由用户回答问题，请单独输出：MAB_CALLBACK:question: <问题>。",
    "如果执行中必须获得确认，请单独输出：MAB_CALLBACK:confirmation: <待确认事项>。",
    "收到协调器通过原生会话发来的回复后，从当前上下文继续执行。",
    modeRule,
    "最后用【完成情况】说明结论、改动、测试与遗留问题。",
    "",
    "【任务】",
    task.prompt
  ].join("\n");
}
