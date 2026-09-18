import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { BridgeService, publicTask } from "./service.js";
import { jsonText } from "./utils.js";

// MCP 连接存续期间由事件回调驱动任务，不启动独立的服务端监控循环。
process.env.MAB_CALLBACK_MODE = "1";
const service = new BridgeService();
const server = new McpServer(
  { name: "multi-agent-bridge", version: "1.4.0" },
  { capabilities: { logging: {} } }
);

const agentSchema = z.enum(["codex", "claude", "dsh"]);
const modeSchema = z.enum(["analysis", "write"]);
const statusSchema = z.enum(["queued", "running", "succeeded", "failed", "canceled"]);

function safeTool<T>(handler: () => T | Promise<T>): Promise<ReturnType<typeof jsonText> & { isError?: boolean }> {
  return Promise.resolve()
    .then(handler)
    .then((value) => jsonText(value))
    .catch((error: unknown) => ({
      ...jsonText({ error: error instanceof Error ? error.message : String(error) }),
      isError: true
    }));
}

function callbackSink() {
  return (event: unknown): Promise<void> => server.sendLoggingMessage({
    level: "info",
    logger: "multi-agent-bridge",
    data: event
  });
}

server.tool(
  "list_agents",
  "列出 Codex、Claude、DSH 的可用状态和支持模式。",
  {},
  async () => safeTool(() => ({ originAgent: service.config.originAgent ?? null, agents: service.listAgents() }))
);

server.tool(
  "delegate_task",
  "委派单个 Agent 任务；返回 task_id 和 callback_id，并通过 MCP 通知主动推送进度与结果。",
  {
    origin_agent: agentSchema.optional().describe("来源 Agent；已通过 MCP 环境识别时可省略。"),
    target_agent: agentSchema,
    workspace: z.string().min(1),
    workspace_name: z.string().min(1).max(80).optional().describe("界面显示的项目工作区名称；省略时从目录名推导。"),
    task_name: z.string().min(1).max(80).optional().describe("界面显示的任务或会话名称；省略时从任务首句推导。"),
    prompt: z.string().min(1),
    mode: modeSchema,
    timeout_seconds: z.number().int().min(1).max(7200).optional()
  },
  async (input) => safeTool(() => ({ task: publicTask(service.delegateTask({
    originAgent: input.origin_agent,
    targetAgent: input.target_agent,
    workspace: input.workspace,
    workspaceName: input.workspace_name,
    taskName: input.task_name,
    prompt: input.prompt,
    mode: input.mode,
    timeoutSeconds: input.timeout_seconds
  }, null, callbackSink())) }))
);

server.tool(
  "delegate_batch",
  "由当前协调器并行委派一组任务，返回 group_id、task_id 和 callback_id，并主动推送回调事件。",
  {
    origin_agent: agentSchema.optional(),
    tasks: z.array(z.object({
      target_agent: agentSchema,
      workspace: z.string().min(1),
      workspace_name: z.string().min(1).max(80).optional(),
      task_name: z.string().min(1).max(80).optional(),
      prompt: z.string().min(1),
      mode: modeSchema,
      timeout_seconds: z.number().int().min(1).max(7200).optional()
    })).min(1).max(20)
  },
  async (input) => safeTool(() => {
    const result = service.delegateBatch(input.origin_agent, input.tasks.map((task) => ({
      targetAgent: task.target_agent,
      workspace: task.workspace,
      workspaceName: task.workspace_name,
      taskName: task.task_name,
      prompt: task.prompt,
      mode: task.mode,
      timeoutSeconds: task.timeout_seconds
    })), callbackSink());
    return { groupId: result.groupId, tasks: result.tasks.map(publicTask) };
  })
);

server.tool(
  "get_callback_events",
  "读取回调事件；用于协调器重连后补取进度、问题、确认和最终结果。",
  {
    callback_id: z.string().uuid(),
    after_event_id: z.number().int().min(0).optional()
  },
  async ({ callback_id, after_event_id }) => safeTool(() => ({ events: service.getCallbackEvents(callback_id, after_event_id) }))
);

server.tool(
  "respond_callback",
  "回复目标 Agent 的问题或确认请求；DSH 会通过 RPC 发送回原始可见会话。",
  {
    callback_id: z.string().uuid(),
    response: z.string().min(1)
  },
  async ({ callback_id, response }) => safeTool(async () => ({ task: publicTask(await service.respondCallback(callback_id, response)) }))
);

server.tool(
  "get_task",
  "读取一个任务的当前状态、分支、worktree、摘要和错误。",
  { task_id: z.string().uuid() },
  async ({ task_id }) => safeTool(() => ({ task: publicTask(service.getTask(task_id)) }))
);

server.tool(
  "wait_tasks",
  "兼容旧客户端的等待接口；新客户端应使用主动回调通知，重连后用 get_callback_events 补取。",
  {
    task_ids: z.array(z.string().uuid()).min(1).max(20),
    timeout_seconds: z.number().int().min(0).max(60).optional()
  },
  async ({ task_ids, timeout_seconds }) => safeTool(async () => ({
    tasks: (await service.waitTasks(task_ids, timeout_seconds)).map(publicTask)
  }))
);

server.tool(
  "list_tasks",
  "按工作区、来源 Agent、目标 Agent 或状态查询任务。",
  {
    workspace: z.string().optional(),
    origin_agent: agentSchema.optional(),
    target_agent: agentSchema.optional(),
    status: statusSchema.optional(),
    limit: z.number().int().min(1).max(200).optional()
  },
  async (input) => safeTool(() => ({ tasks: service.listTasks({
    workspace: input.workspace,
    originAgent: input.origin_agent,
    targetAgent: input.target_agent,
    status: input.status,
    limit: input.limit
  }).map(publicTask) }))
);

server.tool(
  "cancel_task",
  "取消排队中或运行中的任务，并保留日志与 worktree。",
  { task_id: z.string().uuid() },
  async ({ task_id }) => safeTool(() => ({ task: publicTask(service.cancelTask(task_id)) }))
);

server.tool(
  "release_task",
  "释放已结束任务的 worktree；默认保留任务分支。",
  {
    task_id: z.string().uuid(),
    keep_branch: z.boolean().default(true)
  },
  async ({ task_id, keep_branch }) => safeTool(async () => ({ task: publicTask(await service.releaseTask(task_id, keep_branch)) }))
);

const shutdown = (): void => {
  service.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await server.connect(new StdioServerTransport());
