import fs from 'node:fs/promises'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

export const create = async (dbName: string): Promise<{ uri: string; destroy: () => Promise<void> }> => {
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

  const destroy = async (): Promise<void> => {
    await connection.dropDatabase()
    await connection.close()
    await server.stop({ doCleanup: true, force: true })
  }

  return {
    uri,
    destroy,
  }
}
