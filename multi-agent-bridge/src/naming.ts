import { basename, resolve } from "node:path";

const WORKSPACE_NAME_LIMIT = 80;
const TASK_NAME_LIMIT = 80;

export interface ResolvedNames {
  workspaceName: string;
  workspaceNameExplicit: boolean;
  taskName: string;
}

export function resolveTaskNames(
  workspace: string,
  prompt: string,
  workspaceName?: string,
  taskName?: string
): ResolvedNames {
  const explicitWorkspaceName = normalizeExplicitName(workspaceName, "workspace_name", WORKSPACE_NAME_LIMIT);
  const explicitTaskName = normalizeExplicitName(taskName, "task_name", TASK_NAME_LIMIT);
  const inferredWorkspaceName = cleanTitle(basename(resolve(workspace)), WORKSPACE_NAME_LIMIT);
  const inferredTaskName = inferTaskName(prompt);
  return {
    workspaceName: explicitWorkspaceName ?? (inferredWorkspaceName || "未命名项目"),
    workspaceNameExplicit: explicitWorkspaceName !== null,
    taskName: explicitTaskName ?? inferredTaskName
  };
}

export function inferTaskName(prompt: string): string {
  const candidate = prompt
    .split(/\r?\n/)
    .map((line) => cleanMarkdown(line))
    .find((line) => line.length > 0) ?? "未命名任务";
  const sentence = candidate.split(/(?<=[。！？!?；;])\s*/u)[0] ?? candidate;
  return cleanTitle(sentence, TASK_NAME_LIMIT) || "未命名任务";
}

function normalizeExplicitName(value: string | undefined, field: string, limit: number): string | null {
  if (value === undefined) return null;
  const normalized = cleanMarkdown(value).replace(/\s+/gu, " ").trim();
  if (normalized === "") throw new Error(`${field} 不能为空。`);
  if (normalized.length > limit) throw new Error(`${field} 不能超过 ${limit} 个字符。`);
  return normalized;
}

function cleanMarkdown(value: string): string {
  return value
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s+/u, "")
    .replace(/!??\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/[*_~`]+/gu, "")
    .trim();
}

function cleanTitle(value: string, limit: number): string {
  const normalized = cleanMarkdown(value).replace(/\s+/gu, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(1, limit - 1)).trimEnd()}…`;
}
