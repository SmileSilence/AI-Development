#!/usr/bin/env node
/**
 * dsh-panel plugin —— dsh-plugin-manager 的插件热管理命令行。
 *
 * 直接读写 profile（默认 web）的 cordis.patch.yml 用户层与 dsh.profile.bundles，
 * 与设置页「插件管理」共用同一套 scan/service/patch 逻辑。
 *
 *   dsh-panel plugin list [--profile <name>]        列出第三方插件与异常
 *   dsh-panel plugin install <spec> [--keep <policy>] [--category <name>] [--profile <name>]
 *                                                   安装插件（spec = 包名 / github:owner/repo#tag / 本地路径）
 *   dsh-panel plugin enable <name> [--profile <name>]  启用插件（热生效）
 *   dsh-panel plugin disable <name> [--profile <name>] 停用插件（热生效）
 *   dsh-panel plugin remove <name> [--yes] [--profile <name>]
 *                                                   卸载插件（从 patch 层移除并清理声明）
 *   dsh-panel plugin report [--profile <name>]      生成 Markdown 插件清单
 *   dsh-panel plugin duplicates [--profile <name>]  检测功能重复
 *   dsh-panel plugin anomalies [--profile <name>]   列出异常项
 *   dsh-panel plugin anomaly-action <plugin> <kind> [--profile <name>]
 *                                                   处理异常（cleanup / remove / retry / manual）
 *
 * --profile <name>   目标 profile（默认 web）；--keep 安装决策：auto / all / new / existing
 */
import { anomalyAction } from "./service.js";
import { generateReport } from "./service.js";
import { installPlugin } from "./service.js";
import { removePlugin } from "./service.js";
import { scanDuplicates } from "./scan.js";
import { scanProfile } from "./scan.js";

function usage() {
  console.log([
    "用法:",
    "  dsh-panel plugin list [--profile <name>]                  列出插件清单（含悬挂声明）",
    "  dsh-panel plugin install <spec> [--keep <policy>] [--category <name>] [--profile <name>]",
    "                                                      安装插件；--keep 见下（默认询问）",
    "  dsh-panel plugin enable <name> [--profile <name>]        启用插件",
    "  dsh-panel plugin disable <name> [--profile <name>]       停用插件",
    "  dsh-panel plugin remove <name> [--yes] [--profile <name>] 卸载插件",
    "  dsh-panel plugin report [--profile <name>]               生成 Markdown 插件清单",
    "  dsh-panel plugin duplicates [--profile <name>]           检测功能重复",
    "  dsh-panel plugin anomalies [--profile <name>]            列出异常项",
    "  dsh-panel plugin anomaly-action <plugin> <kind> [--profile <name>]  处理异常",
    "",
    "--keep 安装决策: auto=全自动跳过同名/被包含; all=保留全部仅装新; new=保留新删全部同类; existing=保留已装取消",
    "kind 取值: cleanup(清理声明) / remove(卸载) / retry(重试) / manual(标记手动)"
  ].join("\n"));
}

function argValue(args: string[], key: string): string | null {
  const index = args.indexOf(key);
  if (index >= 0 && index + 1 < args.length) return args[index + 1];
  return null;
}

function hasFlag(args: string[], key: string): boolean {
  return args.includes(key);
}

const KNOWN_FLAGS = new Set(["--profile", "--keep", "--category", "--yes"]);

function stateLabel(plugin: any): string {
  if (plugin.installed === false) return "悬挂声明";
  if (plugin.managed === false) return "只读";
  return plugin.enabled ? "已启用" : "已停用";
}

function listPlugins(profile: string): number {
  const scan = scanProfile(profile);
  if (scan.plugins.length === 0) {
    console.log("（当前 profile 没有第三方插件）");
  } else {
    for (const plugin of scan.plugins) {
      const version = plugin.version ?? "";
      const category = plugin.category ?? "";
      const source = plugin.installed === false ? "（未安装）" : (plugin.managed === false ? "系统/附带" : "已加入 bundle 层");
      console.log("  " + [stateLabel(plugin), category, plugin.name, version, source].filter(Boolean).join("  ") + "");
    }
  }
  if (scan.anomalies.length > 0) {
    console.log("");
    console.log("异常项 " + scan.anomalies.length + "：");
    for (const anomaly of scan.anomalies) {
      console.log("  - [" + anomaly.kind + "] " + anomaly.message + (anomaly.hint ? "（" + anomaly.hint + "）" : ""));
    }
  }
  console.log("");
  console.log("共 " + scan.plugins.length + " 个插件，" + scan.anomalies.length + " 个异常项（profile=" + profile + "）");
  return scan.anomalies.length > 0 ? 1 : 0;
}

