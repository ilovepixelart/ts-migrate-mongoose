import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    name: 'node',
    environment: 'node',
    // A test that asserts nothing fails, so does one that only passes after another test ran first.
    expect: { requireAssertions: true },
    unstubEnvs: true,
    sequence: { shuffle: { files: false, tests: true } },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Floors at the measured totals: a change that lowers coverage fails the run.
      thresholds: { statements: 95, branches: 88, functions: 95, lines: 96 },
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/tests/**',
        'examples/**',
      ],
    },
  },
})
