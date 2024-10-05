import chalk from 'chalk'
import mongoose from 'mongoose'

import { getConfig, getMigrator, migrate } from '../src/commander'
import Migrator from '../src/migrator'
import { clearDirectory } from './utils/filesystem'

import type { Connection } from 'mongoose'

const setProcessArgv = (...args: string[]) => {
  process.argv = ['node', 'migrate', ...args]
}

describe('commander', () => {
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

  it('should exit 0', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error(`process.exit: ${number}`)
    })
    setProcessArgv('list', '-d', uri)
    await expect(migrate.run(true)).rejects.toThrow()
    expect(mockExit).toHaveBeenCalledWith(0)
    mockExit.mockRestore()
  })

  it('should exit 1', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error(`process.exit: ${number}`)
    })
    setProcessArgv('list', '-d', uri, '--invalid')
    await expect(migrate.run(true)).rejects.toThrow()
    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })

  it('should run list command', async () => {
    const consoleSpy = jest.spyOn(console, 'log')
    setProcessArgv('list', '-d', uri)
    await migrate.run(false)
    expect(consoleSpy).toHaveBeenCalledWith(chalk.cyan('Listing migrations'))
    expect(consoleSpy).toHaveBeenCalledWith(chalk.yellow('There are no migrations to list'))
  })

  it('should getConfig .json options', async () => {
    const config = await getConfig('./examples/config-file-usage/migrate.json')
    expect(config).toEqual({
      uri: 'mongodb://localhost/my-db',
      migrationsPath: 'migrations',
    })
  })

  it('should getConfig .ts options', async () => {
    const config = await getConfig('./examples/config-file-usage/migrate.ts')
    expect(config).toEqual({
      uri: 'mongodb://localhost/my-db',
      migrationsPath: 'migrations',
      connectOptions: {
        autoIndex: true,
        useNewUrlParser: true,
        useUnifiedTopology: true,
      },
    })
  })

  it('should getConfig .js options', async () => {
    const config = await getConfig('./examples/config-file-usage/migrate.js')
    expect(config).toEqual({})
  })

  it('should check if connectionOptions are passed', async () => {
    // Mocking connect method to avoid connecting to database
    const connectSpy = jest.spyOn(Migrator, 'connect').mockImplementation()
    // Only providing configPath, connectOptions should come from config file
    await getMigrator({
      configPath: './examples/config-file-usage/migrate.ts',
    })

    expect(connectSpy).toHaveBeenCalledWith({
      migrationsPath: 'migrations',
      uri: 'mongodb://localhost/my-db',
      autosync: false,
      cli: true,
      collection: 'migrations',
      connectOptions: {
        autoIndex: true,
        useNewUrlParser: true,
        useUnifiedTopology: true,
      },
    })

    connectSpy.mockRestore()
  })
})
