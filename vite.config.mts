import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    name: 'node',
    environment: 'node',
    coverage: {
      reporter: ['lcov'],
      include: ['src/**/*.ts'],
    },
  },
})
