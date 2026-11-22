import { describe, expect, it } from 'vitest'

import fs from 'node:fs'
import path from 'node:path'
import { repoRoot } from '../harness'
import { laws } from '../laws'
import { created, db, names, readmeHelp, scenario, scenarioNames, steps, TEMPLATE, URI_REQUIRED, work } from './observations'

import type { Step } from '../harness'

const contractSources = fs
  .readdirSync(import.meta.dirname)
  .filter((file) => file.endsWith('.e2e.ts'))
  .map((file) => fs.readFileSync(path.join(import.meta.dirname, file), 'utf8'))
  .join('\n')

const help = readmeHelp()
const section = (title: string): string[] => help.split(`${title}:\n`)[1]?.split('\n\n')[0]?.split('\n') ?? []
const api = scenario('api-esm').result as { exports: string[]; env: Record<string, string> }
const nest = scenario('nest-esm').result as { nestExports: string[] }
const members = (scenario('manifest') as { publicMembers: Record<string, string[]> }).publicMembers

// Every public subject of the artifact, as the law registry names them.
const subjects = [
  ...section('Commands').map((line) => `cli:${line.trim().split(' ')[0] ?? ''}`),
  ...section('Options').flatMap((line) => [...line.matchAll(/(?:^|\s)(--?[a-z][a-z-]*)/g)].map((match) => match[1] ?? '')),
  ...Object.keys(api.env).map((key) => `env:${key}`),
  ...[...api.exports, ...nest.nestExports].map((name) => `export:${name}`),
  ...Object.entries(members).flatMap(([owner, list]) => list.map((member) => `${owner}.${member}`)),
]

describe('law registry (tests/e2e/laws.ts)', () => {
  it('reads every kind of subject from the artifact', () => {
    expect(Object.keys(members).sort()).toEqual(['MigrationModule', 'MigrationService', 'Migrator'])
    expect(subjects.filter((subject) => subject.startsWith('cli:'))).toHaveLength(5)
    expect(subjects.filter((subject) => subject.startsWith('export:'))).toHaveLength(5)
  })

  it.each(subjects)('names %s in at least one law', (subject) => {
    expect(laws.filter((law) => law.subjects.includes(subject)).map((law) => law.id)).not.toEqual([])
  })

  it.each(laws.map((law) => law.id))('has a contract test for law %s', (id) => {
    expect(contractSources).toMatch(new RegExp(`'law ${id}: |"law ${id}: `))
  })

  it('names no subject the artifact does not have, and no law twice', () => {
    expect(laws.flatMap((law) => law.subjects).filter((subject) => !subjects.includes(subject))).toEqual([])
    expect(new Set(laws.map((law) => law.id)).size).toBe(laws.length)
  })
})

describe('laws checked across every scenario', () => {
  // Terminal-driven steps merge stderr into stdout, so the exit law reads only the plain command runs.
  const commandSteps = scenarioNames()
    .filter((name) => !name.startsWith('interactive'))
    .flatMap((name) => (scenario(name).steps ?? []).map((step) => ({ name, ...step })))

  it('law cli-exit: every command exits 0 with an empty stderr or 1 with a reason on stderr', () => {
    expect(commandSteps.length).toBeGreaterThan(100)
    const broken = commandSteps.filter((step: Step & { name: string }) => !((step.exitCode === 0 && step.stderr === '') || (step.exitCode === 1 && step.stderr.trim() !== '')))
    expect(broken.map((step) => `${step.name}: ${step.command} -> ${String(step.exitCode)}`)).toEqual([])
  })
})

