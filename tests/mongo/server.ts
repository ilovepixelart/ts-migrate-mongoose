import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

export const create = async (dbName: string): Promise<{ uri: string; destroy: () => Promise<void> }> => {
  // No dbPath: each server gets a fresh temporary directory, which stop({ doCleanup }) removes. A fixed dbPath
  // outlives a run whose teardown never finished, and the next run starts on that run's data.
  const server = await MongoMemoryServer.create({
    instance: {
      dbName,
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
