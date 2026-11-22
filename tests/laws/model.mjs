// Model-based check of a Migrator against migrations/main.bend: every command fast-check generates is sent to the
// real Migrator and, as a Cmd, to the model's step, whose behaviour migrations/LAWS.bend states and PROOF.bend proves.
// Plain JS on purpose: the vitest suite runs it against src/, and the e2e suite runs it inside a consumer project
// against the installed package. It asserts with node:assert, so it needs neither vitest nor TypeScript.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Model from './migrations/main.mjs'

const EPOCH = 1_700_000_000_000
// Few distinct timestamps, so createdAt ties (ordered by _id) are common.
const TIMES = [1, 2, 3]
const NIL = { $: 'Nil' }

export const toArray = (list) => {
  const items = []
  for (let node = list; node.$ === 'Con'; node = node.tail) items.push(node.head)
  return items
}

export const migrationName = (id) => `m${String(id)}`
export const migrationFile = (dir, m) => path.join(dir, `${String(EPOCH + m.t)}-${migrationName(m.id)}.ts`)
export const migrationSource = (effects, name) => `import type { Connection } from 'mongoose'

export async function up(connection: Connection): Promise<void> {
  await connection.collection('${effects}').insertOne({ entry: '${name}:up' })
}

export async function down(connection: Connection): Promise<void> {
  await connection.collection('${effects}').insertOne({ entry: '${name}:down' })
}
`

// The up/down entries the migrations wrote since the last call.
export const executed = async (real) => {
  const entries = await real.migrator.connection.collection(real.effects).find({}, { sort: { _id: 1 } }).toArray()
  const fresh = entries.slice(real.seen).map((entry) => String(entry.entry))
  real.seen = entries.length
  return fresh
}

const nth = (model, pick) => {
  const migs = toArray(model.migs)
  return migs[pick % migs.length]
}

// The real Migrator ran exactly ranIds in that order, executing each one's up or down, and lists the model's state.
const agree = async (real, model, ran, ranIds, direction) => {
  assert.deepEqual(
    ran.map((m) => m.name),
    ranIds.map(migrationName),
  )
  assert.deepEqual(
    await executed(real),
    ranIds.map((id) => `${migrationName(id)}:${direction}`),
  )
  const listed = (await real.migrator.list()).map((m) => `${m.name}:${m.state}`)
  assert.deepEqual(
    listed,
    toArray(model.migs).map((m) => `${migrationName(m.id)}:${m.up ? 'up' : 'down'}`),
  )
}

const command = (label, check, run) => ({ check, run, toString: () => label })
const some = (model) => model.migs.$ === 'Con'

// The model's answer to cmd: model.migs becomes the state after it, and the ids it ran are returned.
const step = (model, cmd) => {
  const { fst, snd } = Model.step(model.migs, cmd)
  model.migs = fst
  return toArray(snd)
}

const add = (t) =>
  command(
    `sync new migration at t=${String(t)}`,
    () => true,
    async (model, real) => {
      const m = { $: 'M', id: model.nextId++, t, up: false }
      fs.writeFileSync(migrationFile(real.dir, m), migrationSource(real.effects, migrationName(m.id)))
      const synced = await real.migrator.sync()
      step(model, { $: 'Add', id: m.id, t })
      assert.deepEqual(
        synced.map((doc) => doc.name),
        [migrationName(m.id)],
      )
      await agree(real, model, [], [], 'up')
    },
  )

const remove = (pick) =>
  command(`prune migration #${String(pick)}`, some, async (model, real) => {
    const m = nth(model, pick)
    fs.rmSync(migrationFile(real.dir, m))
    const pruned = await real.migrator.prune()
    step(model, { $: 'Remove', id: m.id })
    assert.deepEqual(
      pruned.map((doc) => doc.name),
      [migrationName(m.id)],
    )
    await agree(real, model, [], [], 'up')
  })

const upTo = (pick) =>
  command(`up to #${String(pick)}`, some, async (model, real) => {
    const m = nth(model, pick)
    const ranIds = step(model, { $: 'UpTo', c: m.t })
    await agree(real, model, await real.migrator.run('up', migrationName(m.id)), ranIds, 'up')
  })

