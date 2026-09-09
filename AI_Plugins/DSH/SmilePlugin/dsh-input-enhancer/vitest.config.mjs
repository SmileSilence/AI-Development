import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      // 组件测试使用本地桩替代未安装的原生 UI 包（构建时仍作为外部模块）
      {
        find: /^@deepseek-ai\/dsh-client-ui-primitives$/,
        replacement: fileURLToPath(new URL('./src/tests/stubs/ui-primitives-stub.jsx', import.meta.url)),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'http://localhost.test/' },
    },
    include: ['src/tests/**/*.test.{js,jsx}'],
    setupFiles: ['src/tests/setup.js'],
    testTimeout: 20000,
  },
})
