'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { attempt, migration, summary } = require('./shared.cjs')

const exercise = async (Migrator, migrationsPath, uri, closedUri, out) => {
  const migrator = await Migrator.connect({ uri, migrationsPath, autosync: true })
  out.isMigrator = migrator instanceof Migrator
  out.listEmpty = summary(await migrator.list())

  const first = await migrator.create('first')
  const second = await migrator.create('second')
  out.created = summary([first, second])
  out.template = fs.readFileSync(path.join(migrationsPath, `${first.filename}.ts`), 'utf8')
  fs.writeFileSync(path.join(migrationsPath, `${first.filename}.ts`), migration('first'))
  fs.writeFileSync(path.join(migrationsPath, `${second.filename}.ts`), migration('second'))

  out.upAll = summary(await migrator.run('up'))
  out.upNothingPending = summary(await migrator.run('up'))
  out.downToFirst = summary(await migrator.run('down', 'first'))
  out.upSingle = summary(await migrator.run('up', undefined, true))
  out.downSingle = summary(await migrator.run('down', 'first', true))
  out.items = await migrator.connection.collection('items').find({}, { projection: { _id: 0 } }).sort({ name: 1 }).toArray()

  out.upMissing = await attempt(() => migrator.run('up', 'missing'))
  out.upNonString = await attempt(() => migrator.run('up', 42))
  out.createTraversal = await attempt(() => migrator.create('a/../../escaped'))
  out.createDuplicate = await attempt(() => migrator.create('first'))

  fs.writeFileSync(path.join(migrationsPath, '1700000000000-seeded.ts'), migration('seeded'))
  out.sync = summary(await migrator.sync())
  fs.rmSync(path.join(migrationsPath, `${second.filename}.ts`))
  out.prune = summary(await migrator.prune())

  fs.writeFileSync(path.join(migrationsPath, '1900000000000-broken.ts'), migration('broken', "throw new Error('boom')\n  "))
  out.upFailing = await attempt(() => migrator.run('up'))
  out.listAfterFailure = summary(await migrator.list())

  await migrator.close()
  out.readyStateAfterClose = migrator.connection.readyState

  out.connectWithoutUri = await attempt(() => Migrator.connect({ migrationsPath }))
  const started = Date.now()
  out.connectRefused = await attempt(() => Migrator.connect({ uri: closedUri, migrationsPath, connectOptions: { serverSelectionTimeoutMS: 1500 } }))
  out.connectRefusedWithin20s = Date.now() - started < 20_000
}

module.exports = async (mod, { uri, closedUri, workDir }) => {
  const { Migrator, Env } = mod
  const out = { exports: Object.keys(mod).sort(), env: { ...Env } }
  const logged = []
  const log = console.log
  console.log = (...args) => logged.push(args.join(' '))
  try {
    await exercise(Migrator, path.join(workDir, 'migrations'), uri, closedUri, out)
  } finally {
    console.log = log
  }
  out.consoleLog = logged
  return out
}
