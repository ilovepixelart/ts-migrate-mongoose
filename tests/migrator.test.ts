import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import fs from 'node:fs'
import { checkbox } from '@inquirer/prompts'
import mongoose, { type Connection, Types } from 'mongoose'
import { getConfig } from '../src/commander'
import { MIGRATION_FILE_REGEX } from '../src/constants'
import { Migrator } from '../src/index'
import { template } from '../src/template'
import { create } from './mongo/server'
import { clearDirectory } from './utils/filesystem'

vi.mock('@inquirer/prompts', () => ({
  checkbox: vi.fn().mockResolvedValue(['1']),
}))

describe('MIGRATION_FILE_REGEX', () => {
  const base = '1234567890123-migration'

  describe('matching', () => {
    it.each(['ts', 'js', 'mjs', 'cjs'])('should match .%s extension', (ext) => {
      expect(MIGRATION_FILE_REGEX.test(`${base}.${ext}`)).toBe(true)
    })

    it.each([`${base}.d.ts`, `${base}.txt`, base, 'migration.d.ts'])('should not match %s', (filename) => {
      expect(MIGRATION_FILE_REGEX.test(filename)).toBe(false)
    })
  })

  describe('replace', () => {
    it.each(['ts', 'js', 'mjs', 'cjs'])('should strip .%s extension', (ext) => {
      expect(`${base}.${ext}`.replace(MIGRATION_FILE_REGEX, '')).toBe(base)
    })

    it.each([`${base}.d.ts`, `${base}.txt`, base])('should leave %s unchanged', (filename) => {
      expect(filename.replace(MIGRATION_FILE_REGEX, '')).toBe(filename)
    })
  })
})

