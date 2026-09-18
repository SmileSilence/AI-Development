import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { AgentName, CallbackEvent, CallbackEventType, CreateTaskInput, TargetWorkspaceKind, TaskRecord, TaskStatus } from "./types.js";
import { ensureDirectory } from "./utils.js";
import type { BridgeConfig } from "./config.js";

type Row = Record<string, unknown>;

export class TaskDatabase {
  readonly database: DatabaseSync;

  constructor(private readonly config: BridgeConfig) {
    ensureDirectory(config.dataRoot);
    this.database = new DatabaseSync(config.databasePath);
    this.database.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        callback_id TEXT NOT NULL UNIQUE,
        agent_session_id TEXT,
        group_id TEXT,
        origin_agent TEXT NOT NULL,
        target_agent TEXT NOT NULL,
        workspace TEXT NOT NULL,
        workspace_name TEXT,
        workspace_name_explicit INTEGER NOT NULL DEFAULT 0,
        task_name TEXT,
        target_workspace_id TEXT,
        target_workspace_name TEXT,
        target_workspace_path TEXT,
        target_workspace_kind TEXT,
        target_workspace_created INTEGER NOT NULL DEFAULT 0,
        agent_session_name TEXT,
        repository_root TEXT,
        run_workspace TEXT,
        prompt TEXT NOT NULL,
        mode TEXT NOT NULL,
        timeout_seconds INTEGER NOT NULL,
        status TEXT NOT NULL,
        root_task_id TEXT NOT NULL,
        delegation_depth INTEGER NOT NULL,
        chain_json TEXT NOT NULL,
        branch TEXT,
        worktree TEXT,
        base_head TEXT,
        commit_hash TEXT,
        changed_files_json TEXT NOT NULL DEFAULT '[]',
        process_id INTEGER,
        worker_process_id INTEGER,
        cancel_requested INTEGER NOT NULL DEFAULT 0,
        exit_code INTEGER,
        summary TEXT,
        error TEXT,
        stdout_path TEXT,
        stderr_path TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace);
      CREATE INDEX IF NOT EXISTS idx_tasks_group ON tasks(group_id);
    `);
    for (const statement of [
      "ALTER TABLE tasks ADD COLUMN callback_id TEXT",
      "ALTER TABLE tasks ADD COLUMN agent_session_id TEXT",
      "ALTER TABLE tasks ADD COLUMN workspace_name TEXT",
      "ALTER TABLE tasks ADD COLUMN workspace_name_explicit INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE tasks ADD COLUMN task_name TEXT",
      "ALTER TABLE tasks ADD COLUMN target_workspace_id TEXT",
      "ALTER TABLE tasks ADD COLUMN target_workspace_name TEXT",
      "ALTER TABLE tasks ADD COLUMN target_workspace_path TEXT",
      "ALTER TABLE tasks ADD COLUMN target_workspace_kind TEXT",
      "ALTER TABLE tasks ADD COLUMN target_workspace_created INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE tasks ADD COLUMN agent_session_name TEXT"
    ]) {
      try { this.database.exec(statement); } catch { /* 已存在时忽略迁移错误。 */ }
    }
    this.database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_callback_id ON tasks(callback_id);");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS callback_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        callback_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_callback_events_callback ON callback_events(callback_id, id);
    `);
  }

  close(): void {
    this.database.close();
  }

  createTask(input: CreateTaskInput): TaskRecord {
    const id = randomUUID();
    const callbackId = randomUUID();
    const now = new Date().toISOString();
    const rootTaskId = input.rootTaskId ?? id;
    this.database.prepare(`
      INSERT INTO tasks (
        id, callback_id, group_id, origin_agent, target_agent, workspace,
        workspace_name, workspace_name_explicit, task_name, prompt, mode,
        timeout_seconds, status, root_task_id, delegation_depth, chain_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?)
    `).run(
      id,
      callbackId,
      input.groupId ?? null,
      input.originAgent,
      input.targetAgent,
      input.workspace,
      input.workspaceName,
      input.workspaceNameExplicit ? 1 : 0,
      input.taskName,
      input.prompt,
      input.mode,
      input.timeoutSeconds,
      rootTaskId,
      input.delegationDepth,
      JSON.stringify(input.chain),
      now,
      now
    );
    return this.requireTask(id);
  }

  getTask(id: string): TaskRecord | null {
    const row = this.database.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Row | undefined;
    return row === undefined ? null : mapRow(row);
  }

  getTaskByCallbackId(callbackId: string): TaskRecord | null {
    const row = this.database.prepare("SELECT * FROM tasks WHERE callback_id = ?").get(callbackId) as Row | undefined;
    return row === undefined ? null : mapRow(row);
  }

  requireTask(id: string): TaskRecord {
    const task = this.getTask(id);
    if (task === null) throw new Error(`找不到任务：${id}`);
    return task;
  }

  listTasks(filters: {
    workspace?: string;
    originAgent?: AgentName;
    targetAgent?: AgentName;
    status?: TaskStatus;
    limit?: number;
  }): TaskRecord[] {
    const clauses: string[] = [];
    const values: Array<string | number | null> = [];
    if (filters.workspace !== undefined) {
      clauses.push("workspace = ?");
      values.push(filters.workspace);
    }
    if (filters.originAgent !== undefined) {
      clauses.push("origin_agent = ?");
      values.push(filters.originAgent);
    }
    if (filters.targetAgent !== undefined) {
      clauses.push("target_agent = ?");
      values.push(filters.targetAgent);
    }
    if (filters.status !== undefined) {
      clauses.push("status = ?");
      values.push(filters.status);
    }
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.database.prepare(`SELECT * FROM tasks ${where} ORDER BY created_at DESC LIMIT ?`).all(...values, limit) as Row[];
    return rows.map(mapRow);
  }

  tryClaimTask(id: string): boolean {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const task = this.getTask(id);
      if (task === null || task.status !== "queued" || task.cancelRequested) {
        this.database.exec("ROLLBACK");
        return false;
      }
      const row = this.database.prepare("SELECT COUNT(*) AS count FROM tasks WHERE status = 'running'").get() as { count: number };
      if (Number(row.count) >= this.config.concurrency) {
        this.database.exec("ROLLBACK");
        return false;
      }
      const now = new Date().toISOString();
      this.database.prepare("UPDATE tasks SET status = 'running', started_at = ?, updated_at = ? WHERE id = ?").run(now, now, id);
      this.database.exec("COMMIT");
      return true;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  updateTask(id: string, changes: Partial<{
    agentSessionId: string | null;
    targetWorkspaceId: string | null;
    targetWorkspaceName: string | null;
    targetWorkspacePath: string | null;
    targetWorkspaceKind: TargetWorkspaceKind | null;
    targetWorkspaceCreated: boolean;
    agentSessionName: string | null;
    repositoryRoot: string | null;
    runWorkspace: string | null;
    branch: string | null;
    worktree: string | null;
    baseHead: string | null;
    commitHash: string | null;
    changedFiles: string[];
    processId: number | null;
    workerProcessId: number | null;
    exitCode: number | null;
    summary: string | null;
    error: string | null;
    stdoutPath: string | null;
    stderrPath: string | null;
    status: TaskStatus;
    cancelRequested: boolean;
    finishedAt: string | null;
  }>): TaskRecord {
    const columns: string[] = [];
    const values: Array<string | number | null> = [];
    const mapping: Record<string, string> = {
      repositoryRoot: "repository_root",
      agentSessionId: "agent_session_id",
      targetWorkspaceId: "target_workspace_id",
      targetWorkspaceName: "target_workspace_name",
      targetWorkspacePath: "target_workspace_path",
      targetWorkspaceKind: "target_workspace_kind",
      targetWorkspaceCreated: "target_workspace_created",
      agentSessionName: "agent_session_name",
      runWorkspace: "run_workspace",
      branch: "branch",
      worktree: "worktree",
      baseHead: "base_head",
      commitHash: "commit_hash",
      processId: "process_id",
      workerProcessId: "worker_process_id",
      exitCode: "exit_code",
      summary: "summary",
      error: "error",
      stdoutPath: "stdout_path",
      stderrPath: "stderr_path",
      status: "status",
      cancelRequested: "cancel_requested",
      finishedAt: "finished_at"
    };
    for (const [key, column] of Object.entries(mapping)) {
      if (key in changes) {
        columns.push(`${column} = ?`);
        const value = changes[key as keyof typeof changes] as string | number | boolean | null | undefined;
        values.push(typeof value === "boolean" ? (value ? 1 : 0) : value ?? null);
      }
    }
    if (changes.changedFiles !== undefined) {
      columns.push("changed_files_json = ?");
      values.push(JSON.stringify(changes.changedFiles));
    }
    if (columns.length === 0) return this.requireTask(id);
    columns.push("updated_at = ?");
    values.push(new Date().toISOString(), id);
    this.database.prepare(`UPDATE tasks SET ${columns.join(", ")} WHERE id = ?`).run(...values);
    return this.requireTask(id);
  }

  appendCallback(taskId: string, type: CallbackEventType, payload: Record<string, unknown> = {}): CallbackEvent {
    const task = this.requireTask(taskId);
    const createdAt = new Date().toISOString();
    const result = this.database.prepare(`
      INSERT INTO callback_events (callback_id, task_id, type, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(task.callbackId, taskId, type, JSON.stringify(payload), createdAt);
    return { id: Number(result.lastInsertRowid), callbackId: task.callbackId, taskId, type, payload, createdAt };
  }

  listCallbacks(callbackId: string, afterEventId = 0, limit = 100): CallbackEvent[] {
    const rows = this.database.prepare(`
      SELECT * FROM callback_events WHERE callback_id = ? AND id > ? ORDER BY id LIMIT ?
    `).all(callbackId, afterEventId, Math.min(Math.max(limit, 1), 500)) as Row[];
    return rows.map((row) => ({
      id: Number(row.id), callbackId: String(row.callback_id), taskId: String(row.task_id),
      type: String(row.type) as CallbackEventType,
      payload: JSON.parse(String(row.payload_json)) as Record<string, unknown>,
      createdAt: String(row.created_at)
    }));
  }

  requestCancel(id: string): TaskRecord {
    const task = this.requireTask(id);
    const now = new Date().toISOString();
    if (task.status === "queued") {
      return this.updateTask(id, { cancelRequested: true, status: "canceled", finishedAt: now, error: "任务在启动前被取消。" });
    }
    if (task.status === "running") return this.updateTask(id, { cancelRequested: true });
    return task;
  }

  markStaleRunningTasks(): number {
    const now = new Date().toISOString();
    const result = this.database.prepare(`
      UPDATE tasks SET status = 'failed', error = '后台 worker 异常退出或服务重启后未恢复。',
        finished_at = ?, updated_at = ?
      WHERE status = 'running' AND worker_process_id IS NULL
    `).run(now, now);
    return Number(result.changes);
  }

  purgeExpiredTasks(retentionDays: number): TaskRecord[] {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const rows = this.database.prepare(`
      SELECT * FROM tasks
      WHERE status IN ('succeeded', 'failed', 'canceled')
        AND finished_at IS NOT NULL
        AND finished_at < ?
        AND worktree IS NULL
    `).all(cutoff) as Row[];
    if (rows.length === 0) return [];
    const remove = this.database.prepare("DELETE FROM tasks WHERE id = ?");
    this.database.exec("BEGIN IMMEDIATE");
    try {
      for (const row of rows) remove.run(String(row.id));
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return rows.map(mapRow);
  }
}

function mapRow(row: Row): TaskRecord {
  return {
    id: String(row.id),
    callbackId: String(row.callback_id ?? row.id),
    agentSessionId: nullableString(row.agent_session_id),
    groupId: nullableString(row.group_id),
    originAgent: String(row.origin_agent) as AgentName,
    targetAgent: String(row.target_agent) as AgentName,
    workspace: String(row.workspace),
    workspaceName: nullableString(row.workspace_name) ?? fallbackWorkspaceName(String(row.workspace)),
    workspaceNameExplicit: Number(row.workspace_name_explicit) === 1,
    taskName: nullableString(row.task_name) ?? fallbackTaskName(String(row.prompt)),
    targetWorkspaceId: nullableString(row.target_workspace_id),
    targetWorkspaceName: nullableString(row.target_workspace_name),
    targetWorkspacePath: nullableString(row.target_workspace_path),
    targetWorkspaceKind: nullableWorkspaceKind(row.target_workspace_kind),
    targetWorkspaceCreated: Number(row.target_workspace_created) === 1,
    agentSessionName: nullableString(row.agent_session_name),
    repositoryRoot: nullableString(row.repository_root),
    runWorkspace: nullableString(row.run_workspace),
    prompt: String(row.prompt),
    mode: String(row.mode) as TaskRecord["mode"],
    timeoutSeconds: Number(row.timeout_seconds),
    status: String(row.status) as TaskStatus,
    rootTaskId: String(row.root_task_id),
    delegationDepth: Number(row.delegation_depth),
    chain: JSON.parse(String(row.chain_json)) as AgentName[],
    branch: nullableString(row.branch),
    worktree: nullableString(row.worktree),
    baseHead: nullableString(row.base_head),
    commitHash: nullableString(row.commit_hash),
    changedFiles: JSON.parse(String(row.changed_files_json ?? "[]")) as string[],
    processId: nullableNumber(row.process_id),
    workerProcessId: nullableNumber(row.worker_process_id),
    cancelRequested: Number(row.cancel_requested) === 1,
    exitCode: nullableNumber(row.exit_code),
    summary: nullableString(row.summary),
    error: nullableString(row.error),
    stdoutPath: nullableString(row.stdout_path),
    stderrPath: nullableString(row.stderr_path),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    startedAt: nullableString(row.started_at),
    finishedAt: nullableString(row.finished_at)
  };
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function nullableWorkspaceKind(value: unknown): TargetWorkspaceKind | null {
  return value === "logical" || value === "worktree" ? value : null;
}

function fallbackWorkspaceName(workspace: string): string {
  const parts = workspace.replace(/[\\/]+$/u, "").split(/[\\/]/u);
  return parts.at(-1) || "未命名项目";
}

function fallbackTaskName(prompt: string): string {
  const firstLine = prompt.split(/\r?\n/u).find((line) => line.trim() !== "")?.trim() ?? "未命名任务";
  return firstLine.length <= 80 ? firstLine : `${firstLine.slice(0, 79)}…`;
}
