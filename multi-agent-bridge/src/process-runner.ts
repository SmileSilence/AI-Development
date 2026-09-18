import { createWriteStream } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import type { AdapterCommand } from "./types.js";

export interface ProcessResult {
  exitCode: number;
  canceled: boolean;
  timedOut: boolean;
}

export async function runAgentProcess(options: {
  adapter: AdapterCommand;
  cwd: string;
  stdoutPath: string;
  stderrPath: string;
  timeoutSeconds: number;
  onStarted: (processId: number) => void;
  isCanceled?: () => boolean;
  signal?: AbortSignal;
  onOutput?: (stream: "stdout" | "stderr", chunk: string) => void;
  onInputReady?: (write: (text: string) => void) => void;
}): Promise<ProcessResult> {
  const stdout = createWriteStream(options.stdoutPath, { flags: "a" });
  const stderr = createWriteStream(options.stderrPath, { flags: "a" });
  const child = spawn(options.adapter.command, options.adapter.args, {
    cwd: options.cwd,
    env: options.adapter.env,
    stdio: [options.adapter.acceptsInput === true ? "pipe" : "ignore", "pipe", "pipe"],
    windowsHide: true
  });
  child.stdout?.pipe(stdout);
  child.stderr?.pipe(stderr);
  child.stdout?.on("data", (chunk: Buffer) => options.onOutput?.("stdout", chunk.toString("utf8")));
  child.stderr?.on("data", (chunk: Buffer) => options.onOutput?.("stderr", chunk.toString("utf8")));
  if (child.pid === undefined) throw new Error("Agent 进程未返回 PID。");
  options.onStarted(child.pid);
  if (options.adapter.acceptsInput === true) options.onInputReady?.((text) => child.stdin?.write(text));

  let canceled = options.signal?.aborted === true;
  let timedOut = false;
  let stopping = false;
  const stop = (reason: "canceled" | "timeout"): void => {
    if (stopping || child.exitCode !== null || child.signalCode !== null) return;
    stopping = true;
    canceled = reason === "canceled";
    timedOut = reason === "timeout";
    terminateProcessTree(child);
  };
  const onAbort = (): void => stop("canceled");
  options.signal?.addEventListener("abort", onAbort, { once: true });
  if (canceled) stop("canceled");
  const timeout = setTimeout(() => stop("timeout"), options.timeoutSeconds * 1000);
  // 独立 worker 仍兼容数据库取消标记；MCP 回调模式使用 AbortSignal，不依赖轮询。
  const cancelPoll = options.isCanceled === undefined
    ? undefined
    : setInterval(() => {
        if (options.isCanceled?.()) stop("canceled");
      }, 500);

  const exitCode = await new Promise<number>((resolvePromise, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolvePromise(code ?? 1));
  });
  clearTimeout(timeout);
  if (cancelPoll !== undefined) clearInterval(cancelPoll);
  options.signal?.removeEventListener("abort", onAbort);
  stdout.end();
  stderr.end();
  return { exitCode, canceled, timedOut };
}

export function terminateProcessTree(child: ChildProcess): void {
  if (child.pid === undefined) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true });
  } else {
    child.kill("SIGTERM");
  }
}

export function terminateProcessId(processId: number): void {
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(processId), "/T", "/F"], { windowsHide: true });
  } else {
    try {
      process.kill(processId, "SIGTERM");
    } catch {
      // 进程可能已结束。
    }
  }
}
