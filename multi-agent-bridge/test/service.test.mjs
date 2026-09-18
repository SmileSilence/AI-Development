import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BridgeService } from "../dist/service.js";
import { loadConfig } from "../dist/config.js";
import { prepareWriteWorktree, releaseWorktree } from "../dist/worktree.js";
import { runGit } from "../dist/utils.js";

function withTestEnvironment(originAgent = "codex") {
  const root = mkdtempSync(join(tmpdir(), "multi-agent-bridge-test-"));
  process.env.MAB_DATA_DIR = join(root, "data");
  process.env.MAB_DISABLE_WORKER_SPAWN = "1";
  process.env.MAB_ORIGIN_AGENT = originAgent;
  process.env.MAB_CODEX_COMMAND = process.execPath;
  process.env.MAB_CLAUDE_COMMAND = process.execPath;
  process.env.MAB_DSH_COMMAND = process.execPath;
  return { root, service: new BridgeService(loadConfig()) };
}

async function waitForStatus(service, taskId, expected, timeoutMilliseconds = 8_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    const task = service.getTask(taskId);
    if (expected.includes(task.status)) return task;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`等待任务状态超时：${taskId} -> ${expected.join(", ")}`);
}

test("创建任务并按来源、目标和状态查询", () => {
  const { root, service } = withTestEnvironment();
  const workspace = join(root, "workspace");
  mkdirSync(workspace);
  try {
    const task = service.delegateTask({ targetAgent: "claude", workspace, prompt: "检查项目结构", mode: "analysis" });
    assert.equal(task.originAgent, "codex");
    assert.equal(task.targetAgent, "claude");
    assert.equal(task.workspaceName, "workspace");
    assert.equal(task.taskName, "检查项目结构");
    assert.equal(task.workspaceNameExplicit, false);
    assert.equal(task.status, "queued");
    assert.equal(service.listTasks({ originAgent: "codex", status: "queued" }).length, 1);
  } finally {
    service.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("持久化显式工作区名和任务名，并支持批量任务独立命名", () => {
  const { root, service } = withTestEnvironment();
  const workspace = join(root, "workspace");
  mkdirSync(workspace);
  try {
    const task = service.delegateTask({
      targetAgent: "claude",
      workspace,
      workspaceName: "支付服务",
      taskName: "检查退款边界",
      prompt: "检查退款边界并报告风险",
      mode: "analysis"
    });
    assert.equal(service.getTask(task.id).workspaceName, "支付服务");
    assert.equal(service.getTask(task.id).taskName, "检查退款边界");
    assert.equal(service.getTask(task.id).workspaceNameExplicit, true);

    const batch = service.delegateBatch(undefined, [{
      targetAgent: "dsh",
      workspace,
      workspaceName: "支付服务",
      taskName: "验证退款测试",
      prompt: "执行退款测试",
      mode: "analysis"
    }]);
    assert.equal(batch.tasks[0].taskName, "验证退款测试");
  } finally {
    service.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("拒绝同 Agent、自定义来源冲突与递归委派", () => {
  const { root, service } = withTestEnvironment();
  const workspace = join(root, "workspace");
  mkdirSync(workspace);
  try {
    assert.throws(() => service.delegateTask({ targetAgent: "codex", workspace, prompt: "x", mode: "analysis" }), /不能相同/);
    assert.throws(() => service.delegateTask({ originAgent: "dsh", targetAgent: "claude", workspace, prompt: "x", mode: "analysis" }), /身份不一致/);
    service.close();
    process.env.MAB_DELEGATION_DEPTH = "1";
    const childService = new BridgeService(loadConfig());
    try {
      assert.throws(() => childService.delegateTask({ targetAgent: "claude", workspace, prompt: "x", mode: "analysis" }), /禁止继续递归委派/);
    } finally {
      childService.close();
      delete process.env.MAB_DELEGATION_DEPTH;
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("批量委派共享 groupId", () => {
  const { root, service } = withTestEnvironment();
  const workspace = join(root, "workspace");
  mkdirSync(workspace);
  try {
    const result = service.delegateBatch(undefined, [
      { targetAgent: "claude", workspace, prompt: "审查", mode: "analysis" },
      { targetAgent: "dsh", workspace, prompt: "验证", mode: "analysis" }
    ]);
    assert.equal(result.tasks.length, 2);
    assert.ok(result.tasks.every((task) => task.groupId === result.groupId));
  } finally {
    service.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("并发上限为 3，额外任务保持排队", () => {
  const { root, service } = withTestEnvironment();
  const workspace = join(root, "workspace");
  mkdirSync(workspace);
  try {
    const tasks = Array.from({ length: 4 }, (_, index) => service.delegateTask({
      targetAgent: index % 2 === 0 ? "claude" : "dsh",
      workspace,
      prompt: `任务 ${index}`,
      mode: "analysis"
    }));
    assert.equal(service.tasks.tryClaimTask(tasks[0].id), true);
    assert.equal(service.tasks.tryClaimTask(tasks[1].id), true);
    assert.equal(service.tasks.tryClaimTask(tasks[2].id), true);
    assert.equal(service.tasks.tryClaimTask(tasks[3].id), false);
    assert.equal(service.getTask(tasks[3].id).status, "queued");
  } finally {
    service.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("覆盖三种来源 Agent 的六个委派方向", () => {
  const matrix = {
    codex: ["claude", "dsh"],
    claude: ["codex", "dsh"],
    dsh: ["codex", "claude"]
  };
  for (const [origin, targets] of Object.entries(matrix)) {
    const { root, service } = withTestEnvironment(origin);
    const workspace = join(root, "workspace");
    mkdirSync(workspace);
    try {
      for (const target of targets) {
        const task = service.delegateTask({ targetAgent: target, workspace, prompt: `${origin} -> ${target}`, mode: "analysis" });
        assert.equal(task.originAgent, origin);
        assert.equal(task.targetAgent, target);
      }
    } finally {
      service.close();
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test("兼容旧 Claude Desktop 与 Claude Code 来源标识", () => {
  for (const legacyOrigin of ["claude-desktop", "claude-code"]) {
    const { root, service } = withTestEnvironment(legacyOrigin);
    const workspace = join(root, "workspace");
    mkdirSync(workspace);
    try {
      const task = service.delegateTask({ targetAgent: "codex", workspace, prompt: "兼容检查", mode: "analysis" });
      assert.equal(task.originAgent, "claude");
    } finally {
      service.close();
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test("回调模式主动推送排队、启动和完成事件，并可在重连后补取", async () => {
  const root = mkdtempSync(join(tmpdir(), "multi-agent-bridge-callback-"));
  const workspace = join(root, "workspace");
  mkdirSync(workspace);
  process.env.MAB_DATA_DIR = join(root, "data");
  process.env.MAB_ORIGIN_AGENT = "codex";
  process.env.MAB_CALLBACK_MODE = "1";
  process.env.MAB_DSH_COMMAND = join(process.cwd(), "test", "fixtures", "mock-dsh.mjs");
  delete process.env.MAB_DISABLE_WORKER_SPAWN;
  const service = new BridgeService(loadConfig());
  const pushed = [];
  try {
    const task = service.delegateTask(
      { targetAgent: "dsh", workspace, prompt: "MOCK_SLEEP=50", mode: "analysis" },
      null,
      (event) => pushed.push(event)
    );
    const completed = await waitForStatus(service, task.id, ["succeeded"]);
    assert.equal(completed.callbackId, task.callbackId);
    assert.deepEqual(pushed.map((event) => event.type), ["queued", "started", "completed"]);
    assert.deepEqual(
      service.getCallbackEvents(task.callbackId).map((event) => event.type),
      ["queued", "started", "completed"]
    );
  } finally {
    service.close();
    process.env.MAB_DISABLE_WORKER_SPAWN = "1";
    delete process.env.MAB_CALLBACK_MODE;
    rmSync(root, { recursive: true, force: true });
  }
});

test("目标 Agent 的问题会通过 question 回调主动返回", async () => {
  const root = mkdtempSync(join(tmpdir(), "multi-agent-bridge-question-"));
  const workspace = join(root, "workspace");
  mkdirSync(workspace);
  process.env.MAB_DATA_DIR = join(root, "data");
  process.env.MAB_ORIGIN_AGENT = "codex";
  process.env.MAB_CALLBACK_MODE = "1";
  process.env.MAB_DSH_COMMAND = join(process.cwd(), "test", "fixtures", "mock-dsh.mjs");
  delete process.env.MAB_DISABLE_WORKER_SPAWN;
  const service = new BridgeService(loadConfig());
  const pushed = [];
  try {
    const task = service.delegateTask(
      { targetAgent: "dsh", workspace, prompt: "MOCK_QUESTION MOCK_SLEEP=50", mode: "analysis" },
      null,
      (event) => pushed.push(event)
    );
    await waitForStatus(service, task.id, ["succeeded"]);
    assert.deepEqual(pushed.map((event) => event.type), ["queued", "started", "question", "completed"]);
    assert.equal(pushed.find((event) => event.type === "question").payload.message, "是否继续？");
  } finally {
    service.close();
    process.env.MAB_DISABLE_WORKER_SPAWN = "1";
    delete process.env.MAB_CALLBACK_MODE;
    rmSync(root, { recursive: true, force: true });
  }
});

test("启动服务时清理超过保留期且已释放的终态任务", () => {
  const { root, service } = withTestEnvironment();
  const workspace = join(root, "workspace");
  mkdirSync(workspace);
  const task = service.delegateTask({ targetAgent: "claude", workspace, prompt: "旧任务", mode: "analysis" });
  service.tasks.database.prepare(`
    UPDATE tasks SET status = 'succeeded', finished_at = '2000-01-01T00:00:00.000Z'
    WHERE id = ?
  `).run(task.id);
  service.close();
  const reopened = new BridgeService(loadConfig());
  try {
    assert.equal(reopened.tasks.getTask(task.id), null);
  } finally {
    reopened.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("后台 worker 在发起端关闭后继续运行，并支持超时与取消", async () => {
  const root = mkdtempSync(join(tmpdir(), "multi-agent-bridge-worker-"));
  const workspace = join(root, "workspace");
  mkdirSync(workspace);
  process.env.MAB_DATA_DIR = join(root, "data");
  process.env.MAB_ORIGIN_AGENT = "codex";
  process.env.MAB_DSH_COMMAND = join(process.cwd(), "test", "fixtures", "mock-dsh.mjs");
  delete process.env.MAB_DISABLE_WORKER_SPAWN;

  const launcher = new BridgeService(loadConfig());
  const survivingTask = launcher.delegateTask({ targetAgent: "dsh", workspace, prompt: "MOCK_SLEEP=200", mode: "analysis" });
  launcher.close();

  const observer = new BridgeService(loadConfig());
  try {
    const succeeded = await waitForStatus(observer, survivingTask.id, ["succeeded"]);
    assert.match(succeeded.summary, /模拟 Agent 已完成/);

    const timeoutTask = observer.delegateTask({ targetAgent: "dsh", workspace, prompt: "MOCK_SLEEP=2000", mode: "analysis", timeoutSeconds: 1 });
    const timedOut = await waitForStatus(observer, timeoutTask.id, ["failed"]);
    assert.match(timedOut.error, /超过 1 秒/);

    const cancelTask = observer.delegateTask({ targetAgent: "dsh", workspace, prompt: "MOCK_SLEEP=5000", mode: "analysis" });
    await waitForStatus(observer, cancelTask.id, ["running"]);
    observer.cancelTask(cancelTask.id);
    const canceled = await waitForStatus(observer, cancelTask.id, ["canceled"]);
    assert.equal(canceled.cancelRequested, true);
  } finally {
    observer.close();
    process.env.MAB_DISABLE_WORKER_SPAWN = "1";
    rmSync(root, { recursive: true, force: true });
  }
});

test("写入任务创建并释放独立 Git worktree", () => {
  const { root, service } = withTestEnvironment();
  const repository = join(root, "repository");
  mkdirSync(repository);
  runGit(["init", "-q", repository]);
  writeFileSync(join(repository, "README.md"), "# test\n", "utf8");
  runGit(["-C", repository, "add", "README.md"]);
  runGit(["-C", repository, "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "init"]);
  try {
    const task = service.delegateTask({ targetAgent: "claude", workspace: repository, prompt: "修改", mode: "write" });
    const info = prepareWriteWorktree(service.config, task);
    assert.notEqual(info.worktree, repository);
    assert.match(info.branch, /^multi-agent\/claude\//);
    releaseWorktree(service.config, { ...task, ...info }, false);
    assert.throws(() => runGit(["-C", repository, "show-ref", "--verify", `refs/heads/${info.branch}`]));
  } finally {
    service.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("DSH Gateway 释放失败时保留 worktree 供重试", async () => {
  const { root, service } = withTestEnvironment();
  const repository = join(root, "repository");
  mkdirSync(repository);
  runGit(["init", "-q", repository]);
  writeFileSync(join(repository, "README.md"), "# test\n", "utf8");
  runGit(["-C", repository, "add", "README.md"]);
  runGit(["-C", repository, "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "init"]);
  const previousPython = process.env.MAB_PYTHON_COMMAND;
  let prepared;
  try {
    const task = service.delegateTask({ targetAgent: "dsh", workspace: repository, prompt: "修改", mode: "write" });
    prepared = prepareWriteWorktree(service.config, task);
    service.tasks.updateTask(task.id, {
      status: "succeeded",
      worktree: prepared.worktree,
      runWorkspace: prepared.runWorkspace,
      branch: prepared.branch,
      targetWorkspaceId: "workspace-task",
      targetWorkspaceName: "repository · 修改",
      targetWorkspacePath: prepared.worktree,
      targetWorkspaceKind: "worktree",
      targetWorkspaceCreated: true,
      agentSessionId: "session-task"
    });
    process.env.MAB_PYTHON_COMMAND = join(root, "missing-python.exe");
    await assert.rejects(service.releaseTask(task.id), /ENOENT|spawn/);
    assert.equal(existsSync(prepared.worktree), true);
    assert.equal(service.getTask(task.id).worktree, prepared.worktree);
  } finally {
    if (prepared !== undefined && existsSync(prepared.worktree)) {
      releaseWorktree(service.config, { ...service.getTask(service.listTasks({ limit: 1 })[0].id), ...prepared }, true);
    }
    if (previousPython === undefined) delete process.env.MAB_PYTHON_COMMAND;
    else process.env.MAB_PYTHON_COMMAND = previousPython;
    service.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("拒绝非 Git 目录和脏工作区的写入准备", () => {
  const { root, service } = withTestEnvironment();
  const plainDirectory = join(root, "plain");
  mkdirSync(plainDirectory);
  try {
    const nonGitTask = service.delegateTask({ targetAgent: "claude", workspace: plainDirectory, prompt: "修改", mode: "write" });
    assert.throws(() => prepareWriteWorktree(service.config, nonGitTask));

    const repository = join(root, "dirty-repository");
    mkdirSync(repository);
    runGit(["init", "-q", repository]);
    writeFileSync(join(repository, "README.md"), "# test\n", "utf8");
    runGit(["-C", repository, "add", "README.md"]);
    runGit(["-C", repository, "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "init"]);
    writeFileSync(join(repository, "dirty.txt"), "dirty\n", "utf8");
    const dirtyTask = service.delegateTask({ targetAgent: "claude", workspace: repository, prompt: "修改", mode: "write" });
    assert.throws(() => prepareWriteWorktree(service.config, dirtyTask), /干净的 Git 工作区/);
  } finally {
    service.close();
    rmSync(root, { recursive: true, force: true });
  }
});
