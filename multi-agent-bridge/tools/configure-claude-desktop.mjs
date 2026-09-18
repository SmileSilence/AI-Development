#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const SERVER_NAME = "multi-agent-bridge";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function required(name) {
  const value = argument(name);
  if (value === undefined || value.trim() === "") throw new Error(`缺少参数：${name}`);
  return value;
}

function configPaths() {
  if (process.env.CLAUDE_DESKTOP_CONFIG?.trim()) return [resolve(process.env.CLAUDE_DESKTOP_CONFIG)];
  if (!process.env.APPDATA) throw new Error("缺少 APPDATA，无法定位 Claude Desktop 配置目录。");
  const active = [];
  if (process.env.LOCALAPPDATA) {
    const thirdPartyRoot = join(process.env.LOCALAPPDATA, "Claude-3p");
    if (existsSync(thirdPartyRoot)) active.push(join(thirdPartyRoot, "claude_desktop_config.json"));
    const storeRoot = join(process.env.LOCALAPPDATA, "Packages", "Claude_pzs8sxrjxfjjc");
    const storeConfig = join(storeRoot, "LocalCache", "Roaming", "Claude", "claude_desktop_config.json");
    if (existsSync(storeRoot)) active.push(storeConfig);
  }
  return active.length > 0 ? active : [join(process.env.APPDATA, "Claude", "claude_desktop_config.json")];
}

function readConfig(path) {
  if (!existsSync(path)) return {};
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "").trim();
  if (text === "") return {};
  const value = JSON.parse(text);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Claude Desktop 配置根节点必须是 JSON 对象：${path}`);
  }
  return value;
}

function writeConfig(path, config) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  const backup = `${path}.bak`;
  writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  if (existsSync(path)) copyFileSync(path, backup);
  try {
    if (existsSync(path)) rmSync(path);
    renameSync(temporary, path);
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary);
    if (!existsSync(path) && existsSync(backup)) copyFileSync(backup, path);
    throw error;
  }
}

function install(path) {
  const nodePath = resolve(required("--node"));
  const serverPath = resolve(required("--server"));
  if (!existsSync(nodePath)) throw new Error(`Node.js 不存在：${nodePath}`);
  if (!existsSync(serverPath)) throw new Error(`MCP 服务入口不存在：${serverPath}`);
  const config = readConfig(path);
  const servers = typeof config.mcpServers === "object" && config.mcpServers !== null && !Array.isArray(config.mcpServers)
    ? config.mcpServers
    : {};
  config.mcpServers = servers;
  servers[SERVER_NAME] = {
    command: nodePath,
    args: [serverPath],
    env: { MAB_ORIGIN_AGENT: "claude" }
  };
  writeConfig(path, config);
  return { action: "installed", path, server: servers[SERVER_NAME] };
}

function uninstall(path) {
  const config = readConfig(path);
  const servers = typeof config.mcpServers === "object" && config.mcpServers !== null && !Array.isArray(config.mcpServers)
    ? config.mcpServers
    : null;
  const existed = servers !== null && Object.hasOwn(servers, SERVER_NAME);
  if (existed) {
    delete servers[SERVER_NAME];
    writeConfig(path, config);
  }
  return { action: existed ? "removed" : "unchanged", path };
}

function check(path) {
  const config = readConfig(path);
  const server = config.mcpServers?.[SERVER_NAME] ?? null;
  return { action: "checked", path, installed: server !== null, server };
}

try {
  const action = process.argv[2];
  const paths = configPaths();
  const configs = action === "install"
    ? paths.map(install)
    : action === "uninstall"
      ? paths.map(uninstall)
      : action === "check"
        ? paths.map(check)
        : (() => { throw new Error("用法：configure-claude-desktop.mjs <install|uninstall|check> [--node <path>] [--server <path>]"); })();
  const result = {
    action,
    installed: action === "check" ? configs.some((item) => item.installed) : undefined,
    configs
  };
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
