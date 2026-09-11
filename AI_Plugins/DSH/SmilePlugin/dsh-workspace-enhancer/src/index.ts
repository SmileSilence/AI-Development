/**
 * smilexx-workspace-enhancer — Host 半部。
 *
 * 职责：
 *  1) 注册「打开工作区目录」HTTP 路由，供 Client 半部在系统文件管理器中
 *     打开工作区目录（悬停卡目录按钮 + 工作区 ··· 菜单「打开工作区」共用）。
 *  2) 向 Host settings 域注册 workspace-tagger 命名空间（集成自
 *     dsh-workspace-tagger 的标签子系统唯一真源），供 Client 半部经
 *     settingsScope 镜像读写。受 config.tags.enabled 开关控制——关闭时
 *     不注册 schema，Client 侧 settingsScope 无数据即进入不可用态。
 *
 * 其余功能（置顶 / 批量归档删除 / 默认模式选择器）全部在 Client 半部，
 * 走既有 remote：agentPresets.list / settings.update / workspaces.archiveSession /
 * workspaces.delete——Host 侧不新增任何业务服务。
 */

import { openNativePath, canOpenNativePath } from '@deepseek-ai/dsh-native-command'
import type { IncomingMessage, ServerResponse } from 'node:http'
// settings 服务类型合并（副作用导入）。
import '@deepseek-ai/dsh-settings'
import {
  SETTINGS_NAMESPACE,
  DEFAULT_SETTINGS,
  WorkspaceTaggerSettingsSchema,
} from './client/tags/settings-schema.ts'

export const name = 'workspace-enhancer'

/** webServer + settings 是硬依赖，必须声明 inject 才能访问 ctx.webServer / ctx.settings。 */
export const inject = ['webServer', 'settings']

/** Host config：标签子系统开关。 */
export interface WorkspaceEnhancerConfig {
  tags?: { enabled?: boolean }
}

/** 打开目录路由，与 drag-and-drop 插件的 /file-drop/locate 路由同款注册模式。 */
const OPEN_DIRECTORY_ROUTE = '/workspace-enhancer/open-directory'

/** JSON 响应头。 */
const jsonHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }

/** 读取请求体 JSON（限制体积，避免恶意大包）。 */
async function readJson(req: IncomingMessage, maxBytes = 64 * 1024): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maxBytes) throw new Error('request body too large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
}

/** 发送 JSON 响应。 */
function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  res.writeHead(status, jsonHeaders)
  res.end(JSON.stringify(body))
}

/** 提取错误消息（避免把整个错误对象序列化进响应）。 */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function apply(ctx: { effect(fn: () => unknown, label?: string): void; inject(namespaces: string[], cb: (scoped: { settings: { register(namespace: string, schema: unknown, options?: { base?: unknown }): void } }) => void): void; webServer: {
  register(route: { kind: 'exact'; path: string; handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void> }): () => void
}; settings: { register(namespace: string, schema: unknown, options?: { base?: unknown }): void } }, config: WorkspaceEnhancerConfig = {}) {
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: OPEN_DIRECTORY_ROUTE,
      handler: async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { opened: false, error: 'method not allowed' })
          return
        }
        try {
          const body = await readJson(req)
          const path = body?.path
          if (typeof path !== 'string' || path.length === 0) {
            sendJson(res, 400, { opened: false, error: 'missing path' })
            return
          }
          // 无桌面环境（CI / headless Linux）：返回路径供前端按文本展示，不假装成功。
          if (!canOpenNativePath()) {
            sendJson(res, 200, { opened: false, path })
            return
          }
          await openNativePath(path, AbortSignal.timeout(15000))
          sendJson(res, 200, { opened: true })
        } catch (error) {
          sendJson(res, 400, { opened: false, error: messageOf(error) })
        }
      },
    }),
    'workspace-enhancer: open-directory route',
  )

  // 集成自 dsh-workspace-tagger：注册标签设置命名空间（config.tags.enabled 开关）。
  if (config.tags?.enabled !== false) {
    // settings.register 返回 void，不能包进 ctx.effect（cordis 要求 effect 回调
    // 返回清理函数或迭代器，否则抛 Invalid effect）——沿用 tagger 的成熟模式：
    // ctx.inject 等待 settings 服务就绪后直接注册。
    ctx.inject(['settings'], (settingsCtx) => {
      settingsCtx.settings.register(SETTINGS_NAMESPACE, WorkspaceTaggerSettingsSchema, { base: DEFAULT_SETTINGS })
    })
  }
}
