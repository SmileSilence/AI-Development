export const AGENTS = ["codex", "claude", "dsh"] as const;
export type AgentName = (typeof AGENTS)[number];

export const TASK_MODES = ["analysis", "write"] as const;
export type TaskMode = (typeof TASK_MODES)[number];

export const TARGET_WORKSPACE_KINDS = ["logical", "worktree"] as const;
export type TargetWorkspaceKind = (typeof TARGET_WORKSPACE_KINDS)[number];

export const TASK_STATUSES = ["queued", "running", "succeeded", "failed", "canceled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const CALLBACK_EVENT_TYPES = ["queued", "started", "progress", "question", "confirmation", "completed", "failed", "canceled"] as const;
export type CallbackEventType = (typeof CALLBACK_EVENT_TYPES)[number];

export interface TaskRecord {
  id: string;
  callbackId: string;
  agentSessionId: string | null;
  groupId: string | null;
  originAgent: AgentName;
  targetAgent: AgentName;
  workspace: string;
  workspaceName: string;
  workspaceNameExplicit: boolean;
  taskName: string;
  targetWorkspaceId: string | null;
  targetWorkspaceName: string | null;
  targetWorkspacePath: string | null;
  targetWorkspaceKind: TargetWorkspaceKind | null;
  targetWorkspaceCreated: boolean;
  agentSessionName: string | null;
  repositoryRoot: string | null;
  runWorkspace: string | null;
  prompt: string;
  mode: TaskMode;
  timeoutSeconds: number;
  status: TaskStatus;
  rootTaskId: string;
  delegationDepth: number;
  chain: AgentName[];
  branch: string | null;
  worktree: string | null;
  baseHead: string | null;
  commitHash: string | null;
  changedFiles: string[];
  processId: number | null;
  workerProcessId: number | null;
  cancelRequested: boolean;
  exitCode: number | null;
  summary: string | null;
  error: string | null;
  stdoutPath: string | null;
  stderrPath: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface CreateTaskInput {
  groupId?: string | null;
  originAgent: AgentName;
  targetAgent: AgentName;
  workspace: string;
  workspaceName: string;
  workspaceNameExplicit: boolean;
  taskName: string;
  prompt: string;
  mode: TaskMode;
  timeoutSeconds: number;
  rootTaskId?: string;
  delegationDepth: number;
  chain: AgentName[];
}

export interface AgentAvailability {
  name: AgentName;
  available: boolean;
  command: string | null;
  reason: string | null;
  modes: TaskMode[];
}

export interface AdapterCommand {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  sessionIdHint?: string;
  acceptsInput?: boolean;
}

export interface CallbackEvent {
  id: number;
  callbackId: string;
  taskId: string;
  type: CallbackEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}
