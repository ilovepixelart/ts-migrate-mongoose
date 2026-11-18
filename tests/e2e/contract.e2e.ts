import { describe, expect, it } from 'vitest'

import fs from 'node:fs'
import path from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { repoRoot } from './harness'

import type { Step } from './harness'

const observationsDir = process.env.E2E_OBSERVATIONS
if (!observationsDir) throw new Error('E2E_OBSERVATIONS is not set: run the suite with `npm run test:e2e`')

type Observation = Record<string, unknown> & { steps?: Step[] }
const candidate = JSON.parse(fs.readFileSync(path.join(observationsDir, 'candidate.json'), 'utf8')) as Record<string, Observation>

const scenario = (name: string): Observation => {
  const observation = candidate[name]
  if (!observation) throw new Error(`No observation recorded for scenario '${name}'`)
  if (observation.harnessError) throw new Error(`Scenario '${name}' did not complete: ${String(observation.harnessError)}`)
  return observation
}

const plain = (step: Step): Step => ({ ...step, stdout: stripVTControlCharacters(step.stdout), stderr: stripVTControlCharacters(step.stderr) })
const steps = (name: string): Step[] => (scenario(name).steps ?? []).map(plain)
const ok = (command: string, stdout: string): Step => ({ command, exitCode: 0, stdout, stderr: '' })
const fail = (command: string, stderr: string, stdout = ''): Step => ({ command, exitCode: 1, stdout, stderr })
const created = (name: string, dir: string): string => `Created migration ${name} in ${dir}\nMigration created. Run migrate up ${name} to apply the migration\n`
const adding = (file: string): string => `Adding migration ${file} into database. State is down\n`
const work = (name: string): string => `<consumer>/work/${name}`

const URI_REQUIRED = 'You need to provide the MongoDB Connection URI to persist migration status.\nUse option --uri / -d to provide the URI.\n'
const DOC_KEYS = ['__v', '_id', 'createdAt', 'name', 'state', 'updatedAt']
const TEMPLATE = `// Import your schemas here
import type { Connection } from 'mongoose'

export async function up (connection: Connection): Promise<void> {
  // Write migration here
}

export async function down (connection: Connection): Promise<void> {
  // Write migration here
}
`

const readmeHelp = (): string => {
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8')
  const section = readme.slice(readme.indexOf('## Getting started with the CLI'))
  const block = /```text\n([\s\S]*?)```/.exec(section)?.[1]
  if (!block) throw new Error('README has no CLI help block')
  return block
}

const migrationDoc = (name: string, state: 'up' | 'down') => ({ __v: 0, _id: '<id>', createdAt: '<date>', name, state, updatedAt: '<date>' })
const db = (name: string, key = 'db') => scenario(name)[key] as Record<string, Record<string, unknown>[]>
const states = (docs: Record<string, unknown>[] = []) => Object.fromEntries(docs.map((doc) => [doc.name, doc.state]))
const names = (docs: Record<string, unknown>[] = []) => docs.map((doc) => doc.name)

