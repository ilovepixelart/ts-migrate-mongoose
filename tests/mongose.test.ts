import mongoose from 'mongoose'

import type { Connection } from 'mongoose'

describe('mongoose', () => {
  const uri = `${globalThis.__MONGO_URI__}${globalThis.__MONGO_DB_NAME__}`
  let connection: Connection

  beforeAll(async () => {
    connection = await mongoose.createConnection(uri).asPromise()
    await connection.collection('migrations').deleteMany({})
  })

  afterAll(async () => {
    await connection.close()
  })

  it('should insert a doc into collection', async () => {
    const users = connection.db.collection('users')

    const mockUser = { name: 'John' }
    const user = await users.insertOne(mockUser)

    const insertedUser = await users.findOne({ _id: user.insertedId })
    expect(insertedUser).toEqual(mockUser)
  })
})
