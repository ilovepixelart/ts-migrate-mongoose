import path from 'node:path'
import base from './stryker.config.mjs'

// Mutation testing of src/ against the end-to-end suite on the packed package: npm run test:mutation:e2e
// Each mutant runs the scenarios until the first observation that differs from the unmutated build (tests/e2e/mutant.ts),
// so a full run takes hours; scope it with --mutate src/file.ts or src/file.ts:10-40 while working on one area.
// The diff behind every kill is written to reports/mutation/e2e-kills/<mutant id>.json.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: base.mutate,
  tempDirName: base.tempDirName,
  cleanTempDir: base.cleanTempDir,
  tsconfigFile: base.tsconfigFile,
  testRunner: 'command',
  buildCommand: 'node --import tsx tests/e2e/mutant.ts prepare',
  commandRunner: { command: `MUTANT_KILLS_DIR=${path.resolve('reports/mutation/e2e-kills')} node --import tsx tests/e2e/mutant.ts run` },
  coverageAnalysis: 'off',
  concurrency: 4,
  timeoutMS: 300_000,
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/e2e.html' },
  jsonReporter: { fileName: 'reports/mutation/e2e.json' },
  ignorePatterns: [...base.ignorePatterns, '.stryker-e2e'],
}
