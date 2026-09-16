import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'http://localhost.test/' },
    },
    include: ['src/tests/**/*.test.js'],
    testTimeout: 20000,
  },
})
