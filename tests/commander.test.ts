import chalk from 'chalk'
import mongoose from 'mongoose'

import { migrate, getMigrator } from '../src/commander'
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
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => { throw new Error('process.exit: ' + number) })
    setProcessArgv('list', '-d', uri)
    await expect(migrate.run(true)).rejects.toThrow()
    expect(mockExit).toHaveBeenCalledWith(0)
    mockExit.mockRestore()
  })

  it('should exit 1', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => { throw new Error('process.exit: ' + number) })
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

  it('should prioritize .env above args', async () => {
    process.env.MIGRATE_MONGO_URI = uri

    const migrator = await getMigrator({
      configPath: undefined,
      uri: 'mongodb://localhost:27017',
      collection: 'migrations',
      autosync: false,
      migrationsPath: './migrations',
      templatePath: undefined
    })

    expect(migrator.uri).toBe(uri)
  })
})
