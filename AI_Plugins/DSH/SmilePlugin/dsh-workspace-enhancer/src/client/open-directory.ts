/**
 * 打开工作区目录（需求 2）：Client 半部调用 Host 注册的
 * `/workspace-enhancer/open-directory` 路由，在系统文件管理器中打开目录。
 *
 * 桌面环境不可用（CI / headless）时 Host 返回 `{ opened: false, path }`，
 * 调用方把路径作为文本展示（悬停卡内路径本身即文本，无需额外动作）。
 */

/** Host 路由（与 src/index.ts 的 OPEN_DIRECTORY_ROUTE 保持一致）。 */
export const OPEN_DIRECTORY_ROUTE = '/workspace-enhancer/open-directory'

/** 打开目录结果。 */
export type OpenDirectoryResult =
  | { opened: true }
  | { opened: false; path?: string; error?: string }

/** 打开一个绝对路径目录；失败不抛错（结果内携带原因）。 */
export async function openDirectory(path: string): Promise<OpenDirectoryResult> {
  try {
    const response = await fetch(OPEN_DIRECTORY_ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path }),
    })
    const value = await response.json() as OpenDirectoryResult
    return response.ok
      ? value
      : { opened: false, error: (value as { error?: string }).error ?? `HTTP ${response.status}` }
  } catch (error) {
    return {
      opened: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
