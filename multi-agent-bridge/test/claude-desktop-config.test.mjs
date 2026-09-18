import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const configurator = join(process.cwd(), "tools", "configure-claude-desktop.mjs");

function run(action, config, extra = []) {
  return spawnSync(process.execPath, [configurator, action, ...extra], {
    encoding: "utf8",
    env: { ...process.env, CLAUDE_DESKTOP_CONFIG: config }
  });
}

function runWithEnvironment(action, environment, extra = []) {
  const env = { ...process.env, ...environment };
  delete env.CLAUDE_DESKTOP_CONFIG;
  return spawnSync(process.execPath, [configurator, action, ...extra], {
    encoding: "utf8",
    env
  });
}

test("Claude Desktop 配置安装与卸载会保留其他 MCP", () => {
  const root = mkdtempSync(join(tmpdir(), "multi-agent-bridge-claude-desktop-"));
  const config = join(root, "Claude", "claude_desktop_config.json");
  const server = join(root, "server.js");
  writeFileSync(server, "", "utf8");
  try {
    const first = run("install", config, ["--node", process.execPath, "--server", server]);
    assert.equal(first.status, 0, first.stderr);
    const installed = JSON.parse(readFileSync(config, "utf8"));
    assert.equal(installed.mcpServers["multi-agent-bridge"].command, process.execPath);
    installed.mcpServers.keep = { command: "keep" };
    writeFileSync(config, JSON.stringify(installed), "utf8");

    const second = run("uninstall", config);
    assert.equal(second.status, 0, second.stderr);
    const removed = JSON.parse(readFileSync(config, "utf8"));
    assert.equal(removed.mcpServers["multi-agent-bridge"], undefined);
    assert.deepEqual(removed.mcpServers.keep, { command: "keep" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Claude Desktop 配置损坏时拒绝覆盖", () => {
  const root = mkdtempSync(join(tmpdir(), "multi-agent-bridge-claude-invalid-"));
  const config = join(root, "claude_desktop_config.json");
  const server = join(root, "server.js");
  writeFileSync(config, "{ invalid", "utf8");
  writeFileSync(server, "", "utf8");
  try {
    const result = run("install", config, ["--node", process.execPath, "--server", server]);
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(config, "utf8"), "{ invalid");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Microsoft Store 安装优先使用包虚拟化配置目录", () => {
  const root = mkdtempSync(join(tmpdir(), "multi-agent-bridge-claude-store-"));
  const localAppData = join(root, "Local");
  const appData = join(root, "Roaming");
  const storeRoot = join(localAppData, "Packages", "Claude_pzs8sxrjxfjjc");
  const storeConfig = join(storeRoot, "LocalCache", "Roaming", "Claude", "claude_desktop_config.json");
  const server = join(root, "server.js");
  mkdirSync(storeRoot, { recursive: true });
  writeFileSync(server, "", "utf8");
  try {
    const result = runWithEnvironment("install", { APPDATA: appData, LOCALAPPDATA: localAppData }, [
      "--node", process.execPath,
      "--server", server
    ]);
    assert.equal(result.status, 0, result.stderr);
    const installed = JSON.parse(readFileSync(storeConfig, "utf8"));
    assert.equal(installed.mcpServers["multi-agent-bridge"].env.MAB_ORIGIN_AGENT, "claude");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
