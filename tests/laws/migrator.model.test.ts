import { afterAll, describe, expect, it } from 'vitest'

import fc from 'fast-check'
import { Migrator } from '../../src/index'
import { create } from '../mongo/server'
import { checkAgainstModel, singleRerun } from './model.mjs'

// Model-based test (model.mjs): random sequences of sync, prune and every run() variant against Migrator from src/,
// compared after each command with migrations/main.bend, whose behaviour migrations/PROOF.bend proves.
// The e2e suite runs the same check against the packed package.

describe('Migrator against the proven model (migrations/main.bend)', async () => {
  const { uri, destroy } = await create('model')
  const connect = (options: { migrationsPath: string; collection: string }) => Migrator.connect({ uri, autosync: true, ...options })

  // mongodb-memory-server gives mongod 10 s to stop on SIGINT before SIGKILL; under load the stop can use all of it.
  afterAll(async () => {
    await destroy()
  }, 30_000)

  it('agrees with the model on every command of random sequences', async () => {
    expect(await checkAgainstModel(fc, connect, { numRuns: 40 })).toBe(40)
  }, 300_000)

  // Known defect, pinned as it is: run(direction, name, true) takes the named migration whatever its state
  // (src/index.ts, collectMigrationsToRun), so a second `up <name> --single` applies an applied migration again;
  // the model (single_ran) runs nothing. A fix fails this test; then generate single steps in either state in model.mjs.
  it('known defect: a named single step runs a migration already in the target state again', async () => {
    expect(await singleRerun(connect)).toEqual({ model: [], ran: ['m0'], executed: ['m0:up'] })
  })
})
