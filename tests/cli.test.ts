import fs from 'node:fs'
import chalk from 'chalk'
import mongoose from 'mongoose'

import { Migrate, getMigrator } from '../src/commander'
import defaultTemplate from '../src/template'
import { clearDirectory } from './utils/filesystem'

import type { Connection } from 'mongoose'

const exec = (...args: string[]) => {
  const migrate = new Migrate()
  process.argv = ['node', 'migrate', ...args]
  return migrate.run(false)
}

const execExit = (...args: string[]) => {
  const migrate = new Migrate()
  process.argv = ['node', 'migrate', ...args]
  return migrate.run()
}

describe('cli', () => {
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

  it('should get migrator instance', async () => {
    const migrator = await getMigrator({ uri })
    expect(migrator).toBeDefined()
    expect(migrator.connection).toBeDefined()
    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('should run list command', async () => {
    const consoleSpy = jest.spyOn(console, 'log')
    const opts = await exec('list', '-d', uri)
    expect(opts?.uri).toBe(uri)
    expect(consoleSpy).toHaveBeenCalledWith(chalk.cyan('Listing migrations'))
    expect(consoleSpy).toHaveBeenCalledWith(chalk.yellow('There are no migrations to list'))
  })

  it('should run list command with pending migrations', async () => {
    await exec('create', 'migration-name-test', '-d', uri)
    const consoleSpy = jest.spyOn(console, 'log')
    const opts = await exec('list', '-d', uri)
    expect(opts?.uri).toBe(uri)
    expect(consoleSpy).toHaveBeenCalledWith(chalk.cyan('Listing migrations'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/migration-name-test/))
  })

  it('should run create command', async () => {
    const consoleSpy = jest.spyOn(console, 'log')
    const opts = await exec('create', 'migration-name-test', '-d', uri)
    expect(opts?.uri).toBe(uri)
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/^Created migration migration-name-test in/))
  })

  it('should run up command', async () => {
    const migrationName = 'migration-name-test'
    await exec('create', migrationName, '-d', uri)
    const consoleSpy = jest.spyOn(console, 'log')
    const opts = await exec('up', '-d', uri)
    expect(opts?.uri).toBe(uri)
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/up:/))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(migrationName))
    expect(consoleSpy).toHaveBeenCalledWith(chalk.green('All migrations finished successfully'))
  })

  it('should run down command', async () => {
    const migrationName = 'migration-name-test'
    await exec('create', migrationName, '-d', uri)
    await exec('up', migrationName, '-d', uri)
    const consoleSpy = jest.spyOn(console, 'log')
    const opts = await exec('down', 'migration-name-test', '-d', uri)
    expect(opts?.uri).toBe(uri)
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(migrationName))
    expect(consoleSpy).toHaveBeenCalledWith(chalk.green('All migrations finished successfully'))
  })

  it('should throw "You need to provide the MongoDB Connection URI to persist migration status.\nUse option --uri / -d to provide the URI."', async () => {
    await expect(exec('up', 'invalid-migration-name')).rejects.toThrow(chalk.red('You need to provide the MongoDB Connection URI to persist migration status.\nUse option --uri / -d to provide the URI.'))
  })

  it('should prune command', async () => {
    await exec('create', 'migration-name-prune', '-d', uri)
    await exec('up', 'migration-name-prune', '-d', uri, '-a', 'true')

    clearDirectory('migrations')

    const consoleSpy = jest.spyOn(console, 'log')
    const opts = await exec('prune', '-d', uri, '-a', 'true')
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/Removing migration\(s\) from database/))
    expect(opts?.uri).toBe(uri)
    expect(opts?.autosync).toBe('true')
  })

  it('should exit with code 1', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error(`process.exit: ${number}`)
    })
    await expect(execExit('up')).rejects.toThrow()
    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })

  it('should exit with code 0', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error(`process.exit: ${number}`)
    })
    await expect(execExit('list', '-d', uri)).rejects.toThrow()
    expect(mockExit).toHaveBeenCalledWith(0)
    mockExit.mockRestore()
  })

  it('should log no pending migrations', async () => {
    await exec('create', 'test-migration', '-d', uri)
    await exec('up', '-d', uri)
    const consoleSpy = jest.spyOn(console, 'log')
    await exec('up', '-d', uri)
    expect(consoleSpy).toHaveBeenCalledWith(chalk.yellow('There are no pending migrations'))
  })

  it('should throw "The \'up\' export is not defined in"', async () => {
    clearDirectory('migrations')
    await connection.collection('migrations').deleteMany({})
    fs.appendFileSync('migrations/template.ts', 'export function down () { /* do nothing */ }')
    await exec('create', 'test-migration', '-d', uri, '-t', 'migrations/template.ts')
    await expect(exec('up', '-d', uri)).rejects.toThrow(/The 'up' export is not defined in/)
  })

  it('should throw "Failed to run migration"', async () => {
    clearDirectory('migrations')
    await connection.collection('migrations').deleteMany({})
    fs.appendFileSync('migrations/template.ts', 'export function up () { throw new Error("Failed to run migration") }')
    await exec('create', 'test-migration', '-d', uri, '-t', 'migrations/template.ts')
    await expect(exec('up', '-d', uri)).rejects.toThrow(/Failed to run migration/)
  })

  it('should disable strict', async () => {
    clearDirectory('migrations')
    await connection.collection('migrations').deleteMany({})
    const testModel = `import { Schema, model, models } from 'mongoose'

export interface IExample {
  name: string
  type: Date
}

export let ExampleSchema = new Schema({
  name: {
    type: Schema.Types.String,
    required: true,
  },
  type: {
    type: Schema.Types.Number,
    required: true,
  },
})

export default models.User ?? model<IExample>('Example', ExampleSchema)`

    const testTemplate = defaultTemplate
      .replace(
        '// Import your models here',
        `
import Example from './Example.ts'
      `,
      )
      .replace(
        '// Write migration here',
        `
  await Example.insertMany([
    {
      name: 'test',
      type: 1,
    },
    {
      name: 'test2',
      type: 1,
    },
    {
      name: 'test3',
      type: 2,
    },
    {
      name: 'test4',
      type: 2,
    }
  ])`,
      )
      .replace(
        '// Write migration here',
        `
  await Example.deleteMany({ propertyIsNotDefinedInSchema: 'some-value' })
  await Example.deleteMany({ type: 1 })
  `,
      )

    console.log(testModel)
    console.log(testTemplate)

    fs.appendFileSync('migrations/Example.ts', testModel)
    fs.appendFileSync('migrations/template.ts', testTemplate)

    await mongoose.connect(uri)
    await exec('create', 'test-migration', '-d', uri, '-t', 'migrations/template.ts')
    await exec('up', 'test-migration', '-d', uri)
    const countUp = await mongoose.connection.collection('examples').countDocuments()
    expect(countUp).toBe(4)
    await exec('down', 'test-migration', '-d', uri)
    const countDown = await mongoose.connection.collection('examples').countDocuments()
    expect(countDown).toBe(2)
    await mongoose.disconnect()
  })
})
