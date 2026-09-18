import { ensureDirectory, runGit, sleep, tailFile } from "./utils.js";
import { loadConfig } from "./config.js";
import { TaskDatabase } from "./database.js";
import { buildAdapterCommand } from "./adapters.js";
import { commitTaskChanges, prepareWriteWorktree, repositoryRootForAnalysis } from "./worktree.js";
import { runAgentProcess } from "./process-runner.js";
import { join } from "node:path";

import type { CallbackEventType } from "./types.js";

export interface WorkerEvent {
  type: CallbackEventType;
  taskId: string;
  payload: Record<string, unknown>;
}

export async function runTask(
  taskId: string,
  onEvent?: (event: WorkerEvent) => void,
  onInputReady?: (write: (text: string) => void) => void,
  signal?: AbortSignal
): Promise<void> {
  const config = loadConfig();
  const database = new TaskDatabase(config);
  database.updateTask(taskId, { workerProcessId: process.pid });
  const emit = (type: CallbackEventType, payload: Record<string, unknown> = {}): void => {
    const event = { type, taskId, payload };
    if (onEvent !== undefined) onEvent(event);
    else database.appendCallback(taskId, type, payload);
  };

  try {
    while (!database.tryClaimTask(taskId)) {
      const pending = database.requireTask(taskId);
      if (pending.status !== "queued" || pending.cancelRequested) return;
      await sleep(1000);
    }

    let task = database.requireTask(taskId);
    emit("started", {
      message: "目标 Agent 已启动。",
      workspaceName: task.workspaceName,
      sessionName: task.targetAgent === "claude" ? `${task.workspaceName} · ${task.taskName}` : task.taskName
    });
    const taskDirectory = join(config.tasksRoot, task.id);
    ensureDirectory(taskDirectory);
    const stdoutPath = join(taskDirectory, "stdout.log");
    const stderrPath = join(taskDirectory, "stderr.log");

    let analysisGitState: string | null = null;
    if (task.mode === "write") {
      const worktree = prepareWriteWorktree(config, task);
      task = database.updateTask(task.id, {
        repositoryRoot: worktree.repositoryRoot,
        runWorkspace: worktree.runWorkspace,
        branch: worktree.branch,
        worktree: worktree.worktree,
        baseHead: worktree.baseHead,
        stdoutPath,
        stderrPath
      });
    } else {
      const repositoryRoot = repositoryRootForAnalysis(task.workspace);
      if (repositoryRoot !== null) analysisGitState = runGit(["-C", repositoryRoot, "status", "--porcelain"]);
      task = database.updateTask(task.id, {
        repositoryRoot,
        runWorkspace: task.workspace,
        stdoutPath,
        stderrPath
      });
    }

    const adapter = buildAdapterCommand(task);
    const visibleSessionName = task.targetAgent === "claude"
      ? `${task.workspaceName} · ${task.taskName}`
      : task.taskName;
    if (task.targetAgent !== "dsh") {
      task = database.updateTask(task.id, {
        targetWorkspaceName: task.workspaceName,
        targetWorkspacePath: task.runWorkspace ?? task.workspace,
        targetWorkspaceKind: task.mode === "write" ? "worktree" : "logical",
        targetWorkspaceCreated: false,
        agentSessionName: visibleSessionName
      });
    }
    if (adapter.sessionIdHint !== undefined) {
      task = database.updateTask(task.id, {
        agentSessionId: adapter.sessionIdHint,
        agentSessionName: visibleSessionName
      });
      emit("progress", {
        message: `${task.targetAgent} 原生会话已创建。`,
        agentSessionId: adapter.sessionIdHint,
        workspaceName: task.targetWorkspaceName,
        sessionName: task.agentSessionName
      });
    }
    const outputBuffers: Record<"stdout" | "stderr", string> = { stdout: "", stderr: "" };
    let agentSummary: string | null = null;
    const result = await runAgentProcess({
      adapter,
      cwd: task.runWorkspace ?? task.workspace,
      stdoutPath,
      stderrPath,
      timeoutSeconds: task.timeoutSeconds,
      onStarted: (processId) => database.updateTask(task.id, { processId }),
      isCanceled: signal === undefined ? () => database.requireTask(task.id).cancelRequested : undefined,
      signal,
      onInputReady,
      onOutput: (stream, chunk) => {
        const callback = chunk.match(/MAB_CALLBACK:(question|confirmation):\s*(.+)/i);
        if (callback !== null) emit(callback[1].toLowerCase() as "question" | "confirmation", {
          message: callback[2],
          ...taskVisibility(task)
        });
        if (stream === "stdout" && task.targetAgent === "dsh") {
          outputBuffers.stdout += chunk;
          const lines = outputBuffers.stdout.split(/\r?\n/);
          outputBuffers.stdout = lines.pop() ?? "";
          for (const line of lines) {
            const metadata = parseDshSession(line);
            if (metadata === null) continue;
            task = database.updateTask(task.id, {
              agentSessionId: metadata.sessionId,
              targetWorkspaceId: metadata.workspaceId,
              targetWorkspaceName: metadata.workspaceName,
              targetWorkspacePath: metadata.workspacePath,
              targetWorkspaceKind: metadata.workspaceKind,
              targetWorkspaceCreated: metadata.workspaceCreated,
              agentSessionName: metadata.sessionName
            });
            emit("progress", {
              message: "DSH 会话已创建并归属可见工作区。",
              agentSessionId: metadata.sessionId,
              workspaceId: metadata.workspaceId,
              workspaceName: metadata.workspaceName,
              workspacePath: metadata.workspacePath,
              workspaceKind: metadata.workspaceKind,
              workspaceCreated: metadata.workspaceCreated,
              sessionName: metadata.sessionName
            });
          }
        }
        if (stream === "stdout" && (task.targetAgent === "codex" || task.targetAgent === "claude")) {
          outputBuffers.stdout += chunk;
          const lines = outputBuffers.stdout.split(/\r?\n/);
          outputBuffers.stdout = lines.pop() ?? "";
          for (const line of lines) {
            const event = parseAgentEvent(line);
            if (event === null) continue;
            if (event.summary !== null) agentSummary = event.summary;
            const sessionId = event.sessionId;
            if (sessionId !== null && sessionId !== task.agentSessionId) {
              task = database.updateTask(task.id, { agentSessionId: sessionId });
              emit("progress", {
                message: `${task.targetAgent} 原生会话已创建。`,
                agentSessionId: sessionId,
                eventType: event.type
              });
            } else if (event.progress) {
              emit("progress", { message: event.progress, agentSessionId: task.agentSessionId, eventType: event.type });
            }
          }
        }
      }
    });

    task = database.requireTask(task.id);
    const stdoutTail = tailFile(stdoutPath);
    const summary = cleanAgentSummary(agentSummary ?? stdoutTail);
    const stderrTail = tailFile(stderrPath);
    const finishedAt = new Date().toISOString();
    if (result.canceled || task.cancelRequested) {
      database.updateTask(task.id, {
        status: "canceled",
        exitCode: result.exitCode,
        summary: summary || null,
        error: "任务已取消。",
        finishedAt,
        processId: null
      });
      emit("canceled", { message: "任务已取消。", ...taskVisibility(database.requireTask(task.id)) });
      return;
    }
    if (result.timedOut) {
      database.updateTask(task.id, {
        status: "failed",
        exitCode: result.exitCode,
        summary: summary || null,
        error: `任务超过 ${task.timeoutSeconds} 秒限制。`,
        finishedAt,
        processId: null
      });
      emit("failed", {
        message: `任务超过 ${task.timeoutSeconds} 秒限制。`,
        timedOut: true,
        ...taskVisibility(database.requireTask(task.id))
      });
      return;
    }
    if (result.exitCode !== 0) {
      database.updateTask(task.id, {
        status: "failed",
        exitCode: result.exitCode,
        summary: summary || null,
        error: stderrTail || `Agent 退出码：${result.exitCode}`,
        finishedAt,
        processId: null
      });
      emit("failed", {
        message: stderrTail || `Agent 退出码：${result.exitCode}`,
        exitCode: result.exitCode,
        ...taskVisibility(database.requireTask(task.id))
      });
      return;
    }

    if (task.mode === "analysis" && task.repositoryRoot !== null && analysisGitState !== null) {
      const after = runGit(["-C", task.repositoryRoot, "status", "--porcelain"]);
      if (after !== analysisGitState) {
        database.updateTask(task.id, {
          status: "failed",
          exitCode: result.exitCode,
          summary: summary || null,
          error: "分析任务修改了工作区，请人工检查并恢复相关变更。",
          finishedAt,
          processId: null
        });
        emit("failed", { message: "分析任务修改了工作区。", ...taskVisibility(database.requireTask(task.id)) });
        return;
      }
    }

    const committed = commitTaskChanges(task);
    database.updateTask(task.id, {
      status: "succeeded",
      exitCode: result.exitCode,
      summary: summary || "任务完成，但 Agent 未输出摘要。",
      error: null,
      commitHash: committed.commitHash,
      changedFiles: committed.changedFiles,
      finishedAt,
      processId: null
    });
    const completedTask = database.requireTask(task.id);
    emit("completed", {
      message: "任务完成。",
      summary: summary || "任务完成，但 Agent 未输出摘要。",
      agentSessionId: completedTask.agentSessionId,
      workspaceId: completedTask.targetWorkspaceId,
      workspaceName: completedTask.targetWorkspaceName,
      workspacePath: completedTask.targetWorkspacePath,
      workspaceKind: completedTask.targetWorkspaceKind,
      workspaceCreated: completedTask.targetWorkspaceCreated,
      sessionName: completedTask.agentSessionName
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const current = database.getTask(taskId);
    if (current !== null && current.status !== "canceled") {
      database.updateTask(taskId, {
        status: "failed",
        error: message,
        finishedAt: new Date().toISOString(),
        processId: null
      });
      emit("failed", { message, ...taskVisibility(database.requireTask(taskId)) });
    }
  } finally {
    database.close();
  }
}

function parseDshSession(line: string): {
  workspaceId: string;
  workspaceName: string;
  workspacePath: string;
  workspaceKind: "logical" | "worktree";
  workspaceCreated: boolean;
  sessionId: string;
  sessionName: string;
} | null {
  const marker = "MAB_DSH_SESSION:";
  const index = line.indexOf(marker);
  if (index < 0) return null;
  try {
    const value = JSON.parse(line.slice(index + marker.length).trim()) as Record<string, unknown>;
    if (![value.workspaceId, value.workspaceName, value.workspacePath, value.sessionId, value.sessionName].every((item) => typeof item === "string")
      || (value.workspaceKind !== "logical" && value.workspaceKind !== "worktree")
      || typeof value.workspaceCreated !== "boolean") {
      return null;
    }
    return {
      workspaceId: String(value.workspaceId),
      workspaceName: String(value.workspaceName),
      workspacePath: String(value.workspacePath),
      workspaceKind: value.workspaceKind,
      workspaceCreated: value.workspaceCreated,
      sessionId: String(value.sessionId),
      sessionName: String(value.sessionName)
    };
  } catch {
    return null;
  }
}

function taskVisibility(task: ReturnType<TaskDatabase["requireTask"]>): Record<string, unknown> {
  return {
    agentSessionId: task.agentSessionId,
    workspaceId: task.targetWorkspaceId,
    workspaceName: task.targetWorkspaceName ?? task.workspaceName,
    workspacePath: task.targetWorkspacePath,
    workspaceKind: task.targetWorkspaceKind,
    workspaceCreated: task.targetWorkspaceCreated,
    sessionName: task.agentSessionName ?? task.taskName
  };
}

function cleanAgentSummary(value: string): string {
  return value
    .split(/\r?\n/u)
    .filter((line) => !line.startsWith("MAB_DSH_SESSION:"))
    .join("\n")
    .trim();
}

function parseAgentEvent(line: string): { type: string; sessionId: string | null; progress: string | null; summary: string | null } | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const value = JSON.parse(trimmed) as Record<string, unknown>;
    const type = typeof value.type === "string" ? value.type : "event";
    const sessionId = typeof value.thread_id === "string"
      ? value.thread_id
      : typeof value.session_id === "string" ? value.session_id : null;
    const item = typeof value.item === "object" && value.item !== null ? value.item as Record<string, unknown> : null;
    const message = typeof value.message === "object" && value.message !== null ? value.message as Record<string, unknown> : null;
    const content = Array.isArray(message?.content) ? message.content as Array<Record<string, unknown>> : [];
    const messageText = content
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => String(part.text))
      .join("\n");
    const summary = typeof value.result === "string"
      ? value.result
      : item?.type === "agent_message" && typeof item.text === "string"
        ? item.text
        : messageText || null;
    const progressTypes = new Set(["thread.started", "turn.started", "turn.completed", "item.started", "item.completed", "assistant", "result", "error"]);
    const eventMessage = typeof value.message === "string" ? value.message : null;
    const progress = eventMessage ?? (progressTypes.has(type) ? `收到 ${type} 事件。` : null);
    return {
      type,
      sessionId,
      progress,
      summary
    };
  } catch {
    return null;
  }
}

if (process.argv[1] !== undefined && process.argv[1].endsWith("worker.js")) {
  const taskId = process.argv[2];
  if (taskId === undefined) throw new Error("缺少 taskId。");
  await runTask(taskId);
}
