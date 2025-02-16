module.exports = {
  preset: '@shelf/jest-mongodb',
  roots: ['<rootDir>/src/', '<rootDir>/tests/'],
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.[jt]s?(x)', '!src/bin.ts', '!src/**/*.d.ts', '!src/interfaces/**/*.[jt]s?(x)', '!src/template.ts'],
  coverageDirectory: 'coverage',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: {
    '^.+.tsx?$': [
      'ts-jest',
      {
        moduleDetection: 'force',
        module: 'Preserve',
        resolveJsonModule: true,
        allowJs: true,
        esModuleInterop: true,
        isolatedModules: true,
      },
    ],
  },
  testPathIgnorePatterns: ['node_modules'],
  watchPathIgnorePatterns: ['globalConfig'],
}
