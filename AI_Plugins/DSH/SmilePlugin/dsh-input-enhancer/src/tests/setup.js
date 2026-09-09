// 组件测试公共设置：每个用例后自动清理 React 树
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
})

// jsdom 未实现 scrollIntoView；菜单高亮滚动逻辑在真实浏览器中运行
if (typeof Element !== 'undefined' && Element.prototype.scrollIntoView === undefined) {
  Element.prototype.scrollIntoView = vi.fn()
}
