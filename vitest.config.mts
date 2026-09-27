import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname),
      // 순수 함수만 테스트한다 — 서버 전용 표식은 빈 모듈로
      'server-only': path.resolve(import.meta.dirname, 'tests/stubs/empty.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
