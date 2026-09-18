import { accessSync, constants, mkdirSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export function ensureDirectory(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function resolveExistingDirectory(path: string): string {
  const resolved = resolve(path);
  accessSync(resolved, constants.R_OK);
  return resolved;
}

export function isPathInside(parent: string, candidate: string): boolean {
  const rel = relative(resolve(parent), resolve(candidate));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function runGit(args: string[], cwd?: string): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || "Git 命令执行失败").trim();
    throw new Error(message);
  }
  return result.stdout.trim();
}

export function tailFile(path: string | null, maxBytes = 16_384): string {
  if (path === null) return "";
  try {
    const content = readFileSync(path);
    return content.subarray(Math.max(0, content.length - maxBytes)).toString("utf8").trim();
  } catch {
    return "";
  }
}

export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

export function jsonText(value: unknown): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}
