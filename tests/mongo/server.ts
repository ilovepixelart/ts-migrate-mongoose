import fs from 'node:fs/promises'
import mongoose from 'mongoose'

import { MongoMemoryServer } from 'mongodb-memory-server'

export const create = async (dbName: string) => {
  const dbPath = `./tests/mongo/${dbName}`
  await fs.mkdir(dbPath, { recursive: true })

  const server = await MongoMemoryServer.create({
    instance: {
      dbName,
      dbPath,
    },
  })

  const uri = server.getUri()
  const connection = await mongoose.createConnection(uri).asPromise()
  if (connection.readyState !== 1) {
    throw new Error('Connection not open')
  }

  const destroy = async () => {
    await connection.dropDatabase()
    await connection.close()
    await server.stop({ doCleanup: true, force: true })
  }

  return {
    uri,
    destroy,
  }
}
