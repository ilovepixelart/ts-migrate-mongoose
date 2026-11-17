import 'reflect-metadata'

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import mongoose from 'mongoose'
import { chalk } from '../src/chalk'
import { Migrate } from '../src/commander'
import { Migrator } from '../src/index'
import { MigrationService } from '../src/nest/migration.service'
import { create } from './mongo/server'

import type { MigratorOptions } from '../src/types'

// Each migration appends one row per executed up/down to a ledger collection,
// so the ledger is an independent record of what actually ran, separate from
// the state the migrator stores.

const root = path.resolve('tests/lock-tmp')
let seq = 0

const migrationSource = (id: string, ledger: string, upDelayMs = 0) => `
import type { Connection } from 'mongoose'
export async function up(connection: Connection) {
  await connection.collection('${ledger}').insertOne({ id: '${id}', dir: 'up' })
  await new Promise((resolve) => setTimeout(resolve, ${upDelayMs}))
}
export async function down(connection: Connection) {
  await connection.collection('${ledger}').insertOne({ id: '${id}', dir: 'down' })
}
`

const BACKFILL = '1700000000000-backfill'

const scenario = (upDelayMs = 0) => {
  seq += 1
  const dir = path.join(root, `s${seq}`)
  fs.mkdirSync(dir, { recursive: true })
  const s = { dir, collection: `lock_migrations_${seq}`, ledger: `lock_ledger_${seq}` }
  fs.writeFileSync(path.join(dir, `${BACKFILL}.ts`), migrationSource('backfill', s.ledger, upDelayMs))
  return s
}