const downTo = (pick) =>
  command(`down to #${String(pick)}`, some, async (model, real) => {
    const m = nth(model, pick)
    const ranIds = step(model, { $: 'DownTo', c: m.t })
    await agree(real, model, await real.migrator.run('down', migrationName(m.id)), ranIds, 'down')
  })

const upAll = () =>
  command(
    'up',
    () => true,
    async (model, real) => {
      const ranIds = step(model, { $: 'UpAll' })
      await agree(real, model, await real.migrator.run('up'), ranIds, 'up')
    },
  )

const downAll = () =>
  command(
    'down',
    () => true,
    async (model, real) => {
      const ranIds = step(model, { $: 'DownAll' })
      await agree(real, model, await real.migrator.run('down'), ranIds, 'down')
    },
  )

// A named single step on a migration already in the target state runs it again (a known defect, pinned in the
// suites), so it is generated only for a migration in the other state.
const single = (pick, up) =>
  command(
    `${up ? 'up' : 'down'} #${String(pick)} --single`,
    (model) => some(model) && nth(model, pick).up !== up,
    async (model, real) => {
      const m = nth(model, pick)
      const ranIds = step(model, { $: 'Single', id: m.id, up })
      await agree(real, model, await real.migrator.run(up ? 'up' : 'down', migrationName(m.id), true), ranIds, up ? 'up' : 'down')
    },
  )

const nextSingle = (up) =>
  command(
    `${up ? 'up' : 'down'} --single`,
    () => true,
    async (model, real) => {
      const ranIds = step(model, up ? { $: 'NextUp' } : { $: 'LastDown' })
      await agree(real, model, await real.migrator.run(up ? 'up' : 'down', undefined, true), ranIds, up ? 'up' : 'down')
    },
  )

export const commandArbitraries = (fc) => [
  fc.constantFrom(...TIMES).map(add),
  fc.nat().map(remove),
  fc.nat().map(upTo),
  fc.nat().map(downTo),
  fc.constant(upAll()),
  fc.constant(downAll()),
  fc.tuple(fc.nat(), fc.boolean()).map(([pick, up]) => single(pick, up)),
  fc.boolean().map(nextSingle),
]

// Runs numRuns random command sequences, each against a fresh migrations folder and collection opened by connect.
export const checkAgainstModel = async (fc, connect, { numRuns, seed } = {}) => {
  let runs = 0
  await fc.assert(
    fc.asyncProperty(fc.commands(commandArbitraries(fc), { maxCommands: 25 }), async (sequence) => {
      const id = String(runs++)
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmm-model-'))
      const migrator = await connect({ migrationsPath: dir, collection: `migrations_${id}` })
      const real = { migrator, dir, effects: `effects_${id}`, seen: 0 }
      try {
        await fc.asyncModelRun(() => ({ model: { migs: NIL, nextId: 0 }, real }), sequence)
      } finally {
        const db = migrator.connection.db
        const names = new Set((await db.listCollections().toArray()).map((collection) => collection.name))
        for (const name of [`migrations_${id}`, real.effects]) if (names.has(name)) await db.dropCollection(name)
        await migrator.close()
        fs.rmSync(dir, { recursive: true, force: true })
      }
    }),
    { numRuns, seed },
  )
  return runs
}

// The model's answer to the same history: sync m, run('up', its name), then the named single step again.
const modelRerun = (m) => {
  const model = { migs: NIL }
  for (const cmd of [{ $: 'Add', id: m.id, t: m.t }, { $: 'UpTo', c: m.t }]) step(model, cmd)
  return step(model, { $: 'Single', id: m.id, up: true })
}

// A named single step on a migration already in the target state: what the model runs, and what the Migrator runs.
export const singleRerun = async (connect) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmm-model-'))
  const migrator = await connect({ migrationsPath: dir, collection: 'migrations_rerun' })
  const real = { migrator, dir, effects: 'effects_rerun', seen: 0 }
  try {
    const m = { $: 'M', id: 0, t: 1, up: false }
    fs.writeFileSync(migrationFile(dir, m), migrationSource(real.effects, migrationName(m.id)))
    await migrator.run('up', migrationName(m.id))
    await executed(real)
    const ran = (await migrator.run('up', migrationName(m.id), true)).map((doc) => doc.name)
    return {
      model: modelRerun(m),
      ran,
      executed: await executed(real),
    }
  } finally {
    await migrator.connection.db.dropDatabase()
    await migrator.close()
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