describe('Tests for Migrator class - Programmatic approach', async () => {
  const { uri, destroy } = await create('migrator')
  let connection: Connection

  afterAll(async () => {
    await clearDirectory('migrations')
    await destroy()
  })

  beforeEach(async () => {
    await clearDirectory('migrations')
    connection = await mongoose.createConnection(uri).asPromise()
    await connection.collection('migrations').deleteMany({})
  })

  it('should return [] if "There are no pending migrations"', async () => {
    const migrator = await Migrator.connect({ uri })
    expect(migrator).toBeInstanceOf(Migrator)

    expect(migrator.connection.readyState).toBe(1)

    const migrations = await migrator.run('up')
    expect(migrations).toEqual([])

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should throw "There is already a migration with name \'create-users\' in the database"', async () => {
    const migrationName = 'create-users'
    const migrator = await Migrator.connect({ uri })
    expect(migrator).toBeInstanceOf(Migrator)

    expect(migrator.connection.readyState).toBe(1)

    const migration = await migrator.create(migrationName)
    expect(migration.filename).toContain(migrationName)

    await expect(migrator.create(migrationName)).rejects.toThrow(`There is already a migration with name '${migrationName}' in the database`)

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should throw "Could not find migration with name \'create-unicorns\' in the database"', async () => {
    const migrationName = 'create-unicorns'
    const migrator = await Migrator.connect({ uri, cli: true })
    expect(migrator).toBeInstanceOf(Migrator)

    expect(migrator.connection.readyState).toBe(1)

    await expect(migrator.run('down', migrationName)).rejects.toThrow(`Could not find migration with name '${migrationName}' in the database`)

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should create migrator with mongoose connection', async () => {
    const migrator = await Migrator.connect({ uri })
    expect(migrator).toBeInstanceOf(Migrator)

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should create migrator with uri', async () => {
    const migrator = await Migrator.connect({ uri })
    expect(migrator).toBeInstanceOf(Migrator)

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should insert a doc into collection with migrator', async () => {
    const migrator = await Migrator.connect({ uri, autosync: true })
    await migrator.prune()

    const migrationName = `test-migration-creation-${new Types.ObjectId().toHexString()}`
    const migration = await migrator.create(migrationName)

    expect(migration.filename).toContain(migrationName)
    expect(migration.name).toBe(migrationName)

    // Migrate Up
    await migrator.run('up', migrationName)

    const foundUp = await migrator.migrationModel.findById(migration._id)
    expect(foundUp?.state).toBe('up')
    expect(foundUp?.name).toBe(migrationName)

    // Migrate Down
    await migrator.run('down', migrationName)

    const foundDown = await migrator.migrationModel.findById(migration._id)
    expect(foundDown?.state).toBe('down')
    expect(foundDown?.name).toBe(migrationName)

    // List Migrations
    const migrationList = await migrator.list()
    expect(migrationList).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: migrationName,
        }),
      ]),
    )

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should prune all migrations', async () => {
    const migrator = await Migrator.connect({ uri, autosync: true })

    const migrationName = 'migration-creation'
    const migration = await migrator.create(migrationName)

    expect(migration.filename).toContain(migrationName)
    expect(migration.name).toBe(migrationName)

    // Migrate Up
    await migrator.run('up', migrationName)

    const foundUp = await migrator.migrationModel.findById(migration._id)
    expect(foundUp?.state).toBe('up')
    expect(foundUp?.name).toBe(migrationName)

    await clearDirectory('migrations')
    // Prune
    const migrations = await migrator.prune()

    expect(migrations[0]?.state).toBe('up')
    expect(migrations[0]?.name).toBe(migrationName)

    const migrationsInDB = await migrator.migrationModel.find({})
    expect(migrationsInDB).toHaveLength(0)

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should throw "No mongoose connection or mongo uri provided to migrator"', async () => {
    await expect(Migrator.connect({ uri: '' })).rejects.toThrow('No mongoose connection or mongo uri provided to migrator')
  })

  it('should ensure migrations path', async () => {
    fs.rmSync('migrations', { recursive: true })
    const migrator = await Migrator.connect({ uri })
    expect(migrator).toBeInstanceOf(Migrator)
    expect(fs.existsSync('migrations')).toBe(true)

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should throw "Failed to run migration"', async () => {
    const migrator = await Migrator.connect({ uri })
    const migration = await migrator.migrationModel.create({
      name: 'test-migration',
      createdAt: new Date(),
    })
    // @ts-expect-error - private method
    await expect(migrator.runMigrations([migration], 'up')).rejects.toThrow()

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should log "Adding migration"', async () => {
    const migrator = await Migrator.connect({ uri })
    const migration = await migrator.create('test-migration')
    await clearDirectory('migrations')
    // @ts-expect-error - private method
    const migrations = await migrator.syncMigrations([migration.filename])
    expect(migrations).toHaveLength(1)
    expect(migrations[0]?.name).toBe('test-migration')

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should choose first', async () => {
    const migrator = await Migrator.connect({ uri })
    // @ts-expect-error - private method
    const answers = await migrator.choseMigrations(['1', '2', '3'], 'Message')
    expect(checkbox).toHaveBeenCalled()
    expect(answers).toEqual(['1'])

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should choose all', async () => {
    const migrator = await Migrator.connect({ uri, autosync: true })
    // @ts-expect-error - private method
    const answers = await migrator.choseMigrations(['1', '2', '3'], 'Message')
    expect(checkbox).toHaveBeenCalled()
    expect(answers).toEqual(['1', '2', '3'])

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should throw on sync', async () => {
    const migrator = await Migrator.connect({ uri, autosync: true })
    // @ts-expect-error - private method
    vi.spyOn(migrator, 'getMigrations').mockImplementation(() => {
      throw new Error('Sync error')
    })
    await expect(migrator.sync()).rejects.toThrow('Sync error')

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should run sync and find 3 migrations', async () => {
    const migrator = await Migrator.connect({ uri, autosync: true })
    await migrator.create('test-migration1')
    await migrator.create('test-migration2')
    await migrator.create('test-migration3')
    await migrator.migrationModel.deleteMany({})
    const migrations = await migrator.sync()
    expect(migrations).toBeInstanceOf(Array)
    expect(migrations).toHaveLength(3)

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should run sync and find 0 migrations', async () => {
    const migrator = await Migrator.connect({ uri, autosync: true })
    await migrator.migrationModel.deleteMany({})
    await clearDirectory('migrations')
    const migrations = await migrator.sync()
    expect(migrations).toBeInstanceOf(Array)
    expect(migrations).toHaveLength(0)

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should run prune and find 2 migrations in db that no longer exits in file system', async () => {
    const migrator = await Migrator.connect({ uri, autosync: true })
    await migrator.create('test-migration1')
    await migrator.create('test-migration2')
    await migrator.run('up', 'test-migration1')
    await migrator.run('up', 'test-migration2')
    await clearDirectory('migrations')
    const migrations = await migrator.prune()
    console.log(migrations)
    expect(migrations).toBeInstanceOf(Array)
    expect(migrations).toHaveLength(2)

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should run prune and find 0 migrations in db that no longer exits in file system', async () => {
    const migrator = await Migrator.connect({ uri, autosync: true })
    await migrator.create('test-migration1')
    await migrator.create('test-migration2')
    await migrator.run('up', 'test-migration1')
    await migrator.run('up', 'test-migration2')
    const migrations = await migrator.prune()
    expect(migrations).toBeInstanceOf(Array)
    expect(migrations).toHaveLength(0)

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should throw on prune', async () => {
    const migrator = await Migrator.connect({ uri, autosync: true })
    // @ts-expect-error - private method
    vi.spyOn(migrator, 'getMigrations').mockImplementation(() => {
      throw new Error('Sync error')
    })
    await expect(migrator.prune()).rejects.toThrow('Sync error')

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should get migrations', async () => {
    const migrator = await Migrator.connect({ uri })
    await migrator.create('test-migration1')
    await migrator.create('test-migration2')
    await migrator.create('test-migration3')
    await migrator.run('up', 'test-migration1')
    // @ts-expect-error - private method
    const { migrationsInDb, migrationsInFs } = await migrator.getMigrations()
    expect(migrationsInDb).toHaveLength(3)

    expect(migrationsInDb[0]?.name).toBe('test-migration1')
    expect(migrationsInDb[0]?.state).toBe('up')
    expect(migrationsInDb[0]?.filename).toMatch(/^\d{13,}-test-migration1/)

    expect(migrationsInDb[1]?.name).toBe('test-migration2')
    expect(migrationsInDb[1]?.state).toBe('down')
    expect(migrationsInDb[1]?.filename).toMatch(/^\d{13,}-test-migration2/)

    expect(migrationsInDb[2]?.name).toBe('test-migration3')
    expect(migrationsInDb[2]?.state).toBe('down')
    expect(migrationsInDb[2]?.filename).toMatch(/^\d{13,}-test-migration3/)

    expect(migrationsInFs).toHaveLength(3)

    expect(migrationsInFs[0]?.filename).toMatch(/^\d{13,}-test-migration1/)
    expect(migrationsInFs[0]?.existsInDatabase).toBe(true)

    expect(migrationsInFs[1]?.filename).toMatch(/^\d{13,}-test-migration2/)
    expect(migrationsInFs[1]?.existsInDatabase).toBe(true)

    expect(migrationsInFs[2]?.filename).toMatch(/^\d{13,}-test-migration3/)
    expect(migrationsInFs[2]?.existsInDatabase).toBe(true)

    expect(migrationsInDb[0]?.filename).toBe(migrationsInFs[0]?.filename)
    expect(migrationsInDb[1]?.filename).toBe(migrationsInFs[1]?.filename)
    expect(migrationsInDb[2]?.filename).toBe(migrationsInFs[2]?.filename)

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should create migrator instance with wrong template path and fallback to default template', async () => {
    const migrator = await Migrator.connect({ uri, templatePath: 'wrong/path' })
    const migration = await migrator.create('test-migration')
    expect(migration.filename).toMatch(/^\d{13,}-test-migration/)
    const migrationContent = fs.readFileSync(`migrations/${migration.filename}.ts`, 'utf8')
    expect(template).toMatch(migrationContent)

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should run up and run down', async () => {
    const migrator = await Migrator.connect({ uri })
    const migration = await migrator.create('test-migration')
    expect(migration.filename).toMatch(/^\d{13,}-test-migration/)
    await migrator.run('up', 'test-migration')
    await migrator.run('down')

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should run up all 3 at oce and run down one by one using migrate down', async () => {
    const migrator = await Migrator.connect({ uri, cli: true })
    const migration1 = await migrator.create('test-migration1')
    const migration2 = await migrator.create('test-migration2')
    const migration3 = await migrator.create('test-migration3')
    expect(migration1.filename).toMatch(/^\d{13,}-test-migration1/)
    expect(migration2.filename).toMatch(/^\d{13,}-test-migration2/)
    expect(migration3.filename).toMatch(/^\d{13,}-test-migration3/)
    await migrator.run('up')
    const migrationListUp = await migrator.list()
    expect(migrationListUp).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'test-migration1',
          state: 'up',
        }),
        expect.objectContaining({
          name: 'test-migration2',
          state: 'up',
        }),
        expect.objectContaining({
          name: 'test-migration3',
          state: 'up',
        }),
      ]),
    )

    await migrator.run('down', undefined, true)
    const migrationListDown1 = await migrator.list()
    expect(migrationListDown1).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'test-migration1',
          state: 'up',
        }),
        expect.objectContaining({
          name: 'test-migration2',
          state: 'up',
        }),
        expect.objectContaining({
          name: 'test-migration3',
          state: 'down',
        }),
      ]),
    )

    await migrator.run('down', undefined, true)
    const migrationListDown2 = await migrator.list()
    expect(migrationListDown2).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'test-migration1',
          state: 'up',
        }),
        expect.objectContaining({
          name: 'test-migration2',
          state: 'down',
        }),
        expect.objectContaining({
          name: 'test-migration3',
          state: 'down',
        }),
      ]),
    )

    await migrator.run('down', undefined, true)
    const migrationListDown3 = await migrator.list()
    expect(migrationListDown3).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'test-migration1',
          state: 'down',
        }),
        expect.objectContaining({
          name: 'test-migration2',
          state: 'down',
        }),
        expect.objectContaining({
          name: 'test-migration3',
          state: 'down',
        }),
      ]),
    )

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should get migration .ts files', async () => {
    const config = await getConfig('./examples/config-file-usage/src/migrate.ts')
    const migrator = await Migrator.connect({ ...config, uri, migrationsPath: './examples/config-file-usage/src/migrations' })
    // @ts-expect-error - private method
    const { migrationsInFs } = await migrator.getMigrations()
    expect(migrationsInFs).toHaveLength(1)

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should get migration .js files', async () => {
    const config = await getConfig('./examples/config-file-usage/dist/migrate.js')
    const migrator = await Migrator.connect({ ...config, uri, migrationsPath: './examples/config-file-usage/dist/migrations' })
    // @ts-expect-error - private method
    const { migrationsInFs } = await migrator.getMigrations()
    expect(migrationsInFs).toHaveLength(1)

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should same filename when migrate using .ts files', async () => {
    const config = await getConfig('./examples/config-file-usage/src/migrate.ts')
    const migrator = await Migrator.connect({
      ...config,
      uri,
      migrationsPath: './examples/config-file-usage/src/migrations',
      autosync: true,
    })
    // @ts-expect-error - private method
    const { migrationsInFs } = await migrator.getMigrations()
    const migrations = await migrator.sync()

    expect(migrationsInFs[0]?.filename).toBe(migrations[0]?.filename)

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should same filename when migrate using .js files', async () => {
    const config = await getConfig('./examples/config-file-usage/dist/migrate.js')
    const migrator = await Migrator.connect({
      ...config,
      uri,
      migrationsPath: './examples/config-file-usage/dist/migrations',
      autosync: true,
    })
    // @ts-expect-error - private method
    const { migrationsInFs } = await migrator.getMigrations()
    const migrations = await migrator.sync()

    expect(migrationsInFs[0]?.filename).toBe(migrations[0]?.filename)

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should run up/down when migrate using .ts files', async () => {
    const config = await getConfig('./examples/config-file-usage/src/migrate.ts')
    const migrator = await Migrator.connect({
      ...config,
      uri,
      migrationsPath: './examples/config-file-usage/src/migrations',
      autosync: true,
    })

    await migrator.run('up')
    const migrationListUp = await migrator.list()
    expect(migrationListUp).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'first-migration-demo',
          state: 'up',
        }),
      ]),
    )

    const newUser = await migrator.connection.collection('users').find({}).toArray()
    expect(newUser).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
        }),
        expect.objectContaining({
          firstName: 'Jane',
          lastName: 'Doe',
        }),
      ]),
    )

    await migrator.run('down', undefined, true)
    const migrationListDown = await migrator.list()
    expect(migrationListDown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'first-migration-demo',
          state: 'down',
        }),
      ]),
    )

    const deletedUsers = await migrator.connection
      .collection('users')
      .find({ firstName: { $in: ['Jane', 'John'] } })
      .toArray()
    expect(deletedUsers).toHaveLength(0)

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should run up/down when migrate using .js files', async () => {
    const config = await getConfig('./examples/config-file-usage/dist/migrate.js')
    const migrator = await Migrator.connect({
      ...config,
      uri,
      migrationsPath: './examples/config-file-usage/dist/migrations',
      autosync: true,
    })

    await migrator.run('up')
    const migrationListUp = await migrator.list()
    expect(migrationListUp).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'first-migration-demo',
          state: 'up',
        }),
      ]),
    )

    const newUser = await migrator.connection.collection('users').find({}).toArray()
    expect(newUser).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
        }),
        expect.objectContaining({
          firstName: 'Jane',
          lastName: 'Doe',
        }),
      ]),
    )

    await migrator.run('down', undefined, true)
    const migrationListDown = await migrator.list()
    expect(migrationListDown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'first-migration-demo',
          state: 'down',
        }),
      ]),
    )

    const deletedUsers = await migrator.connection
      .collection('users')
      .find({ firstName: { $in: ['Jane', 'John'] } })
      .toArray()
    expect(deletedUsers).toHaveLength(0)

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should resolve migration file with .js extension when .ts file is renamed', async () => {
    const migrator = await Migrator.connect({ uri, autosync: true })

    // Create a migration (creates .ts file)
    const migration = await migrator.create('extension-test')
    expect(migration.filename).toMatch(/^\d{13,}-extension-test/)

    // Rename .ts to .js to simulate compiled JS-only environment
    const tsPath = `migrations/${migration.filename}.ts`
    const jsPath = `migrations/${migration.filename}.js`

    // Create a simple JS migration content
    const jsContent = `
export async function up(connection) {
  // JS migration up
}

export async function down(connection) {
  // JS migration down
}
`
    fs.writeFileSync(jsPath, jsContent)
    fs.unlinkSync(tsPath)

    // Run migration - should find the .js file via extension fallback
    await migrator.run('up', 'extension-test')

    const foundUp = await migrator.migrationModel.findById(migration._id)
    expect(foundUp?.state).toBe('up')

    // Run down
    await migrator.run('down', 'extension-test')

    const foundDown = await migrator.migrationModel.findById(migration._id)
    expect(foundDown?.state).toBe('down')

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })
})
