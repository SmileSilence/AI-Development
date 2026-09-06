/**
 * react-dom 类型垫片（仅供类型检查）。
 *
 * 构建时将 react-dom 外部化（见 scripts/build.mjs 的 reactExternal），运行时由
 * DSH 模块加载器提供宿主单例；本插件 node_modules 不含 react-dom，故此处仅声明
 * 用到的 createPortal 类型，使 `npm run typecheck` 通过，而不引入任何运行时依赖。
 */
declare module 'react-dom' {
  import type { ReactNode, ReactPortal } from 'react'
  export function createPortal(children: ReactNode, container: Element | DocumentFragment): ReactPortal
}
