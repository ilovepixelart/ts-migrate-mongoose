// Mutation testing of src/ against the unit and integration suite: npm run test:mutation
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  mutate: ['src/**/*.ts', '!src/**/*.d.ts'],
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/unit.html' },
  jsonReporter: { fileName: 'reports/mutation/unit.json' },
  tempDirName: '.stryker-tmp',
  // A failed run otherwise leaves its sandbox behind.
  cleanTempDir: 'always',
  // .stryker-e2e holds the end-to-end run's installed consumer.
  ignorePatterns: ['reports', '.stryker-e2e'],
  // The sandbox tsconfig rewrite calls the TypeScript compiler API, which the native typescript 7 package does not
  // ship. The rewrite only fixes extends/references that leave the project; ours stay inside, so it is skipped by
  // naming a file that does not exist.
  tsconfigFile: 'tsconfig.stryker-skip.json',
}
