import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.e2e.ts'],
    name: 'e2e',
    environment: 'node',
    expect: { requireAssertions: true },
  },
})
