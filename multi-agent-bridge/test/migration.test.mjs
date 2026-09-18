import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskDatabase } from "../dist/database.js";
import { loadConfig } from "../dist/config.js";

test("旧数据库自动增加命名字段并兼容读取历史记录", () => {
  const root = mkdtempSync(join(tmpdir(), "multi-agent-bridge-migration-"));
  const dataRoot = join(root, "data");
  mkdirSync(dataRoot);
  process.env.MAB_DATA_DIR = dataRoot;
  const config = loadConfig();
  const legacy = new DatabaseSync(config.databasePath);
  legacy.exec(`
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY, callback_id TEXT UNIQUE, agent_session_id TEXT, group_id TEXT,
      origin_agent TEXT NOT NULL, target_agent TEXT NOT NULL, workspace TEXT NOT NULL,
      repository_root TEXT, run_workspace TEXT, prompt TEXT NOT NULL, mode TEXT NOT NULL,
      timeout_seconds INTEGER NOT NULL, status TEXT NOT NULL, root_task_id TEXT NOT NULL,
      delegation_depth INTEGER NOT NULL, chain_json TEXT NOT NULL, branch TEXT, worktree TEXT,
      base_head TEXT, commit_hash TEXT, changed_files_json TEXT NOT NULL DEFAULT '[]',
      process_id INTEGER, worker_process_id INTEGER, cancel_requested INTEGER NOT NULL DEFAULT 0,
      exit_code INTEGER, summary TEXT, error TEXT, stdout_path TEXT, stderr_path TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, started_at TEXT, finished_at TEXT
    );
  `);
  legacy.prepare(`
    INSERT INTO tasks (
      id, callback_id, origin_agent, target_agent, workspace, prompt, mode, timeout_seconds,
      status, root_task_id, delegation_depth, chain_json, created_at, updated_at
    ) VALUES (?, ?, 'codex', 'dsh', ?, ?, 'analysis', 900, 'succeeded', ?, 0, '["codex"]', ?, ?)
  `).run(
    "00000000-0000-4000-8000-000000000010",
    "00000000-0000-4000-8000-000000000011",
    join(root, "legacy-project"),
    "检查旧任务兼容性",
    "00000000-0000-4000-8000-000000000010",
    "2026-01-01T00:00:00.000Z",
    "2026-01-01T00:00:00.000Z"
  );
  legacy.close();

  const database = new TaskDatabase(config);
  try {
    const columns = database.database.prepare("PRAGMA table_info(tasks)").all().map((column) => column.name);
    for (const expected of ["workspace_name", "workspace_name_explicit", "task_name", "target_workspace_id", "target_workspace_name", "target_workspace_path", "target_workspace_kind", "target_workspace_created", "agent_session_name"]) {
      assert.ok(columns.includes(expected), `缺少迁移字段 ${expected}`);
    }
    const task = database.requireTask("00000000-0000-4000-8000-000000000010");
    assert.equal(task.workspaceName, "legacy-project");
    assert.equal(task.taskName, "检查旧任务兼容性");
    assert.equal(task.targetWorkspacePath, null);
    assert.equal(task.targetWorkspaceKind, null);
    assert.equal(task.targetWorkspaceCreated, false);
  } finally {
    database.close();
    rmSync(root, { recursive: true, force: true });
  }
});