type Scenario = ReturnType<typeof scenario>

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('migration lock', async () => {
  const { uri, destroy } = await create('lock')
  const admin = await mongoose.createConnection(uri).asPromise()
  const open: Migrator[] = []

  const connect = async (s: Scenario, options: Partial<MigratorOptions> = {}) => {
    const migrator = await Migrator.connect({ uri, migrationsPath: s.dir, collection: s.collection, autosync: true, ...options })
    open.push(migrator)
    return migrator
  }
  const count = (s: Scenario, dir: 'up' | 'down' = 'up') => admin.collection(s.ledger).countDocuments({ id: 'backfill', dir })
  const stateDocs = (s: Scenario) => admin.collection(s.collection).find().sort({ createdAt: 1 }).toArray()
  const lockDocs = (name: string) => admin.collection(name).find().toArray()
  const collectionExists = async (name: string) => (await admin.db?.listCollections({ name }).toArray())?.length === 1
  const holdLock = (s: Scenario, expiresInMs: number, collection = `${s.collection}_lock`) => admin.collection(collection).insertOne({ _id: s.collection, holder: 'crashed-host:4242:dead', acquiredAt: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() + expiresInMs) } as never)

  const cli = (...args: string[]) => {
    process.argv = ['node', 'migrate', ...args]
    return new Migrate().run(false)
  }
  const cliOptions = (s: Scenario) => ['-d', uri, '-m', s.dir, '-c', s.collection, '-a', 'true']

  afterEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    for (const migrator of open) await migrator.close().catch(() => undefined)
    await admin.close()
    fs.rmSync(root, { recursive: true, force: true })
    await destroy()
  })

  describe('F1race two Migrators running up at the same time', () => {
    const setup = async () => {
      const s = scenario(200)
      const podA = await connect(s)
      const podB = await connect(s)
      await podA.list() // import the file into the database once, before the race
      return { s, podA, podB }
    }

    it('a pending migration runs once when two Migrators call run("up") concurrently', async () => {
      const { s, podA, podB } = await setup()
      const results = await Promise.all([podA.run('up'), podB.run('up')])
      expect(await count(s)).toBe(1)
      expect(results.map((ran) => ran.map((doc) => doc.filename)).sort()).toEqual([[], [BACKFILL]])
    })

    it('CONTROL: a pending migration runs once when two Migrators call run("up") one after another', async () => {
      const { s, podA, podB } = await setup()
      await podA.run('up')
      await podB.run('up')
      expect(await count(s)).toBe(1)
    })

    it('a pending migration runs once when one Migrator gets two concurrent run("up") calls', async () => {
      const s = scenario(200)
      const migrator = await connect(s)
      await Promise.all([migrator.run('up'), migrator.run('up')])
      expect(await count(s)).toBe(1)
    })
  })

  describe('F1nest replicas bootstrapping MigrationService at the same time', () => {
    const setup = () => {
      const s = scenario(200)
      const options = { uri, migrationsPath: s.dir, collection: s.collection, autosync: true }
      return { s, replicaA: new MigrationService(options), replicaB: new MigrationService(options) }
    }

    it('two replicas bootstrapping together apply the pending migration once', async () => {
      const { s, replicaA, replicaB } = setup()
      try {
        await Promise.all([replicaA.onApplicationBootstrap(), replicaB.onApplicationBootstrap()])
        expect({ ups: await count(s), stateDocs: (await stateDocs(s)).length }).toEqual({ ups: 1, stateDocs: 1 })
      } finally {
        await replicaA.onApplicationShutdown()
        await replicaB.onApplicationShutdown()
      }
    })

    it('CONTROL: two replicas bootstrapping one after another apply the pending migration once', async () => {
      const { s, replicaA, replicaB } = setup()
      try {
        await replicaA.onApplicationBootstrap()
        await replicaB.onApplicationBootstrap()
        expect(await count(s)).toBe(1)
      } finally {
        await replicaA.onApplicationShutdown()
        await replicaB.onApplicationShutdown()
      }
    })

    it('a replica that cannot get the lock in time fails bootstrap with the lock error', async () => {
      const s = scenario()
      await holdLock(s, 60_000)
      const replica = new MigrationService({ uri, migrationsPath: s.dir, collection: s.collection, autosync: true, lockTimeout: 0 })
      try {
        await expect(replica.onApplicationBootstrap()).rejects.toThrow(/waiting for the migration lock held by 'crashed-host:4242:dead'/)
        expect(await count(s)).toBe(0)
      } finally {
        await replica.onApplicationShutdown()
      }
    })
  })

  describe('F2syncdup concurrent sync must not duplicate state', () => {
    it('concurrent list() then one run("up"): one state doc and the migration ran once', async () => {
      const s = scenario()
      const podA = await connect(s)
      const podB = await connect(s)
      await Promise.all([podA.list(), podB.list()])
      await podA.run('up')
      expect({ stateDocs: (await stateDocs(s)).length, ups: await count(s) }).toEqual({ stateDocs: 1, ups: 1 })
    })

    it('CONTROL: sequential list() then one run("up"): one state doc and the migration ran once', async () => {
      const s = scenario()
      const podA = await connect(s)
      const podB = await connect(s)
      await podA.list()
      await podB.list()
      await podA.run('up')
      expect({ stateDocs: (await stateDocs(s)).length, ups: await count(s) }).toEqual({ stateDocs: 1, ups: 1 })
    })

    it('concurrent sync() calls import each file once', async () => {
      const s = scenario()
      const podA = await connect(s)
      const podB = await connect(s)
      const [a, b] = await Promise.all([podA.sync(), podB.sync()])
      expect([a.length + b.length, (await stateDocs(s)).length]).toEqual([1, 1])
    })
  })

  describe('duplicate state documents already in the database', () => {
    const duplicate = async (s: Scenario) => {
      const doc = { name: 'backfill', state: 'down', createdAt: new Date(1700000000000), updatedAt: new Date(), __v: 0 }
      await admin.collection(s.collection).insertMany([{ ...doc }, { ...doc }])
    }

    it('run("up") executes a file with two state documents once, returns it once and marks both up', async () => {
      const s = scenario()
      await duplicate(s)
      const migrator = await connect(s)
      expect((await migrator.run('up')).map((doc) => doc.filename)).toEqual([BACKFILL])
      expect(await count(s)).toBe(1)
      expect((await stateDocs(s)).map((doc) => doc.state)).toEqual(['up', 'up'])
    })

    it('CONTROL: two files sharing a name but not a timestamp both run', async () => {
      const s = scenario()
      fs.writeFileSync(path.join(s.dir, '1710000000000-backfill.ts'), migrationSource('backfill', s.ledger))
      const migrator = await connect(s)
      expect((await migrator.run('up')).map((doc) => doc.filename)).toEqual([BACKFILL, '1710000000000-backfill'])
      expect(await count(s)).toBe(2)
    })

    it('run("down") executes a file with two state documents once', async () => {
      const s = scenario()
      await duplicate(s)
      const migrator = await connect(s)
      await migrator.run('up')
      expect((await migrator.run('down', 'backfill')).map((doc) => doc.filename)).toEqual([BACKFILL])
      expect(await count(s, 'down')).toBe(1)
    })

    it('the CLI reports the duplicate and keeps both documents', async () => {
      const s = scenario()
      await duplicate(s)
      const lines: string[] = []
      vi.spyOn(console, 'log').mockImplementation((line: string) => {
        lines.push(line)
      })
      await cli('up', ...cliOptions(s))
      expect(lines).toEqual([chalk.yellow(`Found 2 state documents for ${BACKFILL}; running it once`), `${chalk.green('up:')} ${BACKFILL}`, chalk.green('All migrations finished successfully')])
      expect((await stateDocs(s)).length).toBe(2)
    })
  })

  describe('acquisition', () => {
    it('an uncontended run takes the lock without waiting and removes it afterwards', async () => {
      const s = scenario()
      const migrator = await connect(s, { lockTimeout: 0 })
      expect((await migrator.run('up')).length).toBe(1)
      expect(await lockDocs(`${s.collection}_lock`)).toEqual([])
    })

    it('the lock collection gets a TTL index on expiresAt', async () => {
      const s = scenario()
      const migrator = await connect(s)
      await migrator.run('up')
      const indexes = await admin.collection(`${s.collection}_lock`).indexes()
      expect(indexes.find((index) => index.key.expiresAt === 1)?.expireAfterSeconds).toBe(0)
    })

    it('still locks when the TTL index cannot be created', async () => {
      const s = scenario()
      await admin.collection(`${s.collection}_lock`).createIndex({ expiresAt: 1 }) // same key without TTL makes createIndex fail
      const podA = await connect(s)
      const podB = await connect(s)
      await podA.list()
      await Promise.all([podA.run('up'), podB.run('up')])
      expect(await count(s)).toBe(1)
      const indexes = await admin.collection(`${s.collection}_lock`).indexes()
      expect(indexes.find((index) => index.key.expiresAt === 1)?.expireAfterSeconds).toBeUndefined()
    })

    it('a lock left by a crashed holder is taken over once it expires and the migration runs once', async () => {
      const s = scenario()
      await holdLock(s, 1500)
      const migrator = await connect(s)
      const started = Date.now()
      expect((await migrator.run('up')).length).toBe(1)
      expect(Date.now() - started).toBeGreaterThanOrEqual(1000)
      expect(await count(s)).toBe(1)
      expect(await lockDocs(`${s.collection}_lock`)).toEqual([])
    })

    it('CONTROL: an already expired lock is taken over without waiting', async () => {
      const s = scenario()
      await holdLock(s, -1000)
      const migrator = await connect(s, { lockTimeout: 0 })
      expect((await migrator.run('up')).length).toBe(1)
    })

    it('times out naming the holder and how to clear a stale lock, and leaves state and lock untouched', async () => {
      const s = scenario()
      await holdLock(s, 60_000)
      const migrator = await connect(s, { lockTimeout: 300 })
      const error = await migrator.run('up').catch((e: Error) => e)
      expect(error).toBeInstanceOf(Error)
      const { message } = error as Error
      expect(message).toMatch(/^Timed out after 300 ms waiting for the migration lock held by 'crashed-host:4242:dead' since \d{4}-\d\d-\d\dT[\d:.]+Z \(lease expires \d{4}-\d\d-\d\dT[\d:.]+Z unless renewed\)\./)
      expect(message).toContain(`db.getCollection("${s.collection}_lock").deleteOne({ _id: "${s.collection}" })`)
      expect(message).toContain('lock: false')
      expect(await count(s)).toBe(0)
      expect(await stateDocs(s)).toEqual([])
      expect((await lockDocs(`${s.collection}_lock`)).map((doc) => doc.holder)).toEqual(['crashed-host:4242:dead'])
    })

    it.each([
      ['sync', (m: Migrator) => m.sync()],
      ['prune', (m: Migrator) => m.prune()],
      ['create', (m: Migrator) => m.create('another')],
      ['run up', (m: Migrator) => m.run('up')],
      ['run down', (m: Migrator) => m.run('down', 'backfill')],
      ['list with a file to import', (m: Migrator) => m.list()],
    ])('%s waits for the lock', async (_label, operation) => {
      const s = scenario()
      await holdLock(s, 60_000)
      const migrator = await connect(s, { lockTimeout: 0 })
      await expect(operation(migrator)).rejects.toThrow(/^Timed out after 0 ms waiting for the migration lock/)
      expect(await stateDocs(s)).toEqual([])
    })

    it('list() with nothing to import reads state without waiting for a running migration', async () => {
      const s = scenario()
      await (await connect(s)).sync()
      await holdLock(s, 60_000)
      const migrator = await connect(s, { lockTimeout: 0 })
      expect((await migrator.list()).map((doc) => doc.filename)).toEqual([BACKFILL])
    })

    it('lock: false neither creates the lock collection nor waits for a held lock', async () => {
      const s = scenario()
      const migrator = await connect(s, { lock: false })
      await migrator.run('up')
      expect(await collectionExists(`${s.collection}_lock`)).toBe(false)

      const t = scenario()
      await holdLock(t, 60_000)
      expect((await (await connect(t, { lock: false, lockTimeout: 0 })).run('up')).length).toBe(1)
    })

    it('lockCollection names the lock collection', async () => {
      const s = scenario()
      await holdLock(s, 60_000, 'custom_lock')
      const migrator = await connect(s, { lockCollection: 'custom_lock', lockTimeout: 0 })
      await expect(migrator.run('up')).rejects.toThrow(/db.getCollection\("custom_lock"\)/)
      await admin.collection('custom_lock').deleteMany({})
      expect((await migrator.run('up')).length).toBe(1)
      expect(await collectionExists(`${s.collection}_lock`)).toBe(false)
    })

    it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects lockTimeout %s before connecting', async (lockTimeout) => {
      const before = mongoose.connections.length
      await expect(Migrator.connect({ uri, lockTimeout })).rejects.toThrow(`lockTimeout must be a non-negative number of milliseconds, received ${lockTimeout}`)
      expect(mongoose.connections.length).toBe(before)
    })
  })

  describe('CLI options', () => {
    const env = { ...process.env }
    afterEach(() => {
      process.env = { ...env }
    })

    it('parses --lock, --lock-timeout and --lock-collection', async () => {
      const s = scenario()
      const options = await cli('list', ...cliOptions(s), '--lock', 'false', '--lock-timeout', '1500', '--lock-collection', 'cli_lock')
      expect([options.lock, options.lockTimeout, options.lockCollection]).toEqual([false, 1500, 'cli_lock'])
    })

    it('--lock false runs without the lock', async () => {
      const s = scenario()
      await holdLock(s, 60_000)
      vi.spyOn(console, 'log').mockImplementation(() => undefined)
      await cli('up', ...cliOptions(s), '--lock', 'false', '--lock-timeout', '0')
      expect(await count(s)).toBe(1)
    })

    it('--lock-timeout and --lock-collection reach the lock', async () => {
      const s = scenario()
      await holdLock(s, 60_000, 'cli_custom_lock')
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      await expect(cli('up', ...cliOptions(s), '--lock-timeout', '0', '--lock-collection', 'cli_custom_lock')).rejects.toThrow(/^Timed out after 0 ms .*db.getCollection\("cli_custom_lock"\)/s)
      expect(await count(s)).toBe(0)
    })

    it('rejects a --lock-timeout that is not a number', async () => {
      const s = scenario()
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      await expect(cli('up', ...cliOptions(s), '--lock-timeout', 'soon')).rejects.toThrow('lockTimeout must be a non-negative number of milliseconds, received NaN')
    })

    it('reads MIGRATE_LOCK, MIGRATE_LOCK_TIMEOUT and MIGRATE_LOCK_COLLECTION', async () => {
      const s = scenario()
      await holdLock(s, 60_000, 'env_lock')
      process.env.MIGRATE_LOCK_TIMEOUT = '0'
      process.env.MIGRATE_LOCK_COLLECTION = 'env_lock'
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      await expect(cli('up', ...cliOptions(s))).rejects.toThrow(/^Timed out after 0 ms .*db.getCollection\("env_lock"\)/s)
      process.env.MIGRATE_LOCK = 'false'
      vi.spyOn(console, 'log').mockImplementation(() => undefined)
      await cli('up', ...cliOptions(s))
      expect(await count(s)).toBe(1)
    })

    it('reads lock, lockTimeout and lockCollection from the config file', async () => {
      const s = scenario()
      await holdLock(s, 60_000, 'file_lock')
      const waitConfig = path.join(s.dir, 'wait.json')
      const noLockConfig = path.join(s.dir, 'no-lock.json')
      fs.writeFileSync(waitConfig, JSON.stringify({ lockTimeout: 0, lockCollection: 'file_lock' }))
      fs.writeFileSync(noLockConfig, JSON.stringify({ lock: false }))
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      await expect(cli('up', ...cliOptions(s), '-f', waitConfig)).rejects.toThrow(/db.getCollection\("file_lock"\)/)
      vi.spyOn(console, 'log').mockImplementation(() => undefined)
      await cli('up', ...cliOptions(s), '-f', noLockConfig)
      expect(await count(s)).toBe(1)
    })

    it('command line beats env for --lock', async () => {
      const s = scenario()
      await holdLock(s, 60_000)
      process.env.MIGRATE_LOCK = 'false'
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      await expect(cli('up', ...cliOptions(s), '--lock', 'true', '--lock-timeout', '0')).rejects.toThrow(/^Timed out/)
    })

    it('help lists the lock options', async () => {
      const lines: string[] = []
      vi.spyOn(console, 'log').mockImplementation((line: string) => {
        lines.push(line)
      })
      await cli('--help')
      expect(lines.join('\n')).toContain(
        [
          '      --lock <boolean>            take the migration lock before changing migration state (default true)',
          '      --lock-timeout <ms>         how long to wait for another process to release the lock (default 300000)',
          '      --lock-collection <name>    collection that holds the lock (default <collection>_lock)',
        ].join('\n'),
      )
    })
  })

  describe('separate processes', () => {
    const run = promisify(execFile)
    const cliEntry = path.resolve('src/cli.ts')

    it('two CLI processes started together apply a pending migration once', async () => {
      const s = scenario(500)
      const args = ['--import', 'tsx', cliEntry, 'up', ...cliOptions(s)]
      const results = await Promise.all([run(process.execPath, args), run(process.execPath, args)])
      expect(await count(s)).toBe(1)
      expect((await stateDocs(s)).length).toBe(1)
      expect(results.filter(({ stdout }) => stdout.includes('All migrations finished successfully')).length).toBe(1)
      expect(results.filter(({ stdout }) => stdout.includes('There are no pending migrations')).length).toBe(1)
    }, 30_000)
  })

  it('waits while the holder is still running and continues with what is left', async () => {
    const s = scenario(1200)
    fs.writeFileSync(path.join(s.dir, '1710000000000-second.ts'), migrationSource('second', s.ledger))
    const podA = await connect(s)
    const podB = await connect(s)
    const first = podA.run('up', 'backfill')
    await sleep(300)
    const second = await podB.run('up')
    expect((await first).map((doc) => doc.filename)).toEqual([BACKFILL])
    expect(second.map((doc) => doc.filename)).toEqual(['1710000000000-second'])
    expect(await count(s)).toBe(1)
  })
})