describe('CLI binary', () => {
  it('prints the README help text for no command, -h, --help and a command with --help', () => {
    const help = `${readmeHelp()}\n`
    expect(steps('help')).toEqual([ok('migrate', help), ok('migrate -h', help), ok('migrate --help', help), ok('migrate up --help', help)])
  })

  it('prints the installed package version for -v and --version without a database', () => {
    expect(steps('version')).toEqual([ok('migrate -v', '<version>\n'), ok('migrate --version', '<version>\n')])
  })

  it('reports argument errors in red on stderr with exit code 1', () => {
    const [noUri, single, unknownOption, unknownNoUri, unknownCommand, createNoName, downNoName] = steps('argument-errors')
    expect(noUri).toEqual(fail('migrate list', URI_REQUIRED))
    expect(single).toEqual(fail('migrate list -s -d <mongo>/argument_errors', "Option --single is only valid for 'up' and 'down' commands\n"))
    expect(unknownOption?.exitCode).toBe(1)
    expect(unknownOption?.stderr).toMatch(/^Unknown option '--nope'\./)
    expect(unknownNoUri).toEqual(fail('migrate frobnicate', URI_REQUIRED))
    expect(unknownCommand).toEqual(fail('migrate frobnicate -d <mongo>/argument_errors', `${readmeHelp()}\nUnknown command: frobnicate\n`))
    expect(createNoName).toEqual(fail('migrate create -d <mongo>/argument_errors', 'Migration name is required for create command\n'))
    expect(downNoName).toEqual(fail('migrate down -d <mongo>/argument_errors', 'Migration name is required for down command\n'))
    expect(scenario('argument-errors').steps?.[0]?.stderr.startsWith('\u001b[31m')).toBe(true)
  })

  it('starts cold against an empty database, creating the migrations folder and collection', () => {
    expect(steps('cold-start')).toEqual([ok('migrate up -d <mongo>/cold_start', 'There are no pending migrations\nCurrent migrations status:\nThere are no migrations to list\n'), ok('migrate list -d <mongo>/cold_start', 'Listing migrations\nThere are no migrations to list\n')])
    expect(scenario('cold-start').tree).toEqual({ 'migrations/': null })
    expect(db('cold-start')).toEqual({ migrations: [] })
  })

  it('creates a timestamped .ts file from the default template and a down record', () => {
    const invalid = (name: string) => `Invalid migration name '${name}'. Allowed characters: letters, digits, underscore, hyphen, and non-consecutive dots.\n`
    expect(steps('create')).toEqual([
      ok('migrate create first-migration -d <mongo>/create', created('first-migration', `${work('create')}/migrations`)),
      fail('migrate create first-migration -d <mongo>/create', "There is already a migration with name 'first-migration' in the database\n"),
      fail('migrate create a/../../escaped -d <mongo>/create', invalid('a/../../escaped')),
      fail('migrate create ../escaped -d <mongo>/create', invalid('../escaped')),
      ok('migrate create my.migration_v2 -d <mongo>/create', created('my.migration_v2', `${work('create')}/migrations`)),
      ok('migrate list -d <mongo>/create', 'Listing migrations\ndown: <timestamp>-first-migration\ndown: <timestamp>-my.migration_v2\n'),
    ])
    expect(scenario('create').tree).toEqual({ 'migrations/': null, 'migrations/<timestamp>-first-migration.ts': TEMPLATE, 'migrations/<timestamp>-my.migration_v2.ts': TEMPLATE })
    expect(db('create')).toEqual({ migrations: [migrationDoc('first-migration', 'down'), migrationDoc('my.migration_v2', 'down')] })
  })

  it('syncs new files and runs every pending migration in timestamp order, importing TypeScript models', () => {
    const dir = `${work('up-all')}/migrations`
    expect(steps('up-all')).toEqual([
      ok('migrate up -d <mongo>/up_all', `${adding(`${dir}/<timestamp>-add-alice`)}${adding(`${dir}/<timestamp>-add-bob`)}${adding(`${dir}/<timestamp>-add-carol`)}up: <timestamp>-add-alice\nup: <timestamp>-add-bob\nup: <timestamp>-add-carol\nAll migrations finished successfully\n`),
      ok('migrate up -d <mongo>/up_all', 'There are no pending migrations\nCurrent migrations status:\nup: <timestamp>-add-alice\nup: <timestamp>-add-bob\nup: <timestamp>-add-carol\n'),
    ])
    expect(states(db('up-all').migrations)).toEqual({ 'add-alice': 'up', 'add-bob': 'up', 'add-carol': 'up' })
    expect(names(db('up-all').people)).toEqual(['alice', 'bob', 'carol'])
    expect(Object.keys(db('up-all').migrations?.[0] ?? {})).toEqual(DOC_KEYS)
  })

  it('runs up to and down to a named migration, inclusive', () => {
    const [up, ...rest] = steps('up-down-to-name')
    expect(up?.stdout).toMatch(/State is down\nup: <timestamp>-add-alice\nup: <timestamp>-add-bob\nAll migrations finished successfully\n$/)
    expect(rest).toEqual([
      ok('migrate list -d <mongo>/up_down_to_name', 'Listing migrations\nup: <timestamp>-add-alice\nup: <timestamp>-add-bob\ndown: <timestamp>-add-carol\n'),
      ok('migrate up -d <mongo>/up_down_to_name', 'up: <timestamp>-add-carol\nAll migrations finished successfully\n'),
      ok('migrate down add-bob -d <mongo>/up_down_to_name', 'down: <timestamp>-add-carol\ndown: <timestamp>-add-bob\nAll migrations finished successfully\n'),
      ok('migrate list -d <mongo>/up_down_to_name', 'Listing migrations\nup: <timestamp>-add-alice\ndown: <timestamp>-add-bob\ndown: <timestamp>-add-carol\n'),
      ok('migrate down add-alice -d <mongo>/up_down_to_name', 'down: <timestamp>-add-alice\nAll migrations finished successfully\n'),
    ])
    expect(states(db('up-down-to-name').migrations)).toEqual({ 'add-alice': 'down', 'add-bob': 'down', 'add-carol': 'down' })
    expect(db('up-down-to-name').people).toEqual([])
  })

  it('runs exactly one migration with -s / --single', () => {
    const [upBob, ...rest] = steps('single')
    expect(upBob?.stdout).toMatch(/State is down\nup: <timestamp>-add-bob\nAll migrations finished successfully\n$/)
    expect(rest).toEqual([
      ok('migrate down add-bob --single -d <mongo>/single', 'down: <timestamp>-add-bob\nAll migrations finished successfully\n'),
      ok('migrate up -s -d <mongo>/single', 'up: <timestamp>-add-alice\nAll migrations finished successfully\n'),
      fail('migrate down -s -d <mongo>/single', 'Migration name is required for down command\n'),
      ok('migrate list -d <mongo>/single', 'Listing migrations\nup: <timestamp>-add-alice\ndown: <timestamp>-add-bob\ndown: <timestamp>-add-carol\n'),
    ])
    expect(names(db('single').people)).toEqual(['alice'])
  })

  it('fails with the migration name when a named migration or its file is missing', () => {
    const [upMissing, downMissing, , upGone] = steps('missing-migration')
    expect(upMissing).toEqual(fail('migrate up nope -d <mongo>/missing_migration', "Could not find migration with name 'nope' in the database\n"))
    expect(downMissing).toEqual(fail('migrate down nope -d <mongo>/missing_migration', "Could not find migration with name 'nope' in the database\n"))
    expect(upGone?.exitCode).toBe(1)
    expect(upGone?.stderr).toContain(`Cannot find module '${work('missing-migration')}/migrations/<timestamp>-gone'`)
    expect(db('missing-migration')).toEqual({ migrations: [migrationDoc('gone', 'down')] })
  })

  it('stops at a failing migration, exits 1 and keeps earlier migrations applied', () => {
    const dir = `${work('failing-migration')}/migrations`
    expect(steps('failing-migration')).toEqual([
      fail('migrate up -d <mongo>/failing_migration', "Failed to run migration with name 'explode' due to an error\n", `${adding(`${dir}/<timestamp>-add-alice`)}${adding(`${dir}/<timestamp>-explode`)}${adding(`${dir}/<timestamp>-add-carol`)}up: <timestamp>-add-alice\n`),
      ok('migrate list -d <mongo>/failing_migration', 'Listing migrations\nup: <timestamp>-add-alice\ndown: <timestamp>-explode\ndown: <timestamp>-add-carol\n'),
    ])
    expect(states(db('failing-migration').migrations)).toEqual({ 'add-alice': 'up', explode: 'down', 'add-carol': 'down' })
    expect(names(db('failing-migration').people)).toEqual(['alice'])
  })

  it('names the missing export when a migration has no down function', () => {
    const [, down] = steps('missing-export')
    expect(down).toEqual(fail('migrate down only-up -d <mongo>/missing_export', "The 'down' export is not defined in <timestamp>-only-up.\n"))
    expect(states(db('missing-export').migrations)).toEqual({ 'only-up': 'up' })
  })

  it('runs .js, .mjs and .cjs migrations with named and default exports and ignores .d.ts files', () => {
    const [up, down] = steps('js-migrations')
    expect(up?.stdout).toMatch(/up: <timestamp>-esm-named\nup: <timestamp>-esm-default\nup: <timestamp>-commonjs\nAll migrations finished successfully\n$/)
    expect(down).toEqual(ok('migrate down esm-named -d <mongo>/js_migrations', 'down: <timestamp>-commonjs\ndown: <timestamp>-esm-default\ndown: <timestamp>-esm-named\nAll migrations finished successfully\n'))
    expect(states(db('js-migrations', 'afterUp').migrations)).toEqual({ commonjs: 'up', 'esm-default': 'up', 'esm-named': 'up' })
    expect(names(db('js-migrations', 'afterUp').people)).toEqual(['commonjs', 'esm-default', 'esm-named'])
    expect(db('js-migrations', 'afterDown').people).toEqual([])
  })

  it('prunes database records whose files were deleted', () => {
    expect(steps('prune').slice(2)).toEqual([ok('migrate prune -d <mongo>/prune', 'Removing migration(s) from database:\ndrop\n'), ok('migrate prune -d <mongo>/prune', ''), ok('migrate list -d <mongo>/prune', 'Listing migrations\ndown: <timestamp>-keep\n')])
    expect(db('prune')).toEqual({ migrations: [migrationDoc('keep', 'down')] })
  })

  it('imports migration files without a prompt when stdin is not a TTY, ignoring non-migration files', () => {
    const dir = `${work('sync')}/migrations`
    expect(steps('sync')).toEqual([
      ok('migrate list -a true -d <mongo>/sync', `Listing migrations\n${adding(`${dir}/<timestamp>-seeded`)}down: <timestamp>-seeded\n`),
      ok('migrate list --autosync false -d <mongo>/sync', `Listing migrations\n${adding(`${dir}/<timestamp>-later`)}down: <timestamp>-seeded\ndown: <timestamp>-later\n`),
    ])
    expect(states(db('sync').migrations)).toEqual({ later: 'down', seeded: 'down' })
  })
})

