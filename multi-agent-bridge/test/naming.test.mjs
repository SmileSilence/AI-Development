import test from "node:test";
import assert from "node:assert/strict";
import { buildAdapterCommand, delegatedPrompt } from "../dist/adapters.js";
import { inferTaskName, resolveTaskNames } from "../dist/naming.js";

function task(overrides = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    callbackId: "00000000-0000-4000-8000-000000000002",
    agentSessionId: null,
    groupId: null,
    originAgent: "codex",
    targetAgent: "claude",
    workspace: "D:\\Work\\Project\\Demo",
    workspaceName: "演示项目",
    workspaceNameExplicit: true,
    taskName: "修复登录测试",
    targetWorkspaceId: null,
    targetWorkspaceName: null,
    targetWorkspacePath: null,
    targetWorkspaceKind: null,
    targetWorkspaceCreated: false,
    agentSessionName: null,
    repositoryRoot: null,
    runWorkspace: "D:\\Temp\\worktrees\\task-id",
    prompt: "修复登录测试并运行回归测试",
    mode: "write",
    timeoutSeconds: 900,
    status: "queued",
    rootTaskId: "00000000-0000-4000-8000-000000000001",
    delegationDepth: 0,
    chain: ["codex"],
    branch: null,
    worktree: null,
    baseHead: null,
    commitHash: null,
    changedFiles: [],
    processId: null,
    workerProcessId: null,
    cancelRequested: false,
    exitCode: null,
    summary: null,
    error: null,
    stdoutPath: null,
    stderrPath: null,
    createdAt: "2026-09-17T00:00:00.000Z",
    updatedAt: "2026-09-17T00:00:00.000Z",
    startedAt: null,
    finishedAt: null,
    ...overrides
  };
}

test("自动推导和显式覆盖可读名称", () => {
  assert.equal(inferTaskName("# 修复登录流程。\n补充测试"), "修复登录流程。");
  const automatic = resolveTaskNames("D:\\Work\\Project\\Demo", "- 审查当前架构并给出风险");
  assert.equal(automatic.workspaceName, "Demo");
  assert.equal(automatic.taskName, "审查当前架构并给出风险");
  assert.equal(automatic.workspaceNameExplicit, false);

  const explicit = resolveTaskNames("D:\\Work\\Project\\Demo", "任务", "产品后台", "核对权限模型");
  assert.deepEqual(explicit, {
    workspaceName: "产品后台",
    workspaceNameExplicit: true,
    taskName: "核对权限模型"
  });
  assert.throws(() => resolveTaskNames("D:\\Work\\Project\\Demo", "任务", "   "), /workspace_name 不能为空/);
  assert.throws(() => resolveTaskNames("D:\\Work\\Project\\Demo", "任务", "x".repeat(81)), /不能超过 80 个字符/);
  assert.equal(resolveTaskNames("D:\\Work\\Project\\Demo", "x".repeat(100)).taskName.length, 80);
});

test("Claude、Codex 与 DSH 使用同一组可读名称和分离路径", () => {
  process.env.MAB_CLAUDE_COMMAND = process.execPath;
  process.env.MAB_CODEX_COMMAND = process.execPath;
  delete process.env.MAB_DSH_COMMAND;
  process.env.MAB_PYTHON_COMMAND = process.execPath;
  const base = task();

  const claude = buildAdapterCommand(base);
  assert.equal(claude.args[claude.args.indexOf("--name") + 1], "演示项目 · 修复登录测试");

  const codexTask = task({ targetAgent: "codex" });
  const prompt = delegatedPrompt(codexTask);
  assert.ok(prompt.startsWith("任务：修复登录测试\n"));
  assert.match(prompt, /原始项目工作区：D:\\Work\\Project\\Demo/);
  assert.match(prompt, /实际执行目录：D:\\Temp\\worktrees\\task-id/);

  const dsh = buildAdapterCommand(task({ targetAgent: "dsh" }));
  assert.equal(dsh.args[dsh.args.indexOf("--workspace") + 1], "D:\\Work\\Project\\Demo");
  assert.equal(dsh.args[dsh.args.indexOf("--run-cwd") + 1], "D:\\Temp\\worktrees\\task-id");
  assert.equal(dsh.args[dsh.args.indexOf("--workspace-name") + 1], "演示项目");
  assert.ok(dsh.args.includes("--workspace-name-explicit"));
  assert.equal(dsh.args[dsh.args.indexOf("--task-name") + 1], "修复登录测试");
});
