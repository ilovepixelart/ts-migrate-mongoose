import { afterAll, describe, expect, it } from 'vitest'

import fs from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'
import { Migrator } from '../src/index'
import { create } from './mongo/server'

const root = path.resolve('tests/close-tmp')

describe('Migrator.close()', async () => {
  const { uri, destroy } = await create('close')
  fs.mkdirSync(root, { recursive: true })
  const connect = () => Migrator.connect({ uri, migrationsPath: root, autosync: true })

  afterAll(async () => {
    fs.rmSync(root, { recursive: true, force: true })
    await destroy()
  })

  it('close() disconnects the connection, and a second close() resolves', async () => {
    const migrator = await connect()
    expect(migrator.connection.readyState).toBe(1)
    await migrator.close()
    expect(migrator.connection.readyState).toBe(0)
    await expect(migrator.close()).resolves.toBeUndefined()
    expect(migrator.connection.readyState).toBe(0)
  })

  it('close() leaves other mongoose connections open', async () => {
    const other = await mongoose.createConnection(uri).asPromise()
    const migrator = await connect()
    await migrator.close()
    expect(other.readyState).toBe(1)
    expect(mongoose.connections).toContain(other)
    await other.close()
  })
})
