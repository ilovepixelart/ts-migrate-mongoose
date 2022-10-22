/* eslint-disable @typescript-eslint/no-var-requires */
// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html
const merge = require('merge')
const mongo = require('@shelf/jest-mongodb/jest-preset')

const config = merge.recursive(mongo, {
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
    '^.+\\.tsx?$': '@swc/jest'
  },
  testPathIgnorePatterns: [
    'node_modules'
  ],
  watchPathIgnorePatterns: [
    'globalConfig'
  ]
})

module.exports = config
