import 'reflect-metadata'

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import fs from 'node:fs'
import path from 'node:path'
import { Logger } from '@nestjs/common'
import mongoose from 'mongoose'
import { chalk } from '../src/chalk'
import { Migrate } from '../src/commander'
import { Migrator } from '../src/index'
import { MigrationService } from '../src/nest/migration.service'
import { template } from '../src/template'
import { create } from './mongo/server'

// Pins what a single process observes today: return values, persisted state
// documents, CLI output and exit codes, and NestJS bootstrap logs. Expected
// values are written out by hand from the 5.4.0 behaviour.

const root = path.resolve('tests/characterization-tmp')
let seq = 0

const migrationSource = (id: string, ledger: string) => `
import type { Connection } from 'mongoose'
export async function up(connection: Connection) {
  await connection.collection('${ledger}').insertOne({ id: '${id}', dir: 'up' })
}
export async function down(connection: Connection) {
  await connection.collection('${ledger}').insertOne({ id: '${id}', dir: 'down' })
}
`

const failingSource = `
export async function up() {
  throw new Error('boom')
}
`

const scenario = (files: string[]) => {
  seq += 1
  const dir = path.join(root, `s${seq}`)
  fs.mkdirSync(dir, { recursive: true })
  const ledger = `char_ledger_${seq}`
  for (const file of files) fs.writeFileSync(path.join(dir, `${file}.ts`), migrationSource(file.slice(file.indexOf('-') + 1), ledger))
  return { dir, collection: `char_migrations_${seq}`, ledger }
}

type Scenario = ReturnType<typeof scenario>

const FIRST = '1700000000000-first'
const SECOND = '1710000000000-second'

const HELP_5_4_0 = [
  '\x1b[36mCLI migration tool for mongoose\x1b[0m',
  '',
  'Usage: migrate <command> [options]',
  '',
  'Commands:',
  '  list                       list all migrations',
  '  create <migration-name>    create a new migration file',
  '  up [migration-name]        run all migrations or a specific migration if name provided',
  '  down <migration-name>      roll back migrations down to given name',
  '  prune                      delete extraneous migrations from migration folder or database',
  '',
  'Options:',
  '  -f, --config-path <path>        path to the config file',
  '  -d, --uri <string>              mongo connection string',
  '  -c, --collection <string>       collection name to use for the migrations',
  '  -a, --autosync <boolean>        automatically sync new migrations without prompt',
  '  -m, --migrations-path <path>    path to the migration files',
  '  -t, --template-path <path>      template file to use when creating a migration',
  '      --mode <string>             environment mode to use .env.[mode] file',
  '  -s, --single                    run single migration (up/down only)',
  '  -h, --help                      display help',
  '  -v, --version                   display version',
  '',
]

