import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { LoggingMessageNotificationSchema } from "@modelcontextprotocol/sdk/types.js";

test("MCP 可以列出公共工具并识别三端来源身份", async () => {
  const dataRoot = mkdtempSync(join(tmpdir(), "multi-agent-bridge-mcp-"));
  try {
    for (const originAgent of ["codex", "claude", "dsh"]) {
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [join(process.cwd(), "dist", "server.js")],
        env: {
          ...process.env,
          MAB_DATA_DIR: join(dataRoot, originAgent),
          MAB_ORIGIN_AGENT: originAgent,
          MAB_DISABLE_WORKER_SPAWN: "1",
          MAB_CODEX_COMMAND: process.execPath,
          MAB_CLAUDE_COMMAND: process.execPath,
          MAB_DSH_COMMAND: process.execPath
        }
      });
      const client = new Client({ name: `multi-agent-bridge-test-${originAgent}`, version: "1.0.0" });
      await client.connect(transport);
      try {
        const tools = await client.listTools();
        const names = tools.tools.map((tool) => tool.name);
        for (const expected of ["list_agents", "delegate_task", "delegate_batch", "get_callback_events", "respond_callback", "get_task", "wait_tasks", "list_tasks", "cancel_task", "release_task"]) {
          assert.ok(names.includes(expected), `缺少工具 ${expected}`);
        }
        const result = await client.callTool({ name: "list_agents", arguments: {} });
        assert.equal(result.isError, undefined);
        const payload = JSON.parse(result.content[0].text);
        assert.equal(payload.originAgent, originAgent);
      } finally {
        await client.close();
      }
    }
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("MCP 通过通知主动回传任务过程与结果", async () => {
  const dataRoot = mkdtempSync(join(tmpdir(), "multi-agent-bridge-mcp-callback-"));
  const workspace = join(dataRoot, "workspace");
  mkdirSync(workspace);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(process.cwd(), "dist", "server.js")],
    env: {
      ...process.env,
      MAB_DATA_DIR: join(dataRoot, "data"),
      MAB_ORIGIN_AGENT: "codex",
      MAB_DSH_COMMAND: join(process.cwd(), "test", "fixtures", "mock-dsh.mjs")
    }
  });
  const client = new Client({ name: "multi-agent-bridge-callback-test", version: "1.0.0" });
  const events = [];
  let finish;
  const finished = new Promise((resolvePromise) => { finish = resolvePromise; });
  client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
    if (notification.params.logger !== "multi-agent-bridge") return;
    events.push(notification.params.data);
    if (["completed", "failed", "canceled"].includes(notification.params.data?.type)) finish();
  });
  await client.connect(transport);
  await client.setLoggingLevel("debug");
  try {
    const result = await client.callTool({
      name: "delegate_task",
      arguments: { target_agent: "dsh", workspace, prompt: "MOCK_SLEEP=50", mode: "analysis" }
    });
    const payload = JSON.parse(result.content[0].text);
    assert.match(payload.task.callbackId, /^[0-9a-f-]{36}$/);
    await Promise.race([
      finished,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`等待 MCP 回调超时：${JSON.stringify(events)}`)), 5_000))
    ]);
    assert.deepEqual(events.map((event) => event.type), ["queued", "started", "completed"]);
  } finally {
    await client.close();
    rmSync(dataRoot, { recursive: true, force: true });
  }
});
