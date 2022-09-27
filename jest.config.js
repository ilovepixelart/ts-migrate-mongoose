/* eslint-disable @typescript-eslint/no-var-requires */
// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html
const merge = require('merge')
const ts = require('ts-jest/jest-preset')
const mongo = require('@shelf/jest-mongodb/jest-preset')

const config = merge.recursive(ts, mongo, {
  roots: ['<rootDir>/src/', '<rootDir>/tests/'],
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.[jt]s?(x)',
    '!src/bin.ts',
    '!src/**/*.d.ts',
    '!src/interfaces/**/*.[jt]s?(x)'
  ],
  coverageDirectory: 'coverage',
  testMatch: [
    '<rootDir>/tests/**/*.test.ts'
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      isolatedModules: true,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      importHelpers: true
    }]
  },
  testPathIgnorePatterns: [
    'node_modules'
  ],
  watchPathIgnorePatterns: [
    'globalConfig'
  ]
})

module.exports = config
