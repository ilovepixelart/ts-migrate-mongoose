import { describe, expect, it } from 'vitest'

import { stripVTControlCharacters } from 'node:util'
import { names, scenario, TEMPLATE } from './observations'

describe('programmatic API', () => {
  const api = scenario('api-esm')
  const result = (api.result ?? {}) as Record<string, unknown>
  const summary = (key: string) => (result[key] as { name: string }[]).map((doc) => doc.name)
  const rejected = (key: string) => (result[key] as { rejected?: unknown }).rejected

  it('law module-formats: behaves identically through require and import', () => {
    expect(scenario('api-cjs')).toEqual(api)
  })

  it('law connect: exits cleanly after close without writing to stdout or stderr', () => {
    expect(api).toMatchObject({ exitCode: 0, timedOut: false, stdout: '', stderr: '' })
    expect(result.consoleLog).toEqual([])
    expect(result.readyStateAfterClose).toBe(0)
  })

  it('law module-formats: exports Migrator and the Env enum', () => {
    expect(result.exports).toEqual(['Env', 'Migrator'])
    expect(result.env).toEqual(Object.fromEntries(['MIGRATE_CONFIG_PATH', 'MIGRATE_MONGO_COLLECTION', 'MIGRATE_MIGRATIONS_PATH', 'MIGRATE_AUTOSYNC', 'MIGRATE_CLI', 'MIGRATE_MODE', 'MIGRATE_MONGO_URI', 'MIGRATE_TEMPLATE_PATH'].map((key) => [key, key])))
    expect(result.isMigrator).toBe(true)
  })

  it('law api-logging: logs migration status to the console only with the cli option, not with the MIGRATE_CLI variable', () => {
    expect((result.cliOptionLog as string[]).map((line) => stripVTControlCharacters(line))).toEqual(['down: <timestamp>-seeded', 'down: <timestamp>-first'])
    expect(result.cliEnvLog).toEqual([])
  })

  it("law strict-query: turns off the consumer's process-wide mongoose strictQuery on connect", () => {
    expect(result.strictQueryAfterConnect).toBe(false)
  })

  it('law run-model: creates, runs, syncs, prunes and lists migrations', () => {
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
    expect(result.pruneNothing).toEqual([])
  })

  it('law create: the migration model requires a name, accepts only the states down and up, defaults to down and indexes createdAt', () => {
    expect(result.modelValidation).toEqual([{ rejected: { name: 'ValidationError', message: 'migrations validation failed: name: Path `name` is required.' } }, { rejected: { name: 'ValidationError', message: 'migrations validation failed: state: `sideways` is not a valid enum value for path `state`.' } }, {}, {}])
    expect(result.modelDefaultState).toBe('down')
    expect(result.modelIndexes).toEqual(['_id', 'createdAt'])
  })

  it('law run-input: rejects a migration name that is not a string, including query operator objects', () => {
    expect(rejected('upNonString')).toEqual({ name: 'Error', message: 'migrationName must be a string, received number' })
    expect(rejected('upOperator')).toEqual({ name: 'Error', message: 'migrationName must be a string, received object' })
    expect(rejected('downOperator')).toEqual({ name: 'Error', message: 'migrationName must be a string, received object' })
  })

  it('law create: rejects with specific errors', () => {
    expect(rejected('upMissing')).toEqual({ name: 'Error', message: "Could not find migration with name 'missing' in the database" })
    expect(rejected('createTraversal')).toEqual({ name: 'Error', message: "Invalid migration name 'a/../../escaped'. Allowed characters: letters, digits, underscore, hyphen, and non-consecutive dots." })
    expect(rejected('createDuplicate')).toEqual({ name: 'Error', message: "There is already a migration with name 'first' in the database" })
    expect(rejected('connectWithoutUri')).toEqual({ name: 'Error', message: 'No mongoose connection or mongo uri provided to migrator' })
  })

  it('law create: creates ./migrations in the working directory when no migrationsPath is given', () => {
    expect(result.defaultMigrationsFolder).toEqual(['migrations'])
  })

  it('wraps a migrations path that is not a folder in sync and prune errors with the file system cause', () => {
    const cause = { name: 'Error', message: "ENOTDIR: not a directory, scandir '<work>/not-a-folder'" }
    expect(rejected('syncNotAFolder')).toEqual({ name: 'Error', message: 'Could not synchronize migrations in the migrations folder up to the database', cause })
    expect(rejected('pruneNotAFolder')).toEqual({ name: 'Error', message: 'Could not prune extraneous migrations from database', cause })
  })

  it('law failure-stops: wraps a failing migration with its cause and leaves earlier migrations applied', () => {
    expect(rejected('upFailing')).toEqual({ name: 'Error', message: "Failed to run migration with name 'broken' due to an error", cause: { name: 'Error', message: 'boom' } })
    expect(result.listAfterFailure).toEqual([
      { name: 'seeded', state: 'up', filename: '<timestamp>-seeded' },
      { name: 'first', state: 'up', filename: '<timestamp>-first' },
      { name: 'broken', state: 'down', filename: '<timestamp>-broken' },
    ])
    expect(names((api.db as Record<string, Record<string, unknown>[]>).items)).toEqual(['first', 'seeded'])
  })

  it('law connect: rejects an unreachable server within the configured timeout and releases the connection', () => {
    expect(rejected('connectRefused')).toEqual({ name: 'MongooseServerSelectionError', message: 'connect ECONNREFUSED 127.0.0.1:<closed-port>' })
    expect(result.connectRefusedWithin20s).toBe(true)
  })
})
