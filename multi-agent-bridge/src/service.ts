import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { existsSync, rmSync, statSync } from "node:fs";
import { loadConfig, type BridgeConfig } from "./config.js";
import { TaskDatabase } from "./database.js";
import { buildCallbackResponseCommand, listAgentAvailability } from "./adapters.js";
import { releaseWorktree, validateAgentPair } from "./worktree.js";
import { terminateProcessId } from "./process-runner.js";
import { AGENTS, TASK_MODES, TASK_STATUSES, type AgentName, type TaskMode, type TaskRecord, type TaskStatus } from "./types.js";
import { isPathInside, sleep } from "./utils.js";
import { resolveTaskNames } from "./naming.js";
import { runTask, type WorkerEvent } from "./worker.js";
import type { CallbackEvent } from "./types.js";

export type CallbackSink = (event: CallbackEvent) => void | Promise<void>;

export interface DelegateInput {
  originAgent?: string;
  targetAgent: string;
  workspace: string;
  workspaceName?: string;
  taskName?: string;
  prompt: string;
  mode: string;
  timeoutSeconds?: number;
}

export class BridgeService {
  readonly config: BridgeConfig;
  readonly tasks: TaskDatabase;
  private readonly callbackSinks = new Map<string, CallbackSink>();
  private readonly callbackWriters = new Map<string, (text: string) => void>();
  private readonly callbackControllers = new Map<string, AbortController>();

  constructor(config = loadConfig()) {
    this.config = config;
    this.tasks = new TaskDatabase(config);
    this.cleanupExpiredTasks();
  }

  close(): void {
    for (const controller of this.callbackControllers.values()) controller.abort();
    this.callbackControllers.clear();
    this.tasks.close();
  }

  listAgents(): ReturnType<typeof listAgentAvailability> {
    return listAgentAvailability();
  }

  delegateTask(input: DelegateInput, groupId: string | null = null, callbackSink?: CallbackSink): TaskRecord {
    const normalized = this.validateDelegateInput(input);
    const task = this.tasks.createTask({
      groupId,
      originAgent: normalized.originAgent,
      targetAgent: normalized.targetAgent,
      workspace: normalized.workspace,
      workspaceName: normalized.workspaceName,
      workspaceNameExplicit: normalized.workspaceNameExplicit,
      taskName: normalized.taskName,
      prompt: normalized.prompt,
      mode: normalized.mode,
      timeoutSeconds: normalized.timeoutSeconds,
      delegationDepth: 0,
      chain: [normalized.originAgent]
    });
    const queued = this.tasks.appendCallback(task.id, "queued", {
      message: "任务已排队。",
      workspaceName: task.workspaceName,
      sessionName: task.taskName
    });
    if (callbackSink !== undefined) {
      this.callbackSinks.set(task.callbackId, callbackSink);
      void Promise.resolve(callbackSink(queued)).catch(() => undefined);
    }
    this.spawnWorker(task.id);
    return task;
  }

  delegateBatch(originAgent: string | undefined, inputs: Omit<DelegateInput, "originAgent">[], callbackSink?: CallbackSink): { groupId: string; tasks: TaskRecord[] } {
    if (inputs.length < 1 || inputs.length > 20) throw new Error("批量委派任务数量必须在 1 到 20 之间。");
    const validated = inputs.map((input) => this.validateDelegateInput({ ...input, originAgent }));
    const groupId = randomUUID();
    const tasks = validated.map((input) => {
      const task = this.tasks.createTask({
        groupId,
        originAgent: input.originAgent,
        targetAgent: input.targetAgent,
        workspace: input.workspace,
        workspaceName: input.workspaceName,
        workspaceNameExplicit: input.workspaceNameExplicit,
        taskName: input.taskName,
        prompt: input.prompt,
        mode: input.mode,
        timeoutSeconds: input.timeoutSeconds,
        delegationDepth: 0,
        chain: [input.originAgent]
      });
      const queued = this.tasks.appendCallback(task.id, "queued", {
        message: "任务已排队。",
        workspaceName: task.workspaceName,
        sessionName: task.taskName
      });
      if (callbackSink !== undefined) {
        this.callbackSinks.set(task.callbackId, callbackSink);
        void Promise.resolve(callbackSink(queued)).catch(() => undefined);
      }
      this.spawnWorker(task.id);
      return task;
    });
    return { groupId, tasks };
  }