describe('CLI configuration', () => {
  it.each([
    ['config-ts', 'from-ts', 'ts-migrations', 'ts_config'],
    ['config-js-esm', 'from-esm', 'js-migrations', 'esm_config'],
    ['config-js-cjs', 'from-cjs', 'cjs-migrations', 'cjs_config'],
    ['config-json', 'from-json', 'json-migrations', 'json_config'],
  ])('reads uri, collection and migrationsPath from the default config file (%s)', (name, migration, folder, collection) => {
    expect(steps(name)[0]).toEqual(ok(`migrate create ${migration}`, created(migration, `${work(name)}/${folder}`)))
    expect(db(name)).toEqual({ [collection]: [migrationDoc(migration, 'down')] })
  })

  it('uses templatePath from migrate.json', () => {
    expect(scenario('config-json').tree).toMatchObject({ 'json-migrations/<timestamp>-from-json.ts': '// json config template\n' })
  })

  it('finds the config file through -f, --config-path without extension and MIGRATE_CONFIG_PATH', () => {
    const dir = `${work('config-path')}/custom-migrations`
    expect(steps('config-path')).toEqual([ok('migrate create by-flag -f ./conf/custom.json', created('by-flag', dir)), ok('migrate create by-long-flag --config-path ./conf/custom', created('by-long-flag', dir)), ok('migrate create by-env', created('by-env', dir))])
    expect(states(db('config-path').custom_config)).toEqual({ 'by-env': 'down', 'by-flag': 'down', 'by-long-flag': 'down' })
  })

  it('reports an unusable explicit config file and then the missing URI', () => {
    const [yaml, missing, broken, brokenDefault] = steps('config-errors')
    expect(yaml).toEqual(fail('migrate list -f ./migrate.yaml', `Config file must have an extension of .ts, .js, .json\n${URI_REQUIRED}`))
    expect(missing?.exitCode).toBe(1)
    expect(missing?.stderr).toMatch(new RegExp(`^Cannot find module '${work('config-errors')}/missing.json'[^\\n]*\\n${URI_REQUIRED.replaceAll('.', '\\.')}$`))
    expect(broken?.exitCode).toBe(1)
    expect(broken?.stderr).toContain(`${work('config-errors')}/broken.json`)
    expect(broken?.stderr.endsWith(URI_REQUIRED)).toBe(true)
    expect(brokenDefault).toEqual(fail('migrate list', URI_REQUIRED))
  })

  it('loads .env, .env.local, .env.[mode] and .env.[mode].local in override order', () => {
    expect(db('env-files').env_base?.map((doc) => doc.name)).toEqual(['from-env'])
    expect(names(db('env-files').env_local)).toContain('local-beats-process')
    expect(names(db('env-files').env_staging)).toContain('from-mode-flag')
    expect(names(db('env-files').env_staging_local)).toEqual(expect.arrayContaining(['from-mode-local', 'from-mode-env']))
    expect(Object.keys(db('env-files')).sort()).toEqual(['env_base', 'env_local', 'env_staging', 'env_staging_local'])
    for (const step of steps('env-files')) expect(step.exitCode).toBe(0)
  })

  it('reads MIGRATE_* variables and their camelCase forms from the process environment', () => {
    const [viaEnv, viaCamel, autosync] = steps('env-vars')
    expect(viaEnv).toEqual(ok('migrate create via-env', created('via-env', `${work('env-vars')}/env-migrations`)))
    expect(viaCamel).toEqual(ok('migrate create via-camel-case', created('via-camel-case', `${work('env-vars')}/camel-migrations`)))
    expect(autosync).toEqual(ok('migrate up', `${adding(`${work('env-vars')}/seed/<timestamp>-seeded`)}up: <timestamp>-seeded\nAll migrations finished successfully\n`))
    expect(scenario('env-vars').tree).toMatchObject({ 'env-migrations/<timestamp>-via-env.ts': '// template from MIGRATE_TEMPLATE_PATH\n', 'camel-migrations/<timestamp>-via-camel-case.ts': TEMPLATE })
    expect(Object.keys(db('env-vars')).sort()).toEqual(['camel_collection', 'env_collection', 'migrations', 'people'])
  })

  it('applies command line > environment > config file', () => {
    const dir = work('precedence')
    expect(steps('precedence').map((step) => step.stdout.split('\n').at(-3))).toEqual([`Created migration file-wins in ${dir}/file-migrations`, `Created migration env-wins in ${dir}/env-migrations`, `Created migration cli-wins in ${dir}/cli-migrations`, `Created migration cli-uri-wins in ${dir}/file-migrations`])
    expect(names(db('precedence').from_file)).toEqual(['file-wins'])
    expect(names(db('precedence').from_env)).toEqual(['env-wins'])
    expect(names(db('precedence').from_cli)).toEqual(['cli-wins'])
    expect(names(db('precedence').from_cli_uri)).toEqual(['cli-uri-wins', 'file-wins'])
  })

  it('honours -t, -m and -c (short and long) and falls back to the default template for a missing template file', () => {
    const custom = '// custom template\nexport async function up(): Promise<void> {}\n'
    expect(steps('flags').map((step) => step.exitCode)).toEqual([0, 0, 0])
    expect(scenario('flags').tree).toMatchObject({ 'nested/deep/migrations/<timestamp>-templated.ts': custom, 'nested/deep/migrations/<timestamp>-templated-long.ts': custom, 'migrations/<timestamp>-missing-template.ts': TEMPLATE })
    expect(states(db('flags').custom_collection)).toEqual({ templated: 'down', 'templated-long': 'down' })
  })

  it('fails within the configured server selection timeout when MongoDB is unreachable', () => {
    expect(steps('connection-refused')).toEqual([fail('migrate list', 'connect ECONNREFUSED 127.0.0.1:<closed-port>\n')])
    expect(scenario('connection-refused').within20s).toBe(true)
  })
})

