'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { attempt, migration, summary } = require('./shared.cjs')

const exercise = async (Migrator, migrationsPath, uri, closedUri, out, logged) => {
  const migrator = await Migrator.connect({ uri, migrationsPath, autosync: true })
  out.isMigrator = migrator instanceof Migrator
  out.listEmpty = summary(await migrator.list())
  out.modelCollection = migrator.migrationModel.collection.collectionName
  await migrator.migrationModel.init()
  out.modelIndexes = (await migrator.migrationModel.collection.indexes()).map((index) => Object.keys(index.key).join(',')).sort()
  const documents = [{}, { name: 'sideways', state: 'sideways' }, { name: 'up', state: 'up' }, { name: 'down', state: 'down' }]
  out.modelValidation = await Promise.all(documents.map((doc) => attempt(() => new migrator.migrationModel(doc).validate())))
  out.modelDefaultState = new migrator.migrationModel({ name: 'defaulted' }).state

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
  out.modelStates = (await migrator.migrationModel.find({}, { _id: 0, name: 1, state: 1 }).sort({ name: 1 }).lean()).map((doc) => `${doc.name}:${doc.state}`)

  out.upMissing = await attempt(() => migrator.run('up', 'missing'))
  out.upNonString = await attempt(() => migrator.run('up', 42))
  out.upOperator = await attempt(() => migrator.run('up', { $ne: null }))
  out.downOperator = await attempt(() => migrator.run('down', { $gt: '' }))
  out.strictQueryAfterConnect = require('mongoose').get('strictQuery')
  out.createTraversal = await attempt(() => migrator.create('a/../../escaped'))
  out.createDuplicate = await attempt(() => migrator.create('first'))

  fs.writeFileSync(path.join(migrationsPath, '1700000000000-seeded.ts'), migration('seeded'))
  out.sync = summary(await migrator.sync())
  fs.rmSync(path.join(migrationsPath, `${second.filename}.ts`))
  out.prune = summary(await migrator.prune())
  out.pruneNothing = summary(await migrator.prune())

  const verbose = await Migrator.connect({ uri, migrationsPath, autosync: true, cli: true })
  await verbose.list()
  await verbose.close()
  out.cliOptionLog = logged.splice(0)
  process.env.MIGRATE_CLI = 'true'
  const envFlagged = await Migrator.connect({ uri, migrationsPath, autosync: true })
  await envFlagged.list()
  await envFlagged.close()
  delete process.env.MIGRATE_CLI
  out.cliEnvLog = logged.splice(0)

  fs.writeFileSync(path.join(migrationsPath, '1900000000000-broken.ts'), migration('broken', "throw new Error('boom')\n  "))
  out.upFailing = await attempt(() => migrator.run('up'))
  out.listAfterFailure = summary(await migrator.list())

  await migrator.close()
  out.readyStateAfterClose = migrator.connection.readyState

  const defaultCwd = path.join(path.dirname(migrationsPath), 'default-cwd')
  fs.mkdirSync(defaultCwd)
  process.chdir(defaultCwd)
  const defaulted = await Migrator.connect({ uri, collection: 'defaulted', autosync: true })
  await defaulted.close()
  out.defaultMigrationsFolder = fs.readdirSync(defaultCwd)

  const notAFolder = path.join(path.dirname(migrationsPath), 'not-a-folder')
  fs.writeFileSync(notAFolder, 'a file where the migrations folder should be\n')
  const misplaced = await Migrator.connect({ uri, collection: 'misplaced', migrationsPath: notAFolder })
  // The require and import runs work in different folders; keep their observations comparable.
  const relative = (result) => JSON.parse(JSON.stringify(result).replaceAll(path.dirname(migrationsPath), '<work>'))
  out.syncNotAFolder = relative(await attempt(() => misplaced.sync()))
  out.pruneNotAFolder = relative(await attempt(() => misplaced.prune()))
  await misplaced.close()

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
    await exercise(Migrator, path.join(workDir, 'migrations'), uri, closedUri, out, logged)
  } finally {
    console.log = log
  }
  out.consoleLog = logged
  return out
}