  getTask(id: string): TaskRecord {
    return this.tasks.requireTask(id);
  }

  getCallbackEvents(callbackId: string, afterEventId = 0): CallbackEvent[] {
    if (this.tasks.getTaskByCallbackId(callbackId) === null) throw new Error(`找不到 callback：${callbackId}`);
    return this.tasks.listCallbacks(callbackId, afterEventId);
  }

  async respondCallback(callbackId: string, response: string): Promise<TaskRecord> {
    const task = this.tasks.getTaskByCallbackId(callbackId);
    if (task === null) throw new Error(`找不到 callback：${callbackId}`);
    const text = response.trim();
    if (text === "") throw new Error("callback 回复不能为空。");
    this.tasks.appendCallback(task.id, "progress", { message: "协调器已回复目标 Agent。", response: text });
    if (task.targetAgent === "dsh") {
      if (task.agentSessionId === null) throw new Error("DSH 会话尚未返回 sessionId，暂时无法回复。");
      const script = join(this.config.projectRoot, "tools", "dsh_rpc_prompt.py");
      const python = process.env.MAB_PYTHON_COMMAND ?? "python";
      const child = spawn(python, [script, "--session", task.agentSessionId, "--text", text], { windowsHide: true, stdio: "ignore" });
      await new Promise<void>((resolvePromise, reject) => {
        child.once("error", reject);
        child.once("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`DSH callback 回复失败，退出码：${code}`)));
      });
    } else {
      const adapter = buildCallbackResponseCommand(task, text);
      const child = spawn(adapter.command, adapter.args, {
        cwd: task.runWorkspace ?? task.workspace,
        env: adapter.env,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"]
      });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
      child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
      await new Promise<void>((resolvePromise, reject) => {
        child.once("error", reject);
        child.once("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(stderr.trim() || `${task.targetAgent} callback 回复失败，退出码：${code}`)));
      });
      const callback = this.tasks.appendCallback(task.id, "progress", {
        message: `${task.targetAgent} 原生会话已接收回复。`,
        agentSessionId: task.agentSessionId,
        responseSummary: extractAgentResult(stdout) ?? "目标 Agent 已响应。"
      });
      const sink = this.callbackSinks.get(callbackId);
      if (sink !== undefined) void Promise.resolve(sink(callback)).catch(() => undefined);
    }
    return this.tasks.requireTask(task.id);
  }

  listTasks(filters: {
    workspace?: string;
    originAgent?: string;
    targetAgent?: string;
    status?: string;
    limit?: number;
  }): TaskRecord[] {
    return this.tasks.listTasks({
      workspace: filters.workspace === undefined ? undefined : resolve(filters.workspace),
      originAgent: filters.originAgent === undefined ? undefined : parseAgent(filters.originAgent),
      targetAgent: filters.targetAgent === undefined ? undefined : parseAgent(filters.targetAgent),
      status: filters.status === undefined ? undefined : parseStatus(filters.status),
      limit: filters.limit
    });
  }

  async waitTasks(ids: string[], timeoutSeconds = 30): Promise<TaskRecord[]> {
    if (ids.length < 1 || ids.length > 20) throw new Error("等待任务数量必须在 1 到 20 之间。");
    const boundedTimeout = Math.min(Math.max(timeoutSeconds, 0), 60);
    const initial = ids.map((id) => this.tasks.requireTask(id));
    const initialVersions = new Map(initial.map((task) => [task.id, task.updatedAt]));
    const deadline = Date.now() + boundedTimeout * 1000;
    while (Date.now() < deadline) {
      await sleep(500);
      const current = ids.map((id) => this.tasks.requireTask(id));
      if (current.some((task) => task.updatedAt !== initialVersions.get(task.id) || isTerminal(task.status))) return current;
    }
    return ids.map((id) => this.tasks.requireTask(id));
  }

  cancelTask(id: string): TaskRecord {
    const before = this.tasks.requireTask(id);
    const task = this.tasks.requestCancel(id);
    const controller = this.callbackControllers.get(task.callbackId);
    if (controller !== undefined) controller.abort();
    else if (task.processId !== null && task.status === "running") terminateProcessId(task.processId);
    if (before.status === "queued" && task.status === "canceled") {
      const callback = this.tasks.appendCallback(task.id, "canceled", { message: "任务在启动前被取消。" });
      const sink = this.callbackSinks.get(task.callbackId);
      if (sink !== undefined) void Promise.resolve(sink(callback)).catch(() => undefined);
      this.callbackSinks.delete(task.callbackId);
      this.callbackControllers.delete(task.callbackId);
    }
    return this.tasks.requireTask(id);
  }

  async releaseTask(id: string, keepBranch = true): Promise<TaskRecord> {
    const task = this.tasks.requireTask(id);
    if (!isTerminal(task.status)) throw new Error("只能释放已结束任务的 worktree。");
    if (task.worktree === null) return task;
    if (task.targetAgent === "dsh" && task.targetWorkspaceKind === "worktree" && task.targetWorkspaceCreated) {
      if (task.targetWorkspaceId === null || task.agentSessionId === null) {
        throw new Error("DSH 写任务缺少工作区或会话 ID，已保留 worktree 以便重试。");
      }
      await this.releaseDshWorkspace(task.targetWorkspaceId, task.agentSessionId);
    }
    releaseWorktree(this.config, task, keepBranch);
    return this.tasks.updateTask(id, { worktree: null, runWorkspace: null });
  }

  private async releaseDshWorkspace(workspaceId: string, sessionId: string): Promise<void> {
    const script = join(this.config.projectRoot, "tools", "dsh_rpc_release.py");
    const python = process.env.MAB_PYTHON_COMMAND ?? "python";
    const child = spawn(python, [script, "--workspace-id", workspaceId, "--session-id", sessionId], {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    await new Promise<void>((resolvePromise, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => code === 0
        ? resolvePromise()
        : reject(new Error(stderr.trim() || `DSH 工作区释放失败，退出码：${code}`)));
    });
  }

  private validateDelegateInput(input: DelegateInput): {
    originAgent: AgentName;
    targetAgent: AgentName;
    workspace: string;
    workspaceName: string;
    workspaceNameExplicit: boolean;
    taskName: string;
    prompt: string;
    mode: TaskMode;
    timeoutSeconds: number;
  } {
    if (this.config.inheritedDelegationDepth > 0) {
      throw new Error("当前 Agent 是被委派执行者，禁止继续递归委派。");
    }
    const configuredOrigin = this.config.originAgent === undefined ? undefined : parseAgent(this.config.originAgent);
    const requestedOrigin = input.originAgent === undefined ? undefined : parseAgent(input.originAgent);
    if (configuredOrigin !== undefined && requestedOrigin !== undefined && configuredOrigin !== requestedOrigin) {
      throw new Error(`来源 Agent 与 MCP 注册身份不一致：${requestedOrigin} != ${configuredOrigin}`);
    }
    const originAgent = configuredOrigin ?? requestedOrigin;
    if (originAgent === undefined) throw new Error("无法识别来源 Agent；请传入 origin_agent 或在 MCP 配置中设置 MAB_ORIGIN_AGENT。");
    const targetAgent = parseAgent(input.targetAgent);
    validateAgentPair(originAgent, targetAgent, [originAgent]);
    const availability = listAgentAvailability().find((item) => item.name === targetAgent);
    if (availability?.available !== true) throw new Error(availability?.reason ?? `Agent 不可用：${targetAgent}`);

    const workspace = resolve(input.workspace);
    if (!existsSync(workspace) || !statSync(workspace).isDirectory()) throw new Error(`工作区不存在或不是目录：${workspace}`);
    const prompt = input.prompt.trim();
    if (prompt === "") throw new Error("任务内容不能为空。");
    const names = resolveTaskNames(workspace, prompt, input.workspaceName, input.taskName);
    const mode = parseMode(input.mode);
    const timeoutSeconds = Math.min(
      Math.max(input.timeoutSeconds ?? this.config.defaultTimeoutSeconds, 1),
      this.config.maxTimeoutSeconds
    );
    return { originAgent, targetAgent, workspace, ...names, prompt, mode, timeoutSeconds };
  }

  private spawnWorker(taskId: string): void {
    if (process.env.MAB_DISABLE_WORKER_SPAWN === "1") return;
    if (this.config.callbackMode) {
      const task = this.tasks.requireTask(taskId);
      const controller = new AbortController();
      this.callbackControllers.set(task.callbackId, controller);
      void runTask(taskId, (event) => this.publishCallback(event), (writer) => {
        this.callbackWriters.set(task.callbackId, writer);
      }, controller.signal).finally(() => this.callbackControllers.delete(task.callbackId));
      return;
    }
    const workerPath = join(this.config.projectRoot, "dist", "worker.js");
    if (!existsSync(workerPath)) throw new Error(`找不到构建后的 worker：${workerPath}`);
    const child = spawn(process.execPath, [workerPath, taskId], {
      cwd: this.config.projectRoot,
      env: process.env,
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });
    child.unref();
    if (child.pid !== undefined) this.tasks.updateTask(taskId, { workerProcessId: child.pid });
  }

  private publishCallback(event: WorkerEvent): void {
    const task = this.tasks.requireTask(event.taskId);
    const callback = this.tasks.appendCallback(event.taskId, event.type, event.payload);
    const sink = this.callbackSinks.get(task.callbackId);
    if (sink !== undefined) void Promise.resolve(sink(callback)).catch(() => undefined);
    if (["completed", "failed", "canceled"].includes(event.type)) {
      this.callbackSinks.delete(task.callbackId);
      this.callbackWriters.delete(task.callbackId);
      this.callbackControllers.delete(task.callbackId);
    }
  }

  private cleanupExpiredTasks(): void {
    for (const task of this.tasks.purgeExpiredTasks(this.config.retentionDays)) {
      const taskDirectory = join(this.config.tasksRoot, task.id);
      if (isPathInside(this.config.tasksRoot, taskDirectory)) {
        rmSync(taskDirectory, { recursive: true, force: true });
      }
    }
  }
}

export function publicTask(task: TaskRecord): Omit<TaskRecord, "prompt"> {
  const { prompt: _prompt, ...rest } = task;
  return rest;
}

function parseAgent(value: string): AgentName {
  const normalized = value.toLowerCase();
  if (!AGENTS.includes(normalized as AgentName)) throw new Error(`不支持的 Agent：${value}`);
  return normalized as AgentName;
}

function parseMode(value: string): TaskMode {
  const normalized = value.toLowerCase();
  if (!TASK_MODES.includes(normalized as TaskMode)) throw new Error(`不支持的任务模式：${value}`);
  return normalized as TaskMode;
}

function parseStatus(value: string): TaskStatus {
  const normalized = value.toLowerCase();
  if (!TASK_STATUSES.includes(normalized as TaskStatus)) throw new Error(`不支持的任务状态：${value}`);
  return normalized as TaskStatus;
}

function isTerminal(status: TaskStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "canceled";
}

function extractAgentResult(output: string): string | null {
  let result: string | null = null;
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const value = JSON.parse(line) as Record<string, unknown>;
      if (typeof value.result === "string") result = value.result;
      const item = typeof value.item === "object" && value.item !== null ? value.item as Record<string, unknown> : null;
      if (item?.type === "agent_message" && typeof item.text === "string") result = item.text;
      const message = typeof value.message === "object" && value.message !== null ? value.message as Record<string, unknown> : null;
      const content = Array.isArray(message?.content) ? message.content as Array<Record<string, unknown>> : [];
      const text = content
        .filter((part) => part.type === "text" && typeof part.text === "string")
        .map((part) => String(part.text))
        .join("\n");
      if (text !== "") result = text;
    } catch {
      // 忽略非 JSON 流输出。
    }
  }
  return result;
}
