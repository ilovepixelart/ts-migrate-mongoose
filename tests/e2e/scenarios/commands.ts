import fs from 'node:fs'
import path from 'node:path'
import { json, people, seedRecords, seedThree } from './sources'

import type { Scenario } from '../harness'

// The migrate commands: create, up, down, list, prune and sync, run as a consumer runs them.
export const commandScenarios: Scenario[] = [
  {
    name: 'help',
    run: async ({ cli }) => ({ steps: [await cli([]), await cli(['-h']), await cli(['--help']), await cli(['up', '--help'])] }),
  },
  {
    name: 'version',
    run: async ({ cli }) => ({ steps: [await cli(['-v']), await cli(['--version'])] }),
  },
  {
    name: 'argument-errors',
    run: async ({ cli, uri }) => ({
      steps: [await cli(['list']), await cli(['list', '-s', '-d', uri]), await cli(['list', '--nope']), await cli(['frobnicate']), await cli(['frobnicate', '-d', uri]), await cli(['create', '-d', uri]), await cli(['down', '-d', uri])],
    }),
  },
  {
    name: 'cold-start',
    run: async ({ cli, uri, tree, db }) => ({ steps: [await cli(['up', '-d', uri]), await cli(['list', '-d', uri])], tree: tree(), db: await db() }),
  },
  {
    name: 'create',
    run: async ({ cli, uri, tree, db }) => ({
      steps: [await cli(['create', 'first-migration', '-d', uri]), await cli(['create', 'first-migration', '-d', uri]), await cli(['create', 'a/../../escaped', '-d', uri]), await cli(['create', '../escaped', '-d', uri]), await cli(['create', 'my.migration_v2', '-d', uri]), await cli(['list', '-d', uri])],
      tree: tree(),
      db: await db(),
    }),
  },
  {
    name: 'up-all',
    run: async (context) => {
      seedThree(context)
      const { cli, uri, db } = context
      return { steps: [await cli(['up', '-d', uri]), await cli(['up', '-d', uri])], db: await db() }
    },
  },
  {
    name: 'up-down-to-name',
    run: async (context) => {
      seedThree(context)
      const { cli, uri, db } = context
      return {
        steps: [await cli(['up', 'add-bob', '-d', uri]), await cli(['list', '-d', uri]), await cli(['up', '-d', uri]), await cli(['down', 'add-bob', '-d', uri]), await cli(['list', '-d', uri]), await cli(['down', 'add-alice', '-d', uri])],
        db: await db(),
      }
    },
  },
  {
    name: 'single',
    run: async (context) => {
      seedThree(context)
      const { cli, uri, db } = context
      return {
        steps: [await cli(['up', 'add-bob', '-s', '-d', uri]), await cli(['down', 'add-bob', '--single', '-d', uri]), await cli(['up', '-s', '-d', uri]), await cli(['down', '-s', '-d', uri]), await cli(['list', '-d', uri])],
        db: await db(),
      }
    },
  },
  {
    name: 'missing-migration',
    run: async (context) => {
      const { cli, uri, db, remove } = context
      const steps = [await cli(['up', 'nope', '-d', uri]), await cli(['down', 'nope', '-d', uri]), await cli(['create', 'gone', '-d', uri])]
      const created = fs.readdirSync(path.join(context.dir, 'migrations'))[0] ?? ''
      remove(`migrations/${created}`)
      steps.push(await cli(['up', '-d', uri]))
      return { steps, db: await db() }
    },
  },
  {
    name: 'failing-migration',
    run: async (context) => {
      const { cli, uri, db, write } = context
      write('migrations/1700000000001-add-alice.ts', people('alice'))
      write('migrations/1700000000002-explode.ts', people('never', "throw new Error('boom')\n  "))
      write('migrations/1700000000003-add-carol.ts', people('carol'))
      return { steps: [await cli(['up', '-d', uri]), await cli(['list', '-d', uri])], db: await db() }
    },
  },
  {
    name: 'missing-export',
    run: async (context) => {
      const { cli, uri, db, write } = context
      write('migrations/1700000000001-only-up.ts', 'export async function up(): Promise<void> {}\n')
      return { steps: [await cli(['up', '-d', uri]), await cli(['down', 'only-up', '-d', uri])], db: await db() }
    },
  },
  {
    name: 'js-migrations',
    run: async (context) => {
      const { cli, uri, db, write } = context
      write('package.json', json({ type: 'module' }))
      write('migrations/1700000000001-esm-named.js', "export async function up(connection) {\n  await connection.collection('people').insertOne({ name: 'esm-named' })\n}\n\nexport async function down(connection) {\n  await connection.collection('people').deleteMany({ name: 'esm-named' })\n}\n")
      write('migrations/1700000000002-esm-default.mjs', "export default {\n  async up(connection) {\n    await connection.collection('people').insertOne({ name: 'esm-default' })\n  },\n  async down(connection) {\n    await connection.collection('people').deleteMany({ name: 'esm-default' })\n  },\n}\n")
      write('migrations/1700000000003-commonjs.cjs', "module.exports = {\n  async up(connection) {\n    await connection.collection('people').insertOne({ name: 'commonjs' })\n  },\n  async down(connection) {\n    await connection.collection('people').deleteMany({ name: 'commonjs' })\n  },\n}\n")
      write('migrations/1700000000004-types.d.ts', 'export {}\n')
      const steps = [await cli(['up', '-d', uri])]
      const afterUp = await db()
      steps.push(await cli(['down', 'esm-named', '-d', uri]))
      return { steps, afterUp, afterDown: await db() }
    },
  },
  {
    name: 'prune',
    run: async (context) => {
      const { cli, uri, db, remove } = context
      const steps = [await cli(['create', 'keep', '-d', uri]), await cli(['create', 'drop', '-d', uri])]
      const dropped = fs.readdirSync(path.join(context.dir, 'migrations')).find((file) => file.endsWith('-drop.ts')) ?? ''
      remove(`migrations/${dropped}`)
      steps.push(await cli(['prune', '-d', uri]), await cli(['prune', '-d', uri]), await cli(['list', '-d', uri]))
      return { steps, db: await db() }
    },
  },
  {
    name: 'sync',
    run: async (context) => {
      const { cli, uri, db, write } = context
      write('migrations/1700000000001-seeded.ts', people('seeded'))
      write('migrations/notes.md', '# not a migration\n')
      write('migrations/1700000000002-README.txt', 'not a migration\n')
      write('migrations/old_1700000000003-legacy.ts', people('legacy'))
      const steps = [await cli(['list', '-a', 'true', '-d', uri])]
      write('migrations/1700000000003-later.ts', people('later'))
      steps.push(await cli(['list', '--autosync', 'false', '-d', uri]))
      return { steps, db: await db() }
    },
  },
  {
    name: 'interactive',
    run: async (context) => {
      const { cli, tty, uri, write, remove, db } = context
      // sync() inserts concurrently, and prune lists records in insertion order: import one file per run.
      const steps = []
      write('migrations/1700000000001-first.ts', people('first'))
      steps.push(await cli(['list', '-a', 'true', '-d', uri, '-c', 'pruned']))
      write('migrations/1700000000002-second.ts', people('second'))
      steps.push(await cli(['list', '-a', 'true', '-d', uri, '-c', 'pruned']))
      const sync = (collection: string, keys: string[]) => tty(['list', '-d', uri, '-c', collection], keys)
      steps.push(
        await sync('pick_cursor', [' ', '\r']),
        await sync('pick_after_down', ['\u001b[B', ' ', '\r']),
        await sync('pick_after_up', ['\u001b[A', ' ', '\r']),
        await sync('pick_toggled_off', [' ', ' ', '\r']),
        await sync('pick_all', ['a', '\r']),
        await sync('pick_all_twice', ['a', 'a', '\r']),
        await sync('pick_none', ['\r']),
        await sync('pick_unknown_key', ['x', '#', '\r']),
        await sync('interrupted', ['\u0003']),
      )
      remove('migrations/1700000000001-first.ts')
      remove('migrations/1700000000002-second.ts')
      steps.push(await tty(['prune', '-d', uri, '-c', 'pruned'], ['a', '\r']))
      return { steps, db: await db() }
    },
  },
  {
    name: 'interactive-paging',
    run: async (context) => {
      const { tty, uri, write, db } = context
      for (let index = 1; index <= 18; index++) write(`migrations/${String(1700000000000 + index)}-page-${String(index).padStart(2, '0')}.ts`, people(`page-${String(index)}`))
      // 10 rows leave a page of 6 choices; wrapping up to the last choice scrolls, and 30 rows fit all 18 again.
      // 14 rows fit 10 choices, a window that still holds the cursor without moving it.
      const steps = [await tty(['list', '-d', uri], ['\u001b[A', ' ', '<resize:30>', '\r'], { rows: 10 }), await tty(['list', '-d', uri, '-c', 'grown'], ['\u001b[A', '<resize:14>', '\r'], { rows: 10 })]
      return { steps, db: await db() }
    },
  },
  {
    // 10 rows leave a page of 6 choices. Each run has its own folder of choices and its own collection.
    name: 'interactive-boundaries',
    run: async (context) => {
      const { tty, uri, write, db } = context
      const folder = (name: string, count: number) => {
        for (let index = 1; index <= count; index++) write(`${name}/${String(1700000000000 + index)}-${name}-${String(index).padStart(2, '0')}.ts`, people(`${name}-${String(index)}`))
        return ['list', '-d', uri, '-m', `./${name}`, '-c', name]
      }
      const down = '\u001b[B'
      const up = '\u001b[A'
      const steps = [
        // Exactly a page: no range hint. Ctrl with another key, and c without Ctrl, are unknown keys.
        await tty(folder('exact', 6), ['\u000e', 'c', '\r'], { rows: 10 }),
        // One over a page: the window scrolls when the cursor leaves it, at either edge.
        await tty(folder('over', 7), [down, down, down, down, down, down, up, up, up, up, up, up, '\r'], { rows: 10 }),
        // Nothing new to import: no prompt at all.
        await tty(folder('empty', 0), ['\r'], { rows: 10 }),
        // Selected in reverse: the summary still lists the choices in their order (10 sorts before 2 as text).
        await tty(folder('order', 11), [down, down, down, down, down, down, down, down, down, down, ' ', up, up, up, up, up, up, up, up, ' ', '\r'], { rows: 24 }),
      ]
      return { steps, db: await db() }
    },
  },
  {
    name: 'interactive-signals',
    run: async (context) => {
      const { tty, uri, write, db } = context
      write('migrations/1700000000001-first.ts', people('first'))
      const steps = [await tty(['list', '-d', uri, '-c', 'terminated'], ['<signal:SIGTERM>']), await tty(['list', '-d', uri, '-c', 'hung_up'], ['<signal:SIGHUP>'])]
      return { steps, db: await db() }
    },
  },
  {
    name: 'nothing-pending-up-to-name',
    run: async (context) => {
      seedThree(context)
      const { cli, uri, db } = context
      return { steps: [await cli(['up', 'add-bob', '-d', uri]), await cli(['up', 'add-bob', '-d', uri]), await cli(['down', 'add-carol', '-d', uri])], db: await db() }
    },
  },
  {
    name: 'migrations-path-is-file',
    run: async ({ cli, uri, write, db }) => {
      write('not-a-folder', 'a file where the migrations folder should be\n')
      return { steps: [await cli(['list', '-d', uri, '-m', './not-a-folder']), await cli(['prune', '-d', uri, '-m', './not-a-folder']), await cli(['up', '-d', uri, '-m', './not-a-folder'])], db: await db() }
    },
  },
  {
    name: 'leading-zero-timestamp',
    run: async (context) => {
      const { cli, uri, write, db } = context
      write('migrations/01700000000001-zero.ts', people('zero'))
      return { steps: [await cli(['list', '-d', uri]), await cli(['list', '-d', uri]), await cli(['up', '-d', uri])], db: await db() }
    },
  },
  {
    name: 'alias-imports',
    run: async (context) => {
      const { cli, uri, write, db } = context
      // README: "If you are using alias imports in your project, you can use tsconfig.json paths to resolve them".
      write('tsconfig.json', json({ compilerOptions: { paths: { '@models/*': ['./models/*'] } } }))
      write('models/Person.ts', "import { Schema } from 'mongoose'\n\nexport const PersonSchema = new Schema({ name: { type: String, required: true } })\n")
      write(
        'migrations/1700000000001-aliased.ts',
        "import type { Connection } from 'mongoose'\nimport { PersonSchema } from '@models/Person'\n\nconst Person = (connection: Connection) => connection.models.Person ?? connection.model('Person', PersonSchema, 'people')\n\nexport async function up(connection: Connection): Promise<void> {\n  await Person(connection).create({ name: 'aliased' })\n}\n\nexport async function down(connection: Connection): Promise<void> {\n  await Person(connection).deleteMany({ name: 'aliased' }).exec()\n}\n",
      )
      return { steps: [await cli(['up', '-d', uri])], db: await db() }
    },
  },
  {
    name: 'renamed-to-js',
    run: async (context) => {
      const { cli, uri, write, remove, db } = context
      const steps = [await cli(['create', 'compiled', '-d', uri])]
      const created = fs.readdirSync(path.join(context.dir, 'migrations'))[0] ?? ''
      remove(`migrations/${created}`)
      write(`migrations/${created.replace(/\.ts$/, '.js')}`, "module.exports = {\n  async up(connection) {\n    await connection.collection('people').insertOne({ name: 'compiled' })\n  },\n  async down(connection) {\n    await connection.collection('people').deleteMany({ name: 'compiled' })\n  },\n}\n")
      steps.push(await cli(['up', 'compiled', '-d', uri]))
      const afterUp = await db()
      steps.push(await cli(['down', 'compiled', '-d', uri]))
      return { steps, afterUp, afterDown: await db() }
    },
  },
  {
    name: 'timestamp-collision',
    run: async (context) => {
      const { cli, uri, write, db } = context
      // ObjectIds from different processes do not sort by creation time, so the tie-breaking _ids are fixed here.
      const ids = { beta: '000000000000000000000001', alpha: '000000000000000000000002', gamma: '000000000000000000000003' }
      for (const name of Object.keys(ids)) write(`migrations/1700000000001-${name}.ts`, people(name))
      const seeded = await seedRecords(
        context,
        Object.entries(ids).map(([name, _id]) => ({ _id, name, createdAt: 1700000000001 })),
      )
      const steps = [await cli(['list', '-d', uri]), await cli(['up', '-d', uri]), await cli(['list', '-d', uri]), await cli(['down', 'alpha', '-d', uri])]
      return { seeded, steps, db: await db() }
    },
  },
  {
    name: 'poisoned-record',
    run: async (context) => {
      const { cli, uri, db } = context
      const seeded = await seedRecords(context, [{ name: '../../../../../../../../../../tmp/e2e-poisoned', createdAt: 1700000000000 }])
      return { seeded, steps: [await cli(['up', '-d', uri])], db: await db() }
    },
  },
  {
    name: 'name-validation',
    run: async ({ cli, uri, tree, db }) => {
      const rejected = ['with space', 'name;rm', 'name$var', 'name|pipe', 'name`cmd`', "name'quote", 'foo..bar', '..', 'foo\\bar', 'tilde~home', 'émigré']
      const accepted = ['v1.2.3-release', '__private', 'a'.repeat(100)]
      const steps = []
      for (const name of [...rejected, ...accepted]) steps.push(await cli(['create', name, '-d', uri]))
      return { steps, tree: tree(), db: await db() }
    },
  },
  {
    name: 'strict-query',
    run: async (context) => {
      const { cli, uri, write, db } = context
      write('models/Example.ts', "import { Schema } from 'mongoose'\n\nexport const ExampleSchema = new Schema({ name: { type: String, required: true }, kind: { type: Number, required: true } })\n")
      write(
        'migrations/1700000000001-examples.ts',
        "import type { Connection } from 'mongoose'\nimport { ExampleSchema } from '../models/Example'\n\nconst Example = (connection: Connection) => connection.models.Example ?? connection.model('Example', ExampleSchema, 'examples')\n\nexport async function up(connection: Connection): Promise<void> {\n  await Example(connection).insertMany([{ name: 'one', kind: 1 }, { name: 'two', kind: 1 }, { name: 'three', kind: 2 }])\n}\n\nexport async function down(connection: Connection): Promise<void> {\n  await Example(connection).deleteMany({ removedFromSchema: 'anything' }).exec()\n  await Example(connection).deleteMany({ kind: 1 }).exec()\n}\n",
      )
      const steps = [await cli(['up', '-d', uri])]
      const afterUp = await db()
      steps.push(await cli(['down', 'examples', '-d', uri]))
      return { steps, afterUp, afterDown: await db() }
    },
  },
]
