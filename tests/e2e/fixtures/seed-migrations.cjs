'use strict'

// Writes migration records straight into the collection, bypassing the library's own validation.
// Usage: node seed-migrations.cjs <uri> <records-json>; createdAt is epoch milliseconds, _id an optional 24-hex string.
const mongoose = require('mongoose')

const [uri, records] = process.argv.slice(2)
const docs = JSON.parse(records).map(({ _id, createdAt, ...rest }) => ({
  ...(_id ? { _id: new mongoose.Types.ObjectId(_id) } : {}),
  state: 'down',
  ...rest,
  createdAt: new Date(createdAt),
  updatedAt: new Date(createdAt),
}))

mongoose
  .createConnection(uri)
  .asPromise()
  .then(async (connection) => {
    await connection.collection('migrations').insertMany(docs)
    await connection.close()
  })