describe('law option-precedence: command line > environment > config file > default, in all 8 combinations', () => {
  const MASKS = [0, 1, 2, 3, 4, 5, 6, 7]
  // Bit 0 sets the command line, bit 1 the environment, bit 2 the config file; the first one set wins.
  const winner = (mask: number): string => (['cli', 'env', 'file'] as const).find((_, bit) => (mask >> bit) & 1) ?? 'default'
  const stepsOk = (name: string, dir: (mask: number) => string): void => {
    expect(steps(name).map((step) => [step.exitCode, step.stderr])).toEqual(MASKS.map(() => [0, '']))
    expect(steps(name).map((step) => step.stdout.split('\n').at(-3))).toEqual(MASKS.map((mask) => `Created migration mask-${String(mask)} in ${work(name)}/mask-${String(mask)}/${dir(mask)}`))
  }

  it('law option-precedence: collection', () => {
    stepsOk('precedence-collection', () => 'migrations')
    const where = (mask: number) => Object.entries(db('precedence-collection')).flatMap(([collection, docs]) => (names(docs).includes(`mask-${String(mask)}`) ? [collection] : []))
    expect(MASKS.map(where)).toEqual(MASKS.map((mask) => [winner(mask) === 'default' ? 'migrations' : `c${String(mask)}_${winner(mask)}`]))
  })

  it('law option-precedence: migrations path', () => {
    const dir = (mask: number) => (winner(mask) === 'default' ? 'migrations' : `from-${winner(mask)}`)
    stepsOk('precedence-migrations-path', dir)
    const files = Object.keys(scenario('precedence-migrations-path').tree as object).filter((file) => file.endsWith('.ts') && !file.includes('/template-'))
    expect(files.sort()).toEqual(MASKS.map((mask) => `mask-${String(mask)}/${dir(mask)}/<timestamp>-mask-${String(mask)}.ts`).sort())
  })

  it('law option-precedence: template path', () => {
    stepsOk('precedence-template-path', () => 'migrations')
    const tree = scenario('precedence-template-path').tree as Record<string, string>
    expect(MASKS.map((mask) => tree[`mask-${String(mask)}/migrations/<timestamp>-mask-${String(mask)}.ts`])).toEqual(MASKS.map((mask) => (winner(mask) === 'default' ? TEMPLATE : `// template from ${winner(mask)}\n`)))
  })

  it('law option-precedence: uri, connecting only through the source that should win', () => {
    const [none, ...rest] = steps('precedence-uri')
    expect(none).toEqual({ command: 'migrate create mask-0', exitCode: 1, stdout: '', stderr: URI_REQUIRED })
    expect(rest.map((step) => [step.exitCode, step.stdout])).toEqual(MASKS.slice(1).map((mask) => [0, created(`mask-${String(mask)}`, `${work('precedence-uri')}/mask-${String(mask)}/migrations`)]))
    expect(MASKS.slice(1).map((mask) => names(db('precedence-uri')[`u${String(mask)}`]))).toEqual(MASKS.slice(1).map((mask) => [`mask-${String(mask)}`]))
  })
})

describe('law option-precedence: autosync, mode and config path', () => {
  const MASKS = [0, 1, 2, 3, 4, 5, 6, 7]
  const winner = (mask: number): string => (['cli', 'env', 'file'] as const).find((_, bit) => (mask >> bit) & 1) ?? 'default'
  const collectionOf = (name: string, mask: number) => Object.entries(db(name)).flatMap(([collection, docs]) => (names(docs).includes(`mask-${String(mask)}`) ? [collection] : []))

  // autosync is observed on a terminal: on, new files are imported without a prompt; off, the prompt appears and
  // Enter imports nothing. Each run gives the winning source one value and every other source the opposite.
  const autosyncRuns = [true, false].flatMap((winnerValue) => MASKS.map((mask) => ({ winnerValue, mask })))
  const autosyncObserved = (index: number) => {
    const step = steps('precedence-autosync')[index]
    const run = autosyncRuns[index] as { winnerValue: boolean; mask: number }
    return [step?.stdout.includes('? The following'), names(db('precedence-autosync')[`${String(run.winnerValue)}_${String(run.mask)}`])]
  }
  const asAutosync = (on: boolean) => (on ? [false, ['pending']] : [true, []])
  // getEnvBoolean reads only "true", so MIGRATE_AUTOSYNC=false counts as unset and a config file's true wins.
  const envFalseOverFileTrue = (run: { winnerValue: boolean; mask: number }) => run.mask === 6 && !run.winnerValue

  it('law option-precedence: autosync, shown by whether the import prompt appears on a terminal', () => {
    const conforming = autosyncRuns.map((run, index) => ({ run, index })).filter(({ run }) => !envFalseOverFileTrue(run))
    expect(conforming).toHaveLength(15)
    expect(conforming.map(({ index }) => autosyncObserved(index))).toEqual(conforming.map(({ run }) => asAutosync(run.mask === 0 ? false : run.winnerValue)))
  })

  // Known defect, pinned as it is: MIGRATE_AUTOSYNC=false does not override autosync: true from the config file,
  // against the documented order (command line > environment > config file). A fix fails this test.
  it('law option-precedence: known defect: MIGRATE_AUTOSYNC=false loses to autosync: true in the config file', () => {
    const index = autosyncRuns.findIndex(envFalseOverFileTrue)
    expect(autosyncObserved(index)).toEqual(asAutosync(true))
  })

  it('law option-precedence: mode, from --mode, else MIGRATE_MODE in the process, else MIGRATE_MODE in .env', () => {
    expect(steps('precedence-mode').map((step) => step.exitCode)).toEqual(MASKS.map(() => 0))
    expect(MASKS.map((mask) => collectionOf('precedence-mode', mask))).toEqual(MASKS.map((mask) => [winner(mask) === 'default' ? 'migrations' : `mode${String(mask)}_${winner(mask)}`]))
  })

  it('law option-precedence: config path, from -f, else MIGRATE_CONFIG_PATH in the process, else in .env, else ./migrate', () => {
    expect(steps('precedence-config-path').map((step) => step.exitCode)).toEqual(MASKS.map(() => 0))
    expect(MASKS.map((mask) => collectionOf('precedence-config-path', mask))).toEqual(MASKS.map((mask) => [`cfg${String(mask)}_${winner(mask)}`]))
  })
})

