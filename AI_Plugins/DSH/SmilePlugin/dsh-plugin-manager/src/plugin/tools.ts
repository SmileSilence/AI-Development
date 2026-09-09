/**
 * dsh-plugin-manager — dpm_* Agent 工具注册（defineTool）。
 * 决策 D1：不提供 dpm_history / dpm_history_delete / dpm_history_clear / dpm_rollback。
 */
import { defineTool } from "@deepseek-ai/dsh-tools";
import { installPlugin, removePlugin, generateReport } from "./service.js";
import { mergeLoaderEntries, profileDir, scanDuplicates, scanProfile } from "./scan.js";
import { disablePlugin, editManifestRemove, enablePlugin, pluginEnabledState } from "./patch.js";

/** 工具输出渲染：默认文本渲染（object 根需显式 additionalProperties）。 */
const textOutput = (schema: any) => {
  const normalized = schema.type === "object" ? { ...schema, additionalProperties: true } : { ...schema };
  return {
    schema: normalized,
    render: (_args: any, value: any) => [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
};

/** 读取 Loader 实际加载条目（可选能力：无 loader 注入时返回空数组）。 */
function readLoaderEntries(ctx: any): any[] {
  const loader = ctx?.get?.("loader");
  if (loader === undefined || typeof loader.entries !== "function") return [];
  try {
    const FIBER_PHASE: Record<number, string | null> = { 0: "pending", 1: "loading", 2: "active", 3: "failed", 4: null, 5: "unloading" };
    const entries: any[] = [];
    for (const entry of loader.entries()) {
      if (entry.options?.group) continue;
      entries.push({
        entryId: String(entry.id ?? ""),
        moduleName: entry.options?.name ?? null,
        enabled: !entry.disabled,
        fiberPhase: entry.fiber === undefined || entry.fiber === null ? null : (FIBER_PHASE[entry.fiber.state] ?? null),
      });
    }
    return entries;
  } catch {
    return [];
  }
}

/** 注册全部 dpm_* 工具。 */
export function registerPluginTools(ctx: any, profile: string): void {
  ctx.tools.register(defineTool({
    name: "dpm_list",
    description: "列出当前 DSH profile 中已安装的第三方插件（含类别、状态、版本、描述、启用情况）与结构化异常项。"
      + "结果合并了 Cordis Loader 实际加载的条目：managed=true 为 dependencies 声明的可管理插件；"
      + "managed=false 为系统/附带插件（模版 bundle、聚合包子插件，只读展示）。"
      + "异常项含 kind（missing-profile-manifest/dangling-dependency/loader-failed-entry/patch-write-failure/invalid-spec）与可选 action。",
    parameters: {},
    output: textOutput({ type: "object" }),
    async execute() {
      const scan = scanProfile(profile);
      const merged = mergeLoaderEntries(profile, scan, readLoaderEntries(ctx));
      const plugins = merged.map((p) => {
        const state = pluginEnabledState(profile, p.name);
        return state.exists ? { ...p, enabledState: { enabled: state.enabled, disabledByPatch: state.disabledByPatch } } : p;
      });
      return {
        profile,
        profileDir: profileDir(profile),
        plugins,
        anomalies: scan.anomalies,
      };
    },
  }));

  ctx.tools.register(defineTool({
    name: "dpm_install",
    description: "安装一个新插件。安装前自动检测功能重复：① 同名插件已装；② 其他已启用插件是否完全包含新插件的全部功能（功能指纹匹配）。"
      + "未指定 keep 时返回决策清单等待用户确认；keep 取值：auto=全自动（同名或功能被完全包含则跳过安装）；new=保留新插件并删除全部同类；"
      + "existing=保留已装插件并取消本次安装；all=保留全部仅安装新插件。也可以用 category 覆盖自动分类。",
    parameters: {
      spec: { type: "string", required: true, description: "插件 spec：包名、github:owner/repo#tag 或本地路径" },
      category: { type: "string", description: "可选：手动指定类别，覆盖自动分类" },
      description: { type: "string", description: "可选：候选插件描述（未安装时提升功能重复检测准确度）" },
      keep: { type: "string", description: "可选：功能重复/同类处理策略 auto / new / existing / all" },
    },
    output: textOutput({ type: "object" }),
    async execute(args: any) {
      const result: any = installPlugin({
        profile,
        spec: args.spec,
        categoryOverride: args.category ?? null,
        description: typeof args.description === "string" ? args.description : null,
        keep: args.keep ?? null,
      });
      if (result.requiresDecision === true) {
        return {
          ok: false,
          requiresDecision: true,
          decisions: result.decisions,
          hint: "请让用户决定（同名/功能重复/同类），或用 keep=auto/new/existing/all 重新调用 dpm_install",
        };
      }
      return result;
    },
  }));

  ctx.tools.register(defineTool({
    name: "dpm_enable",
    description: "启用一个已安装但被停用（或未启用）的插件。启用前自动检测功能重复：若其他已启用插件完全包含该插件的全部功能，则拒绝启用。"
      + "停用/启用通过写 profile 的 cordis.patch.yml（disabled 标记）实现，HMR 热生效无需重启。",
    parameters: {
      name: { type: "string", required: true, description: "要启用的插件包名（dpm_list 查看）" },
      force: { type: "boolean", description: "可选：true 时忽略功能重复检测强制启用" },
    },
    output: textOutput({ type: "object" }),
    async execute(args: any) {
      const state = pluginEnabledState(profile, args.name);
      if (!state.exists) return { ok: false, message: "插件「" + args.name + "」未安装或未在 dependencies 中声明" };
      if (state.enabled) return { ok: true, message: "插件「" + args.name + "」已在启用状态", already: true };
      const scan = scanProfile(profile);
      const candidate = scan.plugins.find((p) => p.name === args.name);
      if (candidate !== undefined && args.force !== true) {
        const dup = detectDuplicatesLocal(scan, candidate);
        if (dup.fullyCoveredBy.length > 0) {
          return {
            ok: false,
            blockedByDuplicate: true,
            message: "「" + args.name + "」的全部功能已被以下已启用插件完全包含，功能重复：" + dup.fullyCoveredBy.map((p) => p.name).join(", ") + "。请先停用（dpm_disable）或卸载（dpm_remove）重复插件，或传 force=true 强制启用",
            coveredBy: dup.fullyCoveredBy.map((p) => p.name),
          };
        }
      }
      return enablePlugin(profile, args.name);
    },
  }));

  ctx.tools.register(defineTool({
    name: "dpm_disable",
    description: "停用一个已启用的插件（不卸载，通过写 cordis.patch.yml 的 disabled 标记，HMR 热生效无需重启，可随时再启用）。",
    parameters: {
      name: { type: "string", required: true, description: "要停用的插件包名（dpm_list 查看）" },
    },
    output: textOutput({ type: "object" }),
    async execute(args: any) {
      const state = pluginEnabledState(profile, args.name);
      if (!state.exists) return { ok: false, message: "插件「" + args.name + "」未安装或未在 dependencies 中声明" };
      if (!state.enabled) return { ok: true, message: "插件「" + args.name + "」已在停用状态", already: true };
      return disablePlugin(profile, args.name);
    },
  }));

  ctx.tools.register(defineTool({
    name: "dpm_remove",
    description: "删除一个已安装的插件。删除前请先让用户确认。删除后会自动校验 dependencies 与 dsh.profile.bundles 无残留。",
    parameters: {
      name: { type: "string", required: true, description: "要删除的插件包名（dpm_list 查看）" },
      yes: { type: "boolean", description: "确认删除（不可逆操作，需要用户同意）" },
    },
    output: textOutput({ type: "object" }),
    async execute(args: any) {
      if (args.yes !== true) {
        return { ok: false, requiresConfirm: true, message: "删除「" + args.name + "」是不可逆操作，请先让用户确认后再以 yes=true 重试" };
      }
      return removePlugin({ profile, name: args.name });
    },
  }));

  ctx.tools.register(defineTool({
    name: "dpm_report",
    description: "生成按类别分类的 Markdown 插件清单（扫描 + 概览 + 异常）。返回完整 markdown 文本。",
    parameters: {},
    output: textOutput({ type: "string" }),
    async execute() {
      return generateReport(profile);
    },
  }));

  ctx.tools.register(defineTool({
    name: "dpm_duplicates",
    description: "扫描当前已安装插件之间的功能重复（两两比较）：fully-covered=功能被完全包含（冗余，建议卸载或停用）；"
      + "overlap=同类且共享 ≥2 个强特征词（功能高度重叠，二选一）。扫描结果供用户决定卸载（dpm_remove）或停用（dpm_disable）其中之一。",
    parameters: {},
    output: textOutput({ type: "object" }),
    async execute() {
      return { ok: true, profile, ...scanDuplicates(profile) };
    },
  }));

  ctx.tools.register(defineTool({
    name: "dpm_anomaly_action",
    description: "处理扫描出的异常项：kind=cleanup 时清理悬挂声明（dependencies + dsh.profile.bundles 残留）；kind=remove 时卸载插件；"
      + "kind=retry/manual 时返回处理提示。异常项来自 dpm_list 的 anomalies。",
    parameters: {
      plugin: { type: "string", required: true, description: "异常项关联的插件包名" },
      kind: { type: "string", required: true, description: "处理动作：cleanup / remove / retry / manual" },
    },
    output: textOutput({ type: "object" }),
    async execute(args: any) {
      if (args.kind === "remove") return removePlugin({ profile, name: args.plugin });
      if (args.kind === "cleanup") {
        const changed = editManifestRemove(profile, args.plugin);
        return {
          ok: true,
          action: changed ? "cleaned" : "nothing-to-clean",
          message: changed ? "已清理「" + args.plugin + "」的 dependencies 与 dsh.profile.bundles 残留声明" : "「" + args.plugin + "」没有需要清理的声明",
        };
      }
      if (args.kind === "retry") {
        return { ok: false, action: "retry-manual", message: "重试需先重新启用或重装「" + args.plugin + "」；若反复失败请查看网关日志" };
      }
      return { ok: false, action: "manual", message: "该项需手动处理：请检查 profile 配置后重试" };
    },
  }));
}

/** 本地轻量 duplicates 检测（供 dpm_enable 使用）。 */
function detectDuplicatesLocal(scan: any, candidate: any): any {
  const result: any = { sameName: null, fullyCoveredBy: [], sameCategory: [] };
  for (const owner of scan.plugins) {
    if (owner.name === candidate.name || !owner.installed || !owner.enabled) continue;
    if (owner.category === candidate.category) result.sameCategory.push(owner);
  }
  return result;
}
