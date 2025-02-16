import fs from 'node:fs'
import chalk from 'chalk'
import mongoose, { type Connection } from 'mongoose'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Migrate, getMigrator } from '../src/commander'
import defaultTemplate from '../src/template'
import { create } from './mongo/server'
import { clearDirectory, deleteDirectory } from './utils/filesystem'

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

describe('cli', async () => {
  const migrationsPath = 'cli'
  const { uri, destroy } = await create('cli')
  const commandLineOptions = ['-d', uri, '-m', migrationsPath]
  let connection: Connection

  afterAll(async () => {
    await deleteDirectory(migrationsPath)
    await destroy()
  })

  beforeEach(async () => {
    await clearDirectory(migrationsPath)
    connection = await mongoose.createConnection(uri).asPromise()
    await connection.collection('migrations').deleteMany({})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should get migrator instance', async () => {
    const migrator = await getMigrator({ uri, migrationsPath })
    expect(migrator).toBeDefined()
    expect(migrator.connection).toBeDefined()
    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
  })

  describe('sequence', async () => {
    it('should run list command', async () => {
      const consoleSpy = vi.spyOn(console, 'log')
      const opts = await exec('list', ...commandLineOptions)
      expect(opts?.uri).toBe(uri)
      expect(consoleSpy).toHaveBeenCalledWith(chalk.cyan('Listing migrations'))
      expect(consoleSpy).toHaveBeenCalledWith(chalk.yellow('There are no migrations to list'))
    })

    it('should run list command with pending migrations', async () => {
      await exec('create', 'migration-name-test', ...commandLineOptions)
      const consoleSpy = vi.spyOn(console, 'log')
      const opts = await exec('list', ...commandLineOptions)
      expect(opts?.uri).toBe(uri)
      expect(consoleSpy).toHaveBeenCalledWith(chalk.cyan('Listing migrations'))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/migration-name-test/))
    })

    it('should run create command', async () => {
      const consoleSpy = vi.spyOn(console, 'log')
      const opts = await exec('create', 'migration-name-test', ...commandLineOptions)
      expect(opts?.uri).toBe(uri)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/^Created migration migration-name-test in/))
    })

    it('should run up command', async () => {
      const migrationName = 'migration-name-test'
      await exec('create', migrationName, ...commandLineOptions)
      const consoleSpy = vi.spyOn(console, 'log')
      const opts = await exec('up', ...commandLineOptions)
      expect(opts?.uri).toBe(uri)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/up:/))
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(migrationName))
      expect(consoleSpy).toHaveBeenCalledWith(chalk.green('All migrations finished successfully'))
    })

    it('should run down command', async () => {
      const migrationName = 'migration-name-test'
      await exec('create', migrationName, ...commandLineOptions)
      await exec('up', migrationName, ...commandLineOptions)
      const consoleSpy = vi.spyOn(console, 'log')
      const opts = await exec('down', 'migration-name-test', ...commandLineOptions)
      expect(opts?.uri).toBe(uri)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(migrationName))
      expect(consoleSpy).toHaveBeenCalledWith(chalk.green('All migrations finished successfully'))
    })
  })

  it('should throw "You need to provide the MongoDB Connection URI to persist migration status.\nUse option --uri / -d to provide the URI."', async () => {
    await expect(exec('up', 'invalid-migration-name')).rejects.toThrow(chalk.red('You need to provide the MongoDB Connection URI to persist migration status.\nUse option --uri / -d to provide the URI.'))
  })

  it('should prune command', async () => {
    await exec('create', 'migration-name-prune', ...commandLineOptions)
    await exec('up', 'migration-name-prune', '-a', 'true', ...commandLineOptions)

    await clearDirectory(migrationsPath)

    const consoleSpy = vi.spyOn(console, 'log')
    const opts = await exec('prune', '-a', 'true', ...commandLineOptions)
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/Removing migration\(s\) from database/))
    expect(opts?.uri).toBe(uri)
    expect(opts?.autosync).toBe('true')
  })

  it('should exit with code 1', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error(`process.exit: ${number}`)
    })
    await expect(execExit('up', ...commandLineOptions)).rejects.toThrow()
    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })

  it('should exit with code 0', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error(`process.exit: ${number}`)
    })
    await expect(execExit('list', ...commandLineOptions)).rejects.toThrow()
    expect(mockExit).toHaveBeenCalledWith(0)
    mockExit.mockRestore()
  })

  it('should log no pending migrations', async () => {
    await exec('create', 'test-migration', ...commandLineOptions)
    await exec('up', ...commandLineOptions)
    const consoleSpy = vi.spyOn(console, 'log')
    await exec('up', ...commandLineOptions)
    expect(consoleSpy).toHaveBeenCalledWith(chalk.yellow('There are no pending migrations'))
  })

  it('should throw "The \'up\' export is not defined in"', async () => {
    await connection.collection('migrations').deleteMany({})
    fs.appendFileSync('migrations/template.ts', 'export function down () { /* do nothing */ }')
    await exec('create', 'test-migration', '-t', 'migrations/template.ts', ...commandLineOptions)
    await expect(exec('up', ...commandLineOptions)).rejects.toThrow(/The 'up' export is not defined in/)
  })

  it('should throw "Failed to run migration"', async () => {
    await connection.collection('migrations').deleteMany({})
    fs.appendFileSync('migrations/template.ts', 'export function up () { throw new Error("Failed to run migration") }')
    await exec('create', 'test-migration', '-t', 'migrations/template.ts', ...commandLineOptions)
    await expect(exec('up', ...commandLineOptions)).rejects.toThrow(/Failed to run migration/)
  })

  it('should disable strict', async () => {
    await connection.collection('migrations').deleteMany({})
    const testModel = `import { Schema, model, models } from 'mongoose'

export interface IExample {
  name: string
  type: Date
}

export const ExampleSchema = new Schema({
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
      .replace('// Import your schemas here', `import { ExampleSchema } from './Example.ts'`)
      .replace(
        '// Write migration here',
        `const Example = connection.model('Example', ExampleSchema)
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
        `const Example = connection.model('Example', ExampleSchema)
await Example.deleteMany({ propertyIsNotDefinedInSchema: 'some-value' })
await Example.deleteMany({ type: 1 })`,
      )

    console.log(testModel)
    console.log(testTemplate)

    fs.appendFileSync(`${migrationsPath}/Example.ts`, testModel)
    fs.appendFileSync(`${migrationsPath}/template.ts`, testTemplate)

    await exec('create', 'test-migration', '-t', `${migrationsPath}/template.ts`, ...commandLineOptions)
    await exec('up', 'test-migration', ...commandLineOptions)
    const countUp = await connection.collection('examples').countDocuments()
    expect(countUp).toBe(4)
    await exec('down', 'test-migration', ...commandLineOptions)
    const countDown = await connection.collection('examples').countDocuments()
    expect(countDown).toBe(2)
  })
})