describe('characterization of single-process behaviour', async () => {
  const { uri, destroy } = await create('characterization')
  const admin = await mongoose.createConnection(uri).asPromise()
  const open: Migrator[] = []

  const connect = async (s: Scenario, cli = false) => {
    const migrator = await Migrator.connect({ uri, migrationsPath: s.dir, collection: s.collection, autosync: true, cli })
    open.push(migrator)
    return migrator
  }
  const ledger = async (s: Scenario) => (await admin.collection(s.ledger).find().sort({ _id: 1 }).toArray()).map((row) => `${row.dir}:${row.id}`)
  const rawState = (s: Scenario) => admin.collection(s.collection).find().sort({ createdAt: 1 }).toArray()
  const filenames = (docs: { filename: string }[]) => docs.map((doc) => doc.filename)

  const captureLog = () => {
    const lines: string[] = []
    vi.spyOn(console, 'log').mockImplementation((line: string) => {
      lines.push(line)
    })
    return lines
  }

  const cli = async (exit: boolean, ...args: string[]) => {
    process.argv = ['node', 'migrate', ...args]
    return new Migrate().run(exit)
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    for (const migrator of open) await migrator.close().catch(() => undefined)
    await admin.close()
    fs.rmSync(root, { recursive: true, force: true })
    await destroy()
  })

  describe('programmatic API', () => {
    it('sync imports each file as a down state document with name, state and timestamps', async () => {
      const s = scenario([FIRST, SECOND])
      const migrator = await connect(s)
      const synced = await migrator.sync()
      expect(filenames(synced).sort()).toEqual([FIRST, SECOND])
      expect(synced.every((doc) => doc instanceof migrator.migrationModel)).toBe(true)

      const docs = await rawState(s)
      expect(docs.map((doc) => Object.keys(doc).sort())).toEqual([
        ['__v', '_id', 'createdAt', 'name', 'state', 'updatedAt'],
        ['__v', '_id', 'createdAt', 'name', 'state', 'updatedAt'],
      ])
      expect(docs.map((doc) => [doc.name, doc.state, (doc.createdAt as Date).getTime()])).toEqual([
        ['first', 'down', 1700000000000],
        ['second', 'down', 1710000000000],
      ])
    })

    it('list returns every state document in createdAt order', async () => {
      const s = scenario([SECOND, FIRST])
      const migrator = await connect(s)
      const listed = await migrator.list()
      expect(listed.map((doc) => [doc.filename, doc.state])).toEqual([
        [FIRST, 'down'],
        [SECOND, 'down'],
      ])
    })

    it('run up applies every pending migration oldest first and returns them, then returns [] when nothing is pending', async () => {
      const s = scenario([FIRST, SECOND])
      const migrator = await connect(s)
      expect(filenames(await migrator.run('up'))).toEqual([FIRST, SECOND])
      expect(await ledger(s)).toEqual(['up:first', 'up:second'])
      expect((await rawState(s)).map((doc) => doc.state)).toEqual(['up', 'up'])
      expect(await migrator.run('up')).toEqual([])
      expect(await ledger(s)).toEqual(['up:first', 'up:second'])
    })

    it('run up to a name applies migrations up to and including it', async () => {
      const s = scenario([FIRST, SECOND])
      const migrator = await connect(s)
      expect(filenames(await migrator.run('up', 'first'))).toEqual([FIRST])
      expect((await rawState(s)).map((doc) => doc.state)).toEqual(['up', 'down'])
    })

    it('run up single applies only the named migration', async () => {
      const s = scenario([FIRST, SECOND])
      const migrator = await connect(s)
      expect(filenames(await migrator.run('up', 'second', true))).toEqual([SECOND])
      expect((await rawState(s)).map((doc) => doc.state)).toEqual(['down', 'up'])
    })

    it('run down to a name rolls back newest first and returns them', async () => {
      const s = scenario([FIRST, SECOND])
      const migrator = await connect(s)
      await migrator.run('up')
      expect(filenames(await migrator.run('down', 'first'))).toEqual([SECOND, FIRST])
      expect(await ledger(s)).toEqual(['up:first', 'up:second', 'down:second', 'down:first'])
      expect((await rawState(s)).map((doc) => doc.state)).toEqual(['down', 'down'])
    })

    it('prune removes and returns state documents whose file is gone', async () => {
      const s = scenario([FIRST, SECOND])
      const migrator = await connect(s)
      await migrator.run('up')
      fs.unlinkSync(path.join(s.dir, `${SECOND}.ts`))
      expect(filenames(await migrator.prune())).toEqual([SECOND])
      expect((await rawState(s)).map((doc) => doc.name)).toEqual(['first'])
    })

    it('create writes the template to a timestamped file and stores a down state document', async () => {
      const s = scenario([])
      const migrator = await connect(s)
      const created = await migrator.create('third')
      expect([created.name, created.state]).toEqual(['third', 'down'])
      expect(fs.readFileSync(path.join(s.dir, `${created.filename}.ts`), 'utf8')).toBe(template)
      expect(fs.readdirSync(s.dir)).toEqual([`${created.filename}.ts`])
    })

    it('errors keep their messages', async () => {
      const s = scenario([FIRST])
      fs.writeFileSync(path.join(s.dir, '1720000000000-boom.ts'), failingSource)
      const migrator = await connect(s)
      await expect(migrator.run('up', 'missing')).rejects.toThrow(new Error("Could not find migration with name 'missing' in the database"))
      await expect(migrator.run('up')).rejects.toThrow(new Error("Failed to run migration with name 'boom' due to an error"))
      expect(await ledger(s)).toEqual(['up:first'])
      await expect(migrator.create('first')).rejects.toThrow(new Error("There is already a migration with name 'first' in the database"))
      await expect(migrator.create('bad name')).rejects.toThrow(/^Invalid migration name 'bad name'/)
    })
  })

  describe('CLI', () => {
    const options = (s: Scenario) => ['-d', uri, '-m', s.dir, '-c', s.collection, '-a', 'true']

    it('up prints one import line per new file, one status line per migration and the success line', async () => {
      const s = scenario([FIRST])
      const lines = captureLog()
      await cli(false, 'up', ...options(s))
      expect(lines).toEqual([`${chalk.green('Adding')} migration ${chalk.cyan(path.join(s.dir, FIRST))} into database. State is ${chalk.red('down')}`, `${chalk.green('up:')} ${FIRST}`, chalk.green('All migrations finished successfully')])
    })

    it('up with nothing pending prints the no pending line followed by the current status', async () => {
      const s = scenario([FIRST])
      await cli(false, 'up', ...options(s))
      const lines = captureLog()
      await cli(false, 'up', ...options(s))
      expect(lines).toEqual([chalk.yellow('There are no pending migrations'), chalk.cyan('Current migrations status:'), `${chalk.green('up:')} ${FIRST}`])
    })

    it('list prints the header and one status line per migration', async () => {
      const s = scenario([FIRST])
      await cli(false, 'up', ...options(s))
      const lines = captureLog()
      await cli(false, 'list', ...options(s))
      expect(lines).toEqual([chalk.cyan('Listing migrations'), `${chalk.green('up:')} ${FIRST}`])
    })

    it('down prints one status line per rolled back migration and the success line', async () => {
      const s = scenario([FIRST])
      await cli(false, 'up', ...options(s))
      const lines = captureLog()
      await cli(false, 'down', 'first', ...options(s))
      expect(lines).toEqual([`${chalk.red('down:')} ${FIRST}`, chalk.green('All migrations finished successfully')])
    })

    it('prune prints the removed migration names', async () => {
      const s = scenario([FIRST])
      await cli(false, 'up', ...options(s))
      fs.unlinkSync(path.join(s.dir, `${FIRST}.ts`))
      const lines = captureLog()
      await cli(false, 'prune', ...options(s))
      expect(lines).toEqual([`${chalk.red('Removing')} migration(s) from database:\n${chalk.cyan('first')}`])
    })

    it('create prints the created line and the hint', async () => {
      const s = scenario([])
      const lines = captureLog()
      await cli(false, 'create', 'third', ...options(s))
      expect(lines).toEqual([`${chalk.green('Created')} migration ${chalk.cyan('third')} in ${s.dir}`, `Migration created. Run ${chalk.cyan('migrate up third')} to apply the migration`])
    })

    it('exits 0 after a successful command', async () => {
      const s = scenario([FIRST])
      captureLog()
      const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      await cli(true, 'up', ...options(s))
      expect(exit.mock.calls).toEqual([[0]])
    })

    it('prints the error in red and exits 1 after a failed command', async () => {
      const s = scenario([FIRST])
      captureLog()
      const errors: string[] = []
      vi.spyOn(console, 'error').mockImplementation((line: string) => {
        errors.push(line)
      })
      const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      await expect(cli(true, 'down', 'nope', ...options(s))).rejects.toThrow("Could not find migration with name 'nope' in the database")
      expect(exit.mock.calls).toEqual([[1]])
      expect(errors).toEqual([chalk.red("Could not find migration with name 'nope' in the database")])
    })

    it('help still prints every 5.4.0 line unchanged and in order', async () => {
      const lines = captureLog()
      await cli(false, '--help')
      const printed = lines.join('\n').split('\n')
      let cursor = 0
      for (const line of printed) if (line === HELP_5_4_0[cursor]) cursor += 1
      expect(HELP_5_4_0.slice(cursor)).toEqual([])
    })
  })

  describe('NestJS MigrationService with a real Migrator', () => {
    const bootstrap = async (s: Scenario) => {
      const logs: string[] = []
      vi.spyOn(Logger.prototype, 'log').mockImplementation((message: string) => {
        logs.push(message)
      })
      const service = new MigrationService({ uri, migrationsPath: s.dir, collection: s.collection, autosync: true })
      try {
        await service.onApplicationBootstrap()
      } finally {
        await service.onApplicationShutdown()
        vi.restoreAllMocks()
      }
      return logs
    }

    it('applies pending migrations on bootstrap and logs each one', async () => {
      const s = scenario([FIRST, SECOND])
      expect(await bootstrap(s)).toEqual(['Connected to migration database', `up: ${FIRST}`, `up: ${SECOND}`, 'Applied 2 migration(s)'])
      expect(await ledger(s)).toEqual(['up:first', 'up:second'])
    })

    it('logs up to date on a later bootstrap and runs nothing', async () => {
      const s = scenario([FIRST])
      await bootstrap(s)
      expect(await bootstrap(s)).toEqual(['Connected to migration database', 'All migrations are up to date (1 total)'])
      expect(await ledger(s)).toEqual(['up:first'])
    })

    it('logs no migrations found for an empty folder', async () => {
      const s = scenario([])
      expect(await bootstrap(s)).toEqual(['Connected to migration database', 'No migrations found'])
    })
  })
})