describe('programmatic API', () => {
  const api = scenario('api-esm')
  const result = (api.result ?? {}) as Record<string, unknown>
  const summary = (key: string) => (result[key] as { name: string }[]).map((doc) => doc.name)
  const rejected = (key: string) => (result[key] as { rejected?: unknown }).rejected

  it('behaves identically through require and import', () => {
    expect(scenario('api-cjs')).toEqual(api)
  })

  it('exits cleanly after close without writing to stdout or stderr', () => {
    expect(api).toMatchObject({ exitCode: 0, timedOut: false, stdout: '', stderr: '' })
    expect(result.consoleLog).toEqual([])
    expect(result.readyStateAfterClose).toBe(0)
  })

  it('exports Migrator and the Env enum', () => {
    expect(result.exports).toEqual(['Env', 'Migrator'])
    expect(result.env).toEqual(Object.fromEntries(['MIGRATE_CONFIG_PATH', 'MIGRATE_MONGO_COLLECTION', 'MIGRATE_MIGRATIONS_PATH', 'MIGRATE_AUTOSYNC', 'MIGRATE_CLI', 'MIGRATE_MODE', 'MIGRATE_MONGO_URI', 'MIGRATE_TEMPLATE_PATH'].map((key) => [key, key])))
    expect(result.isMigrator).toBe(true)
  })

  it('creates, runs, syncs, prunes and lists migrations', () => {
    expect(result.listEmpty).toEqual([])
    expect(result.created).toEqual([
      { name: 'first', state: 'down', filename: '<timestamp>-first' },
      { name: 'second', state: 'down', filename: '<timestamp>-second' },
    ])
    expect(result.template).toBe(TEMPLATE)
    expect(summary('upAll')).toEqual(['first', 'second'])
    expect(result.upNothingPending).toEqual([])
    expect(summary('downToFirst')).toEqual(['second', 'first'])
    expect(summary('upSingle')).toEqual(['first'])
    expect(summary('downSingle')).toEqual(['first'])
    expect(result.items).toEqual([])
    expect(result.sync).toEqual([{ name: 'seeded', state: 'down', filename: '<timestamp>-seeded' }])
    expect(summary('prune')).toEqual(['second'])
  })

  it('rejects with specific errors', () => {
    expect(rejected('upMissing')).toEqual({ name: 'Error', message: "Could not find migration with name 'missing' in the database" })
    expect(rejected('upNonString')).toEqual({ name: 'Error', message: 'migrationName must be a string, received number' })
    expect(rejected('createTraversal')).toEqual({ name: 'Error', message: "Invalid migration name 'a/../../escaped'. Allowed characters: letters, digits, underscore, hyphen, and non-consecutive dots." })
    expect(rejected('createDuplicate')).toEqual({ name: 'Error', message: "There is already a migration with name 'first' in the database" })
    expect(rejected('connectWithoutUri')).toEqual({ name: 'Error', message: 'No mongoose connection or mongo uri provided to migrator' })
  })

  it('wraps a failing migration with its cause and leaves earlier migrations applied', () => {
    expect(rejected('upFailing')).toEqual({ name: 'Error', message: "Failed to run migration with name 'broken' due to an error", cause: { name: 'Error', message: 'boom' } })
    expect(result.listAfterFailure).toEqual([
      { name: 'seeded', state: 'up', filename: '<timestamp>-seeded' },
      { name: 'first', state: 'up', filename: '<timestamp>-first' },
      { name: 'broken', state: 'down', filename: '<timestamp>-broken' },
    ])
    expect(names((api.db as Record<string, Record<string, unknown>[]>).items)).toEqual(['first', 'seeded'])
  })

  it('rejects an unreachable server within the configured timeout and releases the connection', () => {
    expect(rejected('connectRefused')).toEqual({ name: 'MongooseServerSelectionError', message: 'connect ECONNREFUSED 127.0.0.1:<closed-port>' })
    expect(result.connectRefusedWithin20s).toBe(true)
  })
})

