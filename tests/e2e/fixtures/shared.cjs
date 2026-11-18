'use strict'

const describeError = (error) => ({
  name: error.name,
  message: error.message,
  ...(error.cause instanceof Error ? { cause: describeError(error.cause) } : {}),
})

const attempt = async (fn) => {
  try {
    return { resolved: await fn() }
  } catch (error) {
    return { rejected: describeError(error) }
  }
}

const summary = (docs) => docs.map((doc) => ({ name: doc.name, state: doc.state, filename: doc.filename }))

const migration = (name, failure = '') => `import type { Connection } from 'mongoose'

export async function up(connection: Connection): Promise<void> {
  ${failure}await connection.collection('items').insertOne({ name: '${name}' })
}

export async function down(connection: Connection): Promise<void> {
  await connection.collection('items').deleteMany({ name: '${name}' })
}
`

module.exports = { attempt, migration, summary }
