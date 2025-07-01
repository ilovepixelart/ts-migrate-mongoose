import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import mongoose from 'mongoose'
import { chalk } from '../src/chalk'
import { getConfig, getMigrator, Migrate } from '../src/commander'
import { Migrator } from '../src/index'
import { create } from './mongo/server'
import { clearDirectory, deleteDirectory } from './utils/filesystem'

import type { Connection } from 'mongoose'

const setProcessArgv = (...args: string[]) => {
  process.argv = ['node', 'migrate', ...args]
}

describe('commander', async () => {
  const migrationsPath = 'commander'
  const migrate = new Migrate()
  const { uri, destroy } = await create('commander')
  const commandLineOptions = ['-d', uri, '-m', migrationsPath]
  let connection: Connection

  afterAll(async () => {
    await deleteDirectory(migrationsPath)
    await destroy()
  })

  beforeEach(async () => {
    await clearDirectory(migrationsPath)
    connection = await mongoose.createConnection(uri).asPromise()
    await connection.collection(migrationsPath).deleteMany({})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should exit 0', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error(`process.exit: ${number}`)
    })
    setProcessArgv('list', ...commandLineOptions)
    await expect(migrate.run(true)).rejects.toThrow()
    expect(mockExit).toHaveBeenCalledWith(0)
    mockExit.mockRestore()
  })

  it('should exit 1', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error(`process.exit: ${number}`)
    })
    setProcessArgv('list', '--invalid', ...commandLineOptions)
    await expect(migrate.run(true)).rejects.toThrow()
    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })

  it('should run list command', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    setProcessArgv('list', ...commandLineOptions)
    await migrate.run(false)
    expect(consoleSpy).toHaveBeenCalledWith(chalk.cyan('Listing migrations'))
    expect(consoleSpy).toHaveBeenCalledWith(chalk.yellow('There are no migrations to list'))
  })

  it('should getConfig .json options', async () => {
    const config = await getConfig('./examples/config-file-usage/src/migrate.json')
    expect(config).toEqual({
      uri: 'mongodb://localhost/my-db',
      migrationsPath: 'migrations',
    })
  })

  it('should getConfig .ts options', async () => {
    const config = await getConfig('./examples/config-file-usage/src/migrate.ts')
    expect(config).toEqual({
      uri: 'mongodb://localhost/my-db',
      migrationsPath: 'migrations',
      connectOptions: {
        autoIndex: true,
      },
    })
  })

  it('should getConfig .js options', async () => {
    const config = await getConfig('./examples/config-file-usage/dist/migrate.js')
    expect(config).toEqual({
      uri: 'mongodb://localhost/my-db',
      migrationsPath: 'migrations',
      connectOptions: {
        autoIndex: true,
      },
    })
  })

  it('should check if connectionOptions .ts are passed', async () => {
    // Mocking connect method to avoid connecting to database
    const connectSpy = vi.spyOn(Migrator, 'connect').mockImplementation(vi.fn())
    // Only providing configPath, connectOptions should come from config file
    await getMigrator({
      configPath: './examples/config-file-usage/src/migrate.ts',
    })

    expect(connectSpy).toHaveBeenCalledWith({
      migrationsPath: 'migrations',
      uri: 'mongodb://localhost/my-db',
      autosync: false,
      cli: true,
      collection: 'migrations',
      connectOptions: {
        autoIndex: true,
      },
    })

    connectSpy.mockRestore()
  })

  it('should check if connectionOptions .js are passed', async () => {
    // Mocking connect method to avoid connecting to database
    const connectSpy = vi.spyOn(Migrator, 'connect').mockImplementation(vi.fn())
    // Only providing configPath, connectOptions should come from config file
    await getMigrator({
      configPath: './examples/config-file-usage/dist/migrate.js',
    })

    expect(connectSpy).toHaveBeenCalledWith({
      migrationsPath: 'migrations',
      uri: 'mongodb://localhost/my-db',
      autosync: false,
      cli: true,
      collection: 'migrations',
      connectOptions: {
        autoIndex: true,
      },
    })

    connectSpy.mockRestore()
  })
})
