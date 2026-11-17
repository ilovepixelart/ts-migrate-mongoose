import { afterAll, describe, expect, it, vi } from 'vitest'

import fs from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'
import { Migrator } from '../src/index'
import { create } from './mongo/server'

// A 300 ms lease (renewed every 100 ms) stands in for the real one so that a
// migration can outlast several leases within a test.
vi.mock('../src/constants', async (importOriginal) => ({ ...(await importOriginal<typeof import('../src/constants')>()), LOCK_LEASE_MS: 300 }))

const root = path.resolve('tests/lock-lease-tmp')
let seq = 0

describe('migration lock lease', async () => {
  const { uri, destroy } = await create('lock-lease')
  const admin = await mongoose.createConnection(uri).asPromise()
  const open: Migrator[] = []

  const scenario = (files: Record<string, string>) => {
    seq += 1
    const dir = path.join(root, `s${seq}`)
    fs.mkdirSync(dir, { recursive: true })
    const s = { dir, collection: `lease_migrations_${seq}`, ledger: `lease_ledger_${seq}` }
    for (const [file, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, file), body.replaceAll('LEDGER', s.ledger).replaceAll('LOCK', `${s.collection}_lock`))
    return s
  }
  const connect = async (s: { dir: string; collection: string }, lockTimeout?: number) => {
    const migrator = await Migrator.connect({ uri, migrationsPath: s.dir, collection: s.collection, autosync: true, ...(lockTimeout === undefined ? {} : { lockTimeout }) })
    open.push(migrator)
    return migrator
  }
  const ledger = async (ledgerName: string) => (await admin.collection(ledgerName).find().sort({ _id: 1 }).toArray()).map((row) => row.id)

  afterAll(async () => {
    for (const migrator of open) await migrator.close().catch(() => undefined)
    await admin.close()
    fs.rmSync(root, { recursive: true, force: true })
    await destroy()
  })

  it('renews the lease while a migration outlasts it, so another process keeps waiting', async () => {
    const s = scenario({
      '1700000000000-slow.ts': `export async function up(connection) {
  await connection.collection('LEDGER').insertOne({ id: 'slow' })
  await new Promise((resolve) => setTimeout(resolve, 1200))
}`,
    })
    const holder = await connect(s)
    const running = holder.run('up')
    await new Promise((resolve) => setTimeout(resolve, 800))
    const waiter = await connect(s, 0)
    await expect(waiter.run('up')).rejects.toThrow(/^Timed out after 0 ms waiting for the migration lock held by/)
    expect((await running).length).toBe(1)
    expect(await ledger(s.ledger)).toEqual(['slow'])
  })

  it('stops before the next migration once the lease was lost to another process', async () => {
    const s = scenario({
      '1700000000000-first.ts': `export async function up(connection) {
  await connection.collection('LEDGER').insertOne({ id: 'first' })
  await connection.collection('LOCK').updateMany({}, { $set: { holder: 'someone-else' } })
}`,
      '1710000000000-second.ts': `export async function up(connection) {
  await connection.collection('LEDGER').insertOne({ id: 'second' })
}`,
    })
    const migrator = await connect(s)
    await expect(migrator.run('up')).rejects.toThrow("Stopped before migration 'second': the migration lock was lost")
    expect(await ledger(s.ledger)).toEqual(['first'])
    expect((await admin.collection(s.collection).find().sort({ createdAt: 1 }).toArray()).map((doc) => doc.state)).toEqual(['up', 'down'])
    expect((await admin.collection(`${s.collection}_lock`).find().toArray()).map((doc) => doc.holder)).toEqual(['someone-else'])
  })
})