function installCli(args: string[], profile: string): number {
  const specIndex = args.findIndex((a) => !KNOWN_FLAGS.has(a) && !a.startsWith("--"));
  const spec = specIndex >= 0 ? args[specIndex] : null;
  if (spec === null || spec === "") {
    console.error("用法: dsh-panel plugin install <spec> [--keep <policy>] [--category <name>] [--profile <name>]");
    return 2;
  }
  const keep = argValue(args, "--keep") ?? null;
  const categoryOverride = argValue(args, "--category");
  const result: any = installPlugin({
    profile,
    spec,
    categoryOverride,
    description: null,
    keep,
  });
  if (result.requiresDecision === true) {
    console.log("安装被拦截：存在功能重复，需要决策。决策项：");
    for (const decision of result.decisions ?? []) console.log("  - " + decision.message);
    console.log("请用 --keep auto|all|new|existing 重新提交，或到设置页「插件管理」处理。");
    return 2;
  }
  console.log(result.message ?? (result.ok ? "安装完成" : "未安装"));
  return result.ok ? 0 : 1;
}

export async function runPluginCli(args: string[]): Promise<number> {
  const command = args[0];
  const rest = args.slice(1);
  const profile = argValue(args, "--profile") ?? "web";
  if (command === undefined || command === "--help" || command === "-h" || command === "help") {
    usage();
    return command === undefined ? 2 : 0;
  }
  try {
    if (command === "list") return listPlugins(profile);
    if (command === "install") return installCli(rest, profile);
    if (command === "report") {
      console.log(generateReport(profile));
      return 0;
    }
    if (command === "duplicates") {
      const result = scanDuplicates(profile);
      if (result.groups.length === 0) {
        console.log("已扫描 " + result.scanned + " 个插件：未发现功能重复。");
        return 0;
      }
      console.log("已扫描 " + result.scanned + " 个插件，发现 " + result.groups.length + " 组功能重复：");
      for (const group of result.groups) {
        if (group.kind === "fully-covered") {
          console.log("  [完全包含] " + (group.covered?.name ?? "?") + " 的功能被 " + (group.covering?.name ?? "?") + " 完全包含");
        } else {
          const names = Array.isArray(group.plugins) ? group.plugins.map((p) => p.name).join(", ") : "";
          console.log("  [重叠] " + names + (group.sharedWords?.length ? "（特征词：" + group.sharedWords.join(", ") + "）" : ""));
        }
      }
      return 1;
    }
    if (command === "anomalies") {
      const scan = scanProfile(profile);
      if (scan.anomalies.length === 0) {
        console.log("没有异常项。");
        return 0;
      }
      console.log("发现 " + scan.anomalies.length + " 个异常项（profile=" + profile + "）：");
      for (const anomaly of scan.anomalies) {
        console.log("  - [" + anomaly.kind + "] " + anomaly.message + (anomaly.hint ? "（" + anomaly.hint + "）" : "") + (anomaly.action ? "  建议动作: " + anomaly.action : ""));
      }
      return 1;
    }
    if (command === "anomaly-action") {
      const positional = rest.filter((a) => !a.startsWith("--"));
      const plugin = positional[0] ?? null;
      const kind = positional[1] ?? null;
      if (plugin === null || kind === null) {
        console.error("用法: dsh-panel plugin anomaly-action <plugin> <kind> [--profile <name>]");
        return 2;
      }
      const result = anomalyAction({ profile, plugin, kind });
      console.log(result.message ?? (result.ok ? "已处理" : "处理失败"));
      return result.ok ? 0 : 1;
    }
    if (command === "enable" || command === "disable" || command === "remove") {
      const { disablePlugin, enablePlugin } = await import("./patch.js");
      const { removePlugin: doRemove } = await import("./service.js");
      const nameIndex = rest.findIndex((a) => !a.startsWith("--"));
      const name = nameIndex >= 0 ? rest[nameIndex] : null;
      if (name === null || name === "") {
        console.error("用法: dsh-panel plugin " + command + " <name> [--profile <name>]");
        return 2;
      }
      if (command === "remove" && !hasFlag(rest, "--yes")) {
        console.log("卸载是破坏性操作，请确认：dsh-panel plugin remove " + name + " --yes");
        return 2;
      }
      let result;
      if (command === "enable") result = enablePlugin(profile, name);
      else if (command === "disable") result = disablePlugin(profile, name);
      else result = doRemove({ profile, name });
      console.log(result.message ?? (result.ok ? "完成" : "失败"));
      return result.ok ? 0 : 1;
    }
    console.error('未知 plugin 命令 "' + command + '"');
    usage();
    return 2;
  } catch (error) {
    console.error("dsh-panel plugin: " + (error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

// 直接运行时（node lib/plugin/cli.js ...）
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const directPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
const modulePath = fileURLToPath(import.meta.url);
if (directPath !== undefined && (directPath === modulePath || resolve(directPath) === resolve(modulePath))) {
  runPluginCli(process.argv.slice(2)).then((code) => {
    if (code !== 0) process.exitCode = code;
  }).catch((error) => {
    console.error("dsh-panel plugin: " + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  });
}