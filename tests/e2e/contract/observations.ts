import fs from 'node:fs'
import path from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { repoRoot } from '../harness'

import type { Step } from '../harness'

const observationsDir = process.env.E2E_OBSERVATIONS
if (!observationsDir) throw new Error('E2E_OBSERVATIONS is not set: run the suite with `npm run test:e2e`')

export type Observation = Record<string, unknown> & { steps?: Step[] }
const candidate = JSON.parse(fs.readFileSync(path.join(observationsDir, 'candidate.json'), 'utf8')) as Record<string, Observation>

export const scenario = (name: string): Observation => {
  const observation = candidate[name]
  if (!observation) throw new Error(`No observation recorded for scenario '${name}'`)
  if (observation.harnessError) throw new Error(`Scenario '${name}' did not complete: ${String(observation.harnessError)}`)
  return observation
}

export const scenarioNames = (): string[] => Object.keys(candidate)

export const plain = (step: Step): Step => ({ ...step, stdout: stripVTControlCharacters(step.stdout), stderr: stripVTControlCharacters(step.stderr) })
export const steps = (name: string): Step[] => (scenario(name).steps ?? []).map(plain)
export const ok = (command: string, stdout: string): Step => ({ command, exitCode: 0, stdout, stderr: '' })
export const fail = (command: string, stderr: string, stdout = ''): Step => ({ command, exitCode: 1, stdout, stderr })
export const created = (name: string, dir: string): string => `Created migration ${name} in ${dir}\nMigration created. Run migrate up ${name} to apply the migration\n`
export const adding = (file: string): string => `Adding migration ${file} into database. State is down\n`
export const work = (name: string): string => `<consumer>/work/${name}`

export const URI_REQUIRED = 'You need to provide the MongoDB Connection URI to persist migration status.\nUse option --uri / -d to provide the URI.\n'
export const DOC_KEYS = ['__v', '_id', 'createdAt', 'name', 'state', 'updatedAt']
export const TEMPLATE = `// Import your schemas here
import type { Connection } from 'mongoose'

export async function up (connection: Connection): Promise<void> {
  // Write migration here
}

export async function down (connection: Connection): Promise<void> {
  // Write migration here
}
`

export const readmeHelp = (): string => {
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8')
  const section = readme.slice(readme.indexOf('## Getting started with the CLI'))
  const block = /```text\n([\s\S]*?)```/.exec(section)?.[1]
  if (!block) throw new Error('README has no CLI help block')
  return block
}

export const migrationDoc = (name: string, state: 'up' | 'down') => ({ __v: 0, _id: '<id>', createdAt: '<date>', name, state, updatedAt: '<date>' })
export const db = (name: string, key = 'db') => scenario(name)[key] as Record<string, Record<string, unknown>[]>
export const states = (docs: Record<string, unknown>[] = []) => Object.fromEntries(docs.map((doc) => [doc.name, doc.state]))
export const names = (docs: Record<string, unknown>[] = []) => docs.map((doc) => doc.name)