describe('NestJS integration', () => {
  const nest = scenario('nest-esm')
  const result = (nest.result ?? {}) as Record<string, unknown>

  it('behaves identically through require and import', () => {
    expect(scenario('nest-cjs')).toEqual(nest)
  })

  it('exports the module, the service and the options token', () => {
    expect(result.nestExports).toEqual(['MIGRATION_OPTIONS', 'MigrationModule', 'MigrationService'])
    expect(result.optionsToken).toBe('symbol')
  })

  it('runs pending migrations on bootstrap, honours onBootstrap and closes on shutdown', () => {
    expect(nest).toMatchObject({ exitCode: 0, timedOut: false, stdout: '', stderr: '' })
    expect(result.instanceIsMigrator).toBe(true)
    expect(result.afterFirstBoot).toEqual([{ name: 'nest-first', state: 'up', filename: '<timestamp>-nest-first' }])
    expect(result.readyStateAfterClose).toBe(0)
    expect((result.onBootstrapDown as { name: string }[]).map((doc) => doc.name)).toEqual(['nest-first'])
    expect(result.afterUseClassBoot).toEqual([{ name: 'nest-first', state: 'up', filename: '<timestamp>-nest-first' }])
    expect(result.serviceLogs).toEqual([
      'log: Connected to migration database',
      'log: up: <timestamp>-nest-first',
      'log: Applied 1 migration(s)',
      'log: Connected to migration database',
      'log: All migrations are up to date (1 total)',
      'log: Connected to migration database',
      'log: Connected to migration database',
      'log: up: <timestamp>-nest-first',
      'log: Applied 1 migration(s)',
      'log: Connected to migration database',
      'log: No migrations found',
    ])
  })

  it('fails bootstrap with the connection error when MongoDB is unreachable', () => {
    expect(result.bootRefused).toEqual({ rejected: { name: 'MongooseServerSelectionError', message: 'connect ECONNREFUSED 127.0.0.1:<closed-port>' } })
  })
})

describe('package artifact', () => {
  it('type-checks a consumer under nodenext for both .mts and .cts', () => {
    expect(scenario('types')).toEqual({ exitCode: 0, stdout: '', stderr: '' })
  })

  it('links the migrate bin to dist/cli.js and ships every exported file', () => {
    const { manifest, files, binLink } = scenario('manifest') as { manifest: { bin: Record<string, string>; exports: Record<string, Record<string, Record<string, string>>> }; files: string[]; binLink: boolean }
    expect(binLink).toBe(true)
    expect(manifest.bin).toEqual({ migrate: './dist/cli.js' })
    const targets = Object.values(manifest.exports).flatMap((conditions) => Object.values(conditions).flatMap((entry) => Object.values(entry)))
    expect(targets).toHaveLength(8)
    for (const target of targets) expect(files).toContain(target.replace('./', ''))
  })
})
