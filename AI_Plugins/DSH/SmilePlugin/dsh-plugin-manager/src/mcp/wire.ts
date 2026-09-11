/**
 * smilexx-skill-mcp-manager —— mcpManager Typert wire manifest。
 */
import { z } from "zod";
import { mcpServerInputSchema } from "./model.js";

const fiberPhaseSchema = z.enum(["pending", "loading", "active", "failed", "unloading"]).nullable();

const reconnectViewSchema = z.object({
  enabled: z.boolean(),
  initialDelayMs: z.number(),
  maxDelayMs: z.number(),
  maxAttempts: z.number()
});

export const mcpServerViewSchema = z.object({
  serverName: z.string(),
  transport: z.enum(["stdio", "streamable-http", "unknown"]),
  enabled: z.boolean(),
  entryId: z.string().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  envKeys: z.array(z.string()),
  cwd: z.string().optional(),
  url: z.string().optional(),
  headerKeys: z.array(z.string()),
  toolCallTimeoutMs: z.number(),
  failOnStartupError: z.boolean(),
  reconnect: reconnectViewSchema,
  managed: z.boolean().default(true),
  fiberPhase: fiberPhaseSchema,
  toolCount: z.number().int().nonnegative()
});

export const mcpListResultSchema = z.object({
  servers: z.array(mcpServerViewSchema),
  externalServers: z.array(mcpServerViewSchema),
  patch: z.object({
    path: z.string(),
    ok: z.boolean(),
    error: z.string().nullable()
  })
});

export const mcpSavePayloadSchema = z.object({
  input: mcpServerInputSchema,
  previousServerName: z.string().optional(),
  enabled: z.boolean().default(true)
});

export const mcpSaveResultSchema = z.object({
  server: mcpServerViewSchema,
  reconciled: z.boolean()
});

export const mcpRemovePayloadSchema = z.object({
  serverName: z.string()
});

export const mcpRemoveResultSchema = z.object({
  ok: z.boolean()
});

export const mcpSetEnabledPayloadSchema = z.object({
  serverName: z.string(),
  enabled: z.boolean()
});

export const mcpTestPayloadSchema = z.union([
  mcpServerInputSchema,
  z.object({ serverName: z.string() })
]);

const mcpToolSchema = z.object({
  name: z.string(),
  description: z.string().optional()
});

export const mcpTestResultSchema = z.object({
  ok: z.boolean(),
  tools: z.array(mcpToolSchema),
  error: z.string().optional()
});

export const MCP_MANIFEST = {
  package: "smilexx-skill-mcp-manager",
  face: "host",
  schemas: [],
  invocations: [
    {
      id: "smilexx-skill-mcp-manager#mcpManager/list",
      service: "mcpManager",
      namespace: "mcpManager",
      method: "list",
      invocation: { kind: "direct" },
      parameters: [],
      result: { mode: "strict", typeSymbol: "smilexx-skill-mcp-manager#McpListResult", schema: mcpListResultSchema }
    },
    {
      id: "smilexx-skill-mcp-manager#mcpManager/save",
      service: "mcpManager",
      namespace: "mcpManager",
      method: "save",
      invocation: { kind: "direct" },
      parameters: [
        { name: "payload", wire: "payload", source: "json", codec: { mode: "strict", typeSymbol: "smilexx-skill-mcp-manager#McpSavePayload", schema: mcpSavePayloadSchema } }
      ],
      result: { mode: "strict", typeSymbol: "smilexx-skill-mcp-manager#McpSaveResult", schema: mcpSaveResultSchema }
    },
    {
      id: "smilexx-skill-mcp-manager#mcpManager/removeServer",
      service: "mcpManager",
      namespace: "mcpManager",
      method: "removeServer",
      invocation: { kind: "direct" },
      parameters: [
        { name: "payload", wire: "payload", source: "json", codec: { mode: "strict", typeSymbol: "smilexx-skill-mcp-manager#McpRemovePayload", schema: mcpRemovePayloadSchema } }
      ],
      result: { mode: "strict", typeSymbol: "smilexx-skill-mcp-manager#McpRemoveResult", schema: mcpRemoveResultSchema }
    },
    {
      id: "smilexx-skill-mcp-manager#mcpManager/setEnabled",
      service: "mcpManager",
      namespace: "mcpManager",
      method: "setEnabled",
      invocation: { kind: "direct" },
      parameters: [
        { name: "payload", wire: "payload", source: "json", codec: { mode: "strict", typeSymbol: "smilexx-skill-mcp-manager#McpSetEnabledPayload", schema: mcpSetEnabledPayloadSchema } }
      ],
      result: { mode: "strict", typeSymbol: "smilexx-skill-mcp-manager#McpSaveResult", schema: mcpSaveResultSchema }
    },
    {
      id: "smilexx-skill-mcp-manager#mcpManager/test",
      service: "mcpManager",
      namespace: "mcpManager",
      method: "test",
      invocation: { kind: "direct" },
      parameters: [
        { name: "payload", wire: "payload", source: "json", codec: { mode: "strict", typeSymbol: "smilexx-skill-mcp-manager#McpTestPayload", schema: mcpTestPayloadSchema } }
      ],
      result: { mode: "strict", typeSymbol: "smilexx-skill-mcp-manager#McpTestResult", schema: mcpTestResultSchema }
    },
    {
      id: "smilexx-skill-mcp-manager#mcpManager/reload",
      service: "mcpManager",
      namespace: "mcpManager",
      method: "reload",
      invocation: { kind: "direct" },
      parameters: [],
      result: { mode: "strict", typeSymbol: "smilexx-skill-mcp-manager#McpListResult", schema: mcpListResultSchema }
    }
  ],
  model: { services: [], events: [], objects: [] }
};
