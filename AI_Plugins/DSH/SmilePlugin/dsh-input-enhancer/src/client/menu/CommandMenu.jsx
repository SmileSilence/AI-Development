/**
 * 命令菜单注册组件：按启动器快照分支。
 * - 仅当 launcher==='command'（点击 + 打开）且菜单打开时，渲染分类菜单；
 * - 输入 '/' 或 '@' 触发的原生菜单，渲染与原生 MenuView 行为兼容的分支。
 */
import { useSyncExternalStore } from 'react'
import { CategorizedMenu } from './CategorizedMenu.jsx'
import { OriginalMenuView } from './OriginalMenuView.jsx'

/** 命令菜单组件：组合注入面（快照 + 路由方法）。 */
export function CommandMenu(props) {
  const state = useSyncExternalStore(
    (fn) => props.menu.subscribe(fn),
    () => props.menu.getSnapshot(),
  )
  const launcher = useSyncExternalStore(
    (fn) => props.launcher.subscribe(fn),
    () => props.launcher.getSnapshot(),
  )
  const categorized = launcher === 'command' && state.open
  return categorized ? <CategorizedMenu {...props} /> : <OriginalMenuView {...props} />
}
