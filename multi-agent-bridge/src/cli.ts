#!/usr/bin/env node
import { BridgeService, publicTask } from "./service.js";

function value(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function required(args: string[], name: string): string {
  const result = value(args, name);
  if (result === undefined || result.trim() === "") throw new Error(`缺少参数：${name}`);
  return result;
}

function help(): void {
  console.log(`multi-agent-bridge

用法：
  multi-agent-bridge agents
  multi-agent-bridge delegate --origin <agent> --target <agent> --workspace <path> --mode <analysis|write> --prompt <text> [--workspace-name <name>] [--task-name <name>] [--timeout <seconds>]
  multi-agent-bridge get --task <id>
  multi-agent-bridge list [--workspace <path>] [--status <status>]
  multi-agent-bridge cancel --task <id>
  multi-agent-bridge release --task <id> [--delete-branch]
`);
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const command = args.shift();
  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    help();
    return 0;
  }
  const service = new BridgeService();
  try {
    if (command === "agents") console.log(JSON.stringify(service.listAgents(), null, 2));
    else if (command === "delegate") {
      const task = service.delegateTask({
        originAgent: value(args, "--origin"),
        targetAgent: required(args, "--target"),
        workspace: required(args, "--workspace"),
        workspaceName: value(args, "--workspace-name"),
        taskName: value(args, "--task-name"),
        prompt: required(args, "--prompt"),
        mode: required(args, "--mode"),
        timeoutSeconds: value(args, "--timeout") === undefined ? undefined : Number(value(args, "--timeout"))
      });
      console.log(JSON.stringify(publicTask(task), null, 2));
    } else if (command === "get") console.log(JSON.stringify(publicTask(service.getTask(required(args, "--task"))), null, 2));
    else if (command === "list") console.log(JSON.stringify(service.listTasks({
      workspace: value(args, "--workspace"),
      status: value(args, "--status")
    }).map(publicTask), null, 2));
    else if (command === "cancel") console.log(JSON.stringify(publicTask(service.cancelTask(required(args, "--task"))), null, 2));
    else if (command === "release") console.log(JSON.stringify(publicTask(await service.releaseTask(
      required(args, "--task"),
      !args.includes("--delete-branch")
    )), null, 2));
    else throw new Error(`未知命令：${command}`);
    return 0;
  } finally {
    service.close();
  }
}

main().then((code) => {
  process.exitCode = code;
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
