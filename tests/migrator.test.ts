import fs from 'fs'
import path from 'path'
import colors from 'colors'
import inquirer from 'inquirer'
import mongoose, { Connection, Types } from 'mongoose'

import Migrator from '../src/migrator'
import { clearDirectory } from '../utils/filesystem'

colors.enable()

describe('library', () => {
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

  it('should throw "There are no pending migrations"', async () => {
    const migrator = new Migrator({ connection })
    expect(migrator).toBeInstanceOf(Migrator)

    await migrator.connected()
    expect(migrator.connection.readyState).toEqual(1)

    await expect(migrator.run('up')).rejects.toThrowError('There are no pending migrations')
  })

  it('should throw "There is already a migration with name \'create-users\' in the database"', async () => {
    const migrationName = 'create-users'
    const migrator = new Migrator({ connection })
    expect(migrator).toBeInstanceOf(Migrator)

    await migrator.connected()
    expect(migrator.connection.readyState).toEqual(1)

    const migration = await migrator.create(migrationName)
    expect(migration.filename).toContain(migrationName)

    await expect(migrator.create(migrationName)).rejects.toThrowError(`There is already a migration with name '${migrationName}' in the database`)
  })

  it('should throw "The direction \'sideways\' is not supported, use the \'up\' or \'down\' direction"', async () => {
    const migrationName = 'create-aliens'
    const direction = 'sideways'
    const migrator = new Migrator({ connection })
    expect(migrator).toBeInstanceOf(Migrator)

    await migrator.connected()
    expect(migrator.connection.readyState).toEqual(1)

    const migration = await migrator.create(migrationName)
    expect(migration.filename).toContain(migrationName)

    await expect(migrator.run(direction)).rejects.toThrowError(`The direction '${direction}' is not supported, use the 'up' or 'down' direction`)
  })

  it('should throw "There are no pending migrations"', async () => {
    const migrator = new Migrator({ connection, cli: true })
    expect(migrator).toBeInstanceOf(Migrator)

    await migrator.connected()
    expect(migrator.connection.readyState).toEqual(1)

    await expect(migrator.run('up')).rejects.toThrowError('There are no pending migrations')
  })

  it('should throw "Could not find that migration in the database"', async () => {
    const migrationName = 'create-unicorns'
    const migrator = new Migrator({ connection, cli: true })
    expect(migrator).toBeInstanceOf(Migrator)

    await migrator.connected()
    expect(migrator.connection.readyState).toEqual(1)

    await expect(migrator.run('down', migrationName)).rejects.toThrowError('Could not find that migration in the database')
  })

  it('should create migrator with mongoose connection', async () => {
    const migrator = new Migrator({ connection })
    expect(migrator).toBeInstanceOf(Migrator)

    await migrator.connected()
    expect(migrator.connection.readyState).toEqual(1)

    await migrator.close()
    expect(migrator.connection.readyState).toEqual(0)
  })

  it('should create migrator with uri', async () => {
    const migrator = new Migrator({ uri })
    expect(migrator).toBeInstanceOf(Migrator)

    await migrator.connected()
    expect(migrator.connection.readyState).toEqual(1)

    await migrator.close()
    expect(migrator.connection.readyState).toEqual(0)
  })

  it('should insert a doc into collection with migrator', async () => {
    const migrator = new Migrator({ uri, autosync: true })
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
          name: migrationName
        })
      ])
    )

    // Close the underlying connection to mongo
    await migrator.close()
    expect(migrator.connection.readyState).toEqual(0)
  })

  it('should prune all migrations', async () => {
    const migrator = new Migrator({ uri, autosync: true })

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
    expect(migrationsInDB.length).toBe(0)

    await migrator.close()
    expect(migrator.connection.readyState).toEqual(0)
  })

  it('should throw "No mongoose connection or mongo uri provided to migrator"', () => {
    expect(() => {
      const migrator = new Migrator({ uri: '' })
      expect(migrator).toBeInstanceOf(Migrator)
    }).toThrowError('No mongoose connection or mongo uri provided to migrator')
  })

  it('should ensure migrations path', async () => {
    fs.rmdirSync('migrations', { recursive: true })
    const migrator = new Migrator({ connection })
    expect(migrator).toBeInstanceOf(Migrator)
    expect(fs.existsSync('migrations')).toBe(true)
    await migrator.close()
  })

  it('should throw "Failed to run migration"', async () => {
    const migrator = new Migrator({ connection })
    const migration = await migrator.migrationModel.create({
      name: 'test-migration',
      createdAt: new Date()
    })
    expect(migrator.runMigrations([migration], 'up', [])).rejects.toThrowError(/Cannot find module/)
  })

  it('should log "Adding migration"', async () => {
    const migrator = new Migrator({ connection })
    const migration = await migrator.create('test-migration')
    clearDirectory('migrations')
    const migrations = await migrator.syncMigrations([migration.filename])
    expect(migrations.length).toBe(1)
    expect(migrations[0].name).toBe('test-migration')
  })

  it('should choose first', async () => {
    jest.spyOn(inquirer, 'prompt').mockReturnValue(Promise.resolve({ chosen: ['1'] }))
    const migrator = new Migrator({ connection })
    const answers = await migrator.choseMigrations(['1', '2', '3'], 'Message')
    expect(answers).toEqual(['1'])
  })

  it('should choose first', async () => {
    jest.spyOn(inquirer, 'prompt').mockReturnValue(Promise.resolve({ chosen: ['1'] }))
    const migrator = new Migrator({ connection, autosync: true })
    const answers = await migrator.choseMigrations(['1', '2', '3'], 'Message')
    expect(answers).toEqual(['1', '2', '3'])
  })

  it('should throw on sync', async () => {
    const migrator = new Migrator({ connection, autosync: true })
    await migrator.connection.asPromise()
    jest.spyOn(migrator, 'getMigrations').mockImplementation(async () => {
      throw new Error('Sync error')
    })
    await expect(migrator.sync()).rejects.toThrowError('Sync error')
  })

  it('should throw on prune', async () => {
    const migrator = new Migrator({ connection, autosync: true })
    await migrator.connection.asPromise()
    jest.spyOn(migrator, 'getMigrations').mockImplementation(async () => {
      throw new Error('Sync error')
    })
    await expect(migrator.prune()).rejects.toThrowError('Sync error')
  })
})
