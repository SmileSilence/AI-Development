import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { BridgeConfig } from "./config.js";
import type { AgentName, TaskRecord } from "./types.js";
import { ensureDirectory, isPathInside, runGit } from "./utils.js";

export interface WorktreeInfo {
  repositoryRoot: string;
  runWorkspace: string;
  branch: string;
  worktree: string;
  baseHead: string;
}

export function prepareWriteWorktree(config: BridgeConfig, task: TaskRecord): WorktreeInfo {
  const repositoryRoot = runGit(["-C", task.workspace, "rev-parse", "--show-toplevel"]);
  const dirty = runGit(["-C", repositoryRoot, "status", "--porcelain"]);
  if (dirty !== "") throw new Error("写入任务要求干净的 Git 工作区；请先提交或处理未提交修改。");

  const baseHead = runGit(["-C", repositoryRoot, "rev-parse", "HEAD"]);
  const repositoryHash = createHash("sha256").update(repositoryRoot.toLowerCase()).digest("hex").slice(0, 16);
  const worktreeParent = join(config.worktreesRoot, repositoryHash);
  const worktree = resolve(worktreeParent, task.id);
  const branch = `multi-agent/${task.targetAgent}/${task.id.slice(0, 12)}`;
  ensureDirectory(worktreeParent);
  if (existsSync(worktree)) throw new Error(`任务 worktree 已存在：${worktree}`);
  runGit(["-C", repositoryRoot, "worktree", "add", "-b", branch, worktree, "HEAD"]);
  return { repositoryRoot, runWorkspace: worktree, branch, worktree, baseHead };
}

export function repositoryRootForAnalysis(workspace: string): string | null {
  try {
    return runGit(["-C", workspace, "rev-parse", "--show-toplevel"]);
  } catch {
    return null;
  }
}

export function commitTaskChanges(task: TaskRecord): { commitHash: string | null; changedFiles: string[] } {
  if (task.mode !== "write" || task.worktree === null || task.baseHead === null) {
    return { commitHash: null, changedFiles: [] };
  }
  const changed = runGit(["-C", task.worktree, "status", "--porcelain"]);
  if (changed !== "") {
    runGit(["-C", task.worktree, "add", "--all"]);
    runGit([
      "-C", task.worktree,
      "-c", "user.name=Multi-Agent Bridge",
      "-c", "user.email=multi-agent-bridge@local",
      "commit", "-m", `chore(multi-agent): ${task.targetAgent} task ${task.id.slice(0, 12)}`
    ]);
  }
  const commitHash = runGit(["-C", task.worktree, "rev-parse", "HEAD"]);
  const changedFiles = commitHash === task.baseHead
    ? []
    : runGit(["-C", task.worktree, "diff", "--name-only", `${task.baseHead}..${commitHash}`]).split(/\r?\n/).filter(Boolean);
  return { commitHash, changedFiles };
}

export function releaseWorktree(config: BridgeConfig, task: TaskRecord, keepBranch: boolean): void {
  if (task.worktree === null || task.repositoryRoot === null) return;
  if (!isPathInside(config.worktreesRoot, task.worktree)) {
    throw new Error(`拒绝释放不在受管目录中的 worktree：${task.worktree}`);
  }
  runGit(["-C", task.repositoryRoot, "worktree", "remove", "--force", task.worktree]);
  if (!keepBranch && task.branch !== null) runGit(["-C", task.repositoryRoot, "branch", "-D", task.branch]);
}

export function validateAgentPair(origin: AgentName, target: AgentName, chain: AgentName[]): void {
  if (origin === target) throw new Error("来源 Agent 与目标 Agent 不能相同。");
  if (chain.includes(target)) throw new Error(`检测到循环委派：${[...chain, target].join(" -> ")}`);
}
