import fs from 'node:fs'
import path from 'node:path'
import { fixturesDir, repoRoot } from '../harness'

import type { Observation, Scenario, ScenarioContext } from '../harness'

const script = async (context: ScenarioContext, fixture: string): Promise<Observation> => {
  for (const file of ['shared.cjs', 'api-scenario.cjs', 'nest-scenario.cjs', fixture]) {
    fs.copyFileSync(path.join(fixturesDir, file), path.join(context.dir, file))
  }
  const resultPath = path.join(context.dir, 'result.json')
  const result = await context.node(fixture, [resultPath, JSON.stringify({ uri: context.uri, closedUri: context.closedUri, workDir: context.dir, repoRoot })])
  const output = fs.existsSync(resultPath) ? (JSON.parse(fs.readFileSync(resultPath, 'utf8')) as unknown) : null
  return { exitCode: result.exitCode, timedOut: result.timedOut, stdout: result.stdout, stderr: result.stderr, result: output, db: await context.db() }
}

// The library used from code: the Migrator API and the NestJS module, through require and import, and the laws
// in tests/laws checked against the installed Migrator.
export const libraryScenarios: Scenario[] = [
  { name: 'api-esm', run: (context) => script(context, 'api.mjs') },
  { name: 'api-cjs', run: (context) => script(context, 'api.cjs') },
  { name: 'nest-esm', run: (context) => script(context, 'nest.mjs') },
  { name: 'nest-cjs', run: (context) => script(context, 'nest.cjs') },
  { name: 'laws', run: (context) => script(context, 'laws.mjs') },
]
