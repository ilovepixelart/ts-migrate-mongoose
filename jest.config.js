/* eslint-disable @typescript-eslint/no-var-requires */
// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html
const merge = require('merge')
const ts = require('ts-jest/jest-preset')
const mongo = require('@shelf/jest-mongodb/jest-preset')

const config = merge.recursive(ts, mongo, {
  clearMocks: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/bin.ts'
  ],
  coverageDirectory: 'coverage',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      isolatedModules: true,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      importHelpers: true
    }]
  },
  testMatch: [
    '<rootDir>/tests/**/*.test.ts'
  ],
  testPathIgnorePatterns: [
    '/node_modules/'
  ],
  watchPathIgnorePatterns: ['globalConfig']
})

module.exports = config
