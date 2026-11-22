import fs from 'node:fs'
import path from 'node:path'
import { fixturesDir } from '../harness'

import type { ScenarioContext } from '../harness'

export const people = (name: string, failure = ''): string => `import type { Connection } from 'mongoose'

export async function up(connection: Connection): Promise<void> {
  ${failure}await connection.collection('people').insertOne({ name: '${name}' })
}

export async function down(connection: Connection): Promise<void> {
  await connection.collection('people').deleteMany({ name: '${name}' })
}
`

const personModel = `import { Schema } from 'mongoose'

export const PersonSchema = new Schema({ name: { type: String, required: true } })
`

const personMigration = `import type { Connection } from 'mongoose'
import { PersonSchema } from '../models/Person'

const Person = (connection: Connection) => connection.models.Person ?? connection.model('Person', PersonSchema, 'people')

export async function up(connection: Connection): Promise<void> {
  await Person(connection).create({ name: 'alice' })
}

export async function down(connection: Connection): Promise<void> {
  await Person(connection).deleteMany({ name: 'alice' }).exec()
}
`

export const seedThree = (context: ScenarioContext): void => {
  context.write('models/Person.ts', personModel)
  context.write('migrations/1700000000001-add-alice.ts', personMigration)
  context.write('migrations/1700000000002-add-bob.ts', people('bob'))
  context.write('migrations/1700000000003-add-carol.ts', people('carol'))
}

export const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`

interface MigrationRecord {
  name: string
  createdAt: number
  _id?: string
}

// Plants records in the scenario's migrations collection as an older version or another tool could have left them.
export const seedRecords = async (context: ScenarioContext, records: MigrationRecord[]): Promise<number | null> => {
  fs.copyFileSync(path.join(fixturesDir, 'seed-migrations.cjs'), path.join(context.dir, 'seed-migrations.cjs'))
  const result = await context.node('seed-migrations.cjs', [context.uri, JSON.stringify(records)])
  return result.exitCode
}
