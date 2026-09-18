import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = dirname(fileURLToPath(import.meta.url));

export interface BridgeConfig {
  projectRoot: string;
  dataRoot: string;
  databasePath: string;
  tasksRoot: string;
  worktreesRoot: string;
  concurrency: number;
  retentionDays: number;
  defaultTimeoutSeconds: number;
  maxTimeoutSeconds: number;
  originAgent: string | undefined;
  inheritedDelegationDepth: number;
  callbackMode: boolean;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(): BridgeConfig {
  const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), ".local", "share");
  const dataRoot = resolve(process.env.MAB_DATA_DIR ?? join(localAppData, "SmileXX", "multi-agent-bridge"));
  const projectRoot = resolve(moduleDir, "..");

  return {
    projectRoot,
    dataRoot,
    databasePath: join(dataRoot, "bridge.db"),
    tasksRoot: join(dataRoot, "tasks"),
    worktreesRoot: join(dataRoot, "worktrees"),
    concurrency: positiveInteger(process.env.MAB_CONCURRENCY, 3),
    retentionDays: positiveInteger(process.env.MAB_RETENTION_DAYS, 30),
    defaultTimeoutSeconds: positiveInteger(process.env.MAB_DEFAULT_TIMEOUT_SECONDS, 900),
    maxTimeoutSeconds: positiveInteger(process.env.MAB_MAX_TIMEOUT_SECONDS, 7200),
    originAgent: normalizeOriginAgent(process.env.MAB_ORIGIN_AGENT),
    inheritedDelegationDepth: Number.parseInt(process.env.MAB_DELEGATION_DEPTH ?? "0", 10) || 0,
    callbackMode: process.env.MAB_CALLBACK_MODE === "1"
  };
}

function normalizeOriginAgent(value: string | undefined): string | undefined {
  const normalized = value?.toLowerCase();
  if (normalized === "claude-desktop" || normalized === "claude-code") return "claude";
  return normalized;
}