describe('laws of documented features', () => {
  it('law alias-imports: a migration imports a model through a tsconfig.json path alias', () => {
    expect(steps('alias-imports')).toEqual([{ command: 'migrate up -d <mongo>/alias_imports', exitCode: 0, stderr: '', stdout: expect.stringMatching(/up: <timestamp>-aliased\nAll migrations finished successfully\n$/) as unknown as string }])
    expect(names(db('alias-imports').people)).toEqual(['aliased'])
  })

  it('law compatibility: the README supported ranges are the declared engines and mongoose peer range', () => {
    const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8')
    const supported = JSON.parse(/## Supports and tested with\n\n```json\n([\s\S]*?)```/.exec(readme)?.[1] ?? '{}') as { node: string; mongoose: string }
    const { manifest } = scenario('manifest') as { manifest: { engines: { node: string }; peerDependencies: { mongoose: string } } }
    // Ranges compare as semver reads them: "< 10" and "<10" are the same bound.
    const range = (text: string) => text.replaceAll(/([<>=~^]+)\s+/g, '$1')
    expect({ node: range(manifest.engines.node), mongoose: range(manifest.peerDependencies.mongoose) }).toEqual({ node: range(supported.node), mongoose: range(supported.mongoose) })
  })
})

describe('laws checked against the installed Migrator (tests/laws)', () => {
  const observed = scenario('laws')
  const result = observed.result as { modelRuns?: number; modelFailure?: string; singleRerun: unknown; names: { checked: number; accepted: number; mismatches: string[] } }

  it('law run-model: run, sync, prune and list agree with the proven model on 25 seeded random sequences', () => {
    expect(observed).toMatchObject({ exitCode: 0, timedOut: false, stderr: '' })
    expect(result.modelFailure).toBeUndefined()
    expect(result.modelRuns).toBe(25)
  })

  it('law name-safe: create accepts exactly the names the proven validator accepts', () => {
    expect(result.names.checked).toBeGreaterThan(200)
    expect(result.names.accepted).toBeGreaterThan(10)
    expect(result.names.mismatches).toEqual([])
  })

  // Known defect, pinned as it is: a named single step runs a migration already in the target state again, where the
  // model runs nothing. A fix fails this test.
  it('law single: known defect: a named single step runs a migration already in the target state again', () => {
    expect(result.singleRerun).toEqual({ model: [], ran: ['m0'], executed: ['m0:up'] })
  })

  it('law create: exposes the records through migrationModel, in the configured collection', () => {
    const apiResult = scenario('api-esm').result as { modelCollection: string; modelStates: string[] }
    expect(apiResult.modelCollection).toBe('migrations')
    expect(apiResult.modelStates).toEqual(['first:down', 'second:down'])
  })
})
