import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    include: ['lib/**/__tests__/**/*.test.ts'],
    globals: true,
    environment: 'node',
    env: {
      FREELLM_STUB: 'true',
    },
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})