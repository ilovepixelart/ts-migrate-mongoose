import fs from 'node:fs'
import inquirer from 'inquirer'
import mongoose, { Types } from 'mongoose'

import Migrator from '../src/migrator'
import defaultTemplate from '../src/template'
import { clearDirectory } from './utils/filesystem'

import type { Connection } from 'mongoose'

describe('Tests for Migrator class - Programmatic approach', () => {
  const uri = `${globalThis.__MONGO_URI__}${globalThis.__MONGO_DB_NAME__}`
  let connection: Connection

  beforeEach(async () => {
    clearDirectory('migrations')
    connection = await mongoose.createConnection(uri).asPromise()
    await connection.collection('migrations').deleteMany({})
  })

  afterEach(async () => {
    if (connection.readyState !== 0) {
      await connection.close()
    }
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

    clearDirectory('migrations')
    // Prune
    const migrations = await migrator.prune()

    expect(migrations[0].state).toBe('up')
    expect(migrations[0].name).toBe(migrationName)

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
    await expect(migrator.runMigrations([migration], 'up')).rejects.toThrow(/Cannot find module/)

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should log "Adding migration"', async () => {
    const migrator = await Migrator.connect({ uri })
    const migration = await migrator.create('test-migration')
    clearDirectory('migrations')
    const migrations = await migrator.syncMigrations([migration.filename])
    expect(migrations).toHaveLength(1)
    expect(migrations[0].name).toBe('test-migration')

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should choose first', async () => {
    jest.spyOn(inquirer, 'prompt').mockReturnValue(Promise.resolve({ chosen: ['1'] }))
    const migrator = await Migrator.connect({ uri })
    const answers = await migrator.choseMigrations(['1', '2', '3'], 'Message')
    expect(answers).toEqual(['1'])

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should choose all', async () => {
    jest.spyOn(inquirer, 'prompt').mockReturnValue(Promise.resolve({ chosen: ['1'] }))
    const migrator = await Migrator.connect({ uri, autosync: true })
    const answers = await migrator.choseMigrations(['1', '2', '3'], 'Message')
    expect(answers).toEqual(['1', '2', '3'])

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should throw on sync', async () => {
    const migrator = await Migrator.connect({ uri, autosync: true })
    jest.spyOn(migrator, 'getMigrations').mockImplementation(async () => {
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
    clearDirectory('migrations')
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
    clearDirectory('migrations')
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
    jest.spyOn(migrator, 'getMigrations').mockImplementation(async () => {
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
    const { migrationsInDb, migrationsInFs } = await migrator.getMigrations()
    expect(migrationsInDb).toHaveLength(3)

    expect(migrationsInDb[0].name).toBe('test-migration1')
    expect(migrationsInDb[0].state).toBe('up')
    expect(migrationsInDb[0].filename).toMatch(/^\d{13,}-test-migration1.ts/)

    expect(migrationsInDb[1].name).toBe('test-migration2')
    expect(migrationsInDb[1].state).toBe('down')
    expect(migrationsInDb[1].filename).toMatch(/^\d{13,}-test-migration2.ts/)

    expect(migrationsInDb[2].name).toBe('test-migration3')
    expect(migrationsInDb[2].state).toBe('down')
    expect(migrationsInDb[2].filename).toMatch(/^\d{13,}-test-migration3.ts/)

    expect(migrationsInFs).toHaveLength(3)

    expect(migrationsInFs[0].filename).toMatch(/^\d{13,}-test-migration1.ts/)
    expect(migrationsInFs[0].existsInDatabase).toBe(true)

    expect(migrationsInFs[1].filename).toMatch(/^\d{13,}-test-migration2.ts/)
    expect(migrationsInFs[1].existsInDatabase).toBe(true)

    expect(migrationsInFs[2].filename).toMatch(/^\d{13,}-test-migration3.ts/)
    expect(migrationsInFs[2].existsInDatabase).toBe(true)

    expect(migrationsInDb[0].filename).toBe(migrationsInFs[0].filename)
    expect(migrationsInDb[1].filename).toBe(migrationsInFs[1].filename)
    expect(migrationsInDb[2].filename).toBe(migrationsInFs[2].filename)

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should create migrator instance with wrong template path and fallback to default template', async () => {
    const migrator = await Migrator.connect({ uri, templatePath: 'wrong/path' })
    const migration = await migrator.create('test-migration')
    expect(migration.filename).toMatch(/^\d{13,}-test-migration.ts/)
    const migrationContent = fs.readFileSync(`migrations/${migration.filename}`, 'utf8')
    expect(defaultTemplate).toMatch(migrationContent)

    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should run up and run down', async () => {
    const migrator = await Migrator.connect({ uri })
    const migration = await migrator.create('test-migration')
    expect(migration.filename).toMatch(/^\d{13,}-test-migration.ts/)
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
    expect(migration1.filename).toMatch(/^\d{13,}-test-migration1.ts/)
    expect(migration2.filename).toMatch(/^\d{13,}-test-migration2.ts/)
    expect(migration3.filename).toMatch(/^\d{13,}-test-migration3.ts/)
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
})
