/**
 * CSS Module 类型声明：fork 的 .module.css 在 esbuild 构建时由插件转换为
 * 「默认导出 = 类名 → 类名」对象；这里为 tsc 提供等价的宽松类型。
 */
declare module '*.module.css' {
  const css: Record<string, string>
  export default css
}
