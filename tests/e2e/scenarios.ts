import fs from 'node:fs'
import path from 'node:path'
import { fixturesDir, PACKAGE_NAME, repoRoot, tree } from './harness'

import type { Observation, Scenario, ScenarioContext } from './harness'

const people = (name: string, failure = ''): string => `import type { Connection } from 'mongoose'

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

const seedThree = (context: ScenarioContext): void => {
  context.write('models/Person.ts', personModel)
  context.write('migrations/1700000000001-add-alice.ts', personMigration)
  context.write('migrations/1700000000002-add-bob.ts', people('bob'))
  context.write('migrations/1700000000003-add-carol.ts', people('carol'))
}

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`

const cliScenarios: Scenario[] = [
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
      const steps = [await cli(['list', '-a', 'true', '-d', uri])]
      write('migrations/1700000000003-later.ts', people('later'))
      steps.push(await cli(['list', '--autosync', 'false', '-d', uri]))
      return { steps, db: await db() }
    },
  },
  {
    name: 'config-ts',
    run: async ({ cli, uri, write, tree, db }) => {
      write('migrate.ts', `export default {\n  uri: '${uri}',\n  collection: 'ts_config',\n  migrationsPath: './ts-migrations',\n  connectOptions: { autoIndex: true },\n}\n`)
      return { steps: [await cli(['create', 'from-ts']), await cli(['list'])], tree: tree(), db: await db() }
    },
  },
  {
    name: 'config-js-esm',
    run: async ({ cli, uri, write, tree, db }) => {
      write('package.json', json({ type: 'module' }))
      write('migrate.js', `export default {\n  uri: '${uri}',\n  collection: 'esm_config',\n  migrationsPath: './js-migrations',\n}\n`)
      return { steps: [await cli(['create', 'from-esm'])], tree: tree(), db: await db() }
    },
  },
  {
    name: 'config-js-cjs',
    run: async ({ cli, uri, write, tree, db }) => {
      write('package.json', json({ type: 'commonjs' }))
      write('migrate.js', `module.exports = {\n  uri: '${uri}',\n  collection: 'cjs_config',\n  migrationsPath: './cjs-migrations',\n}\n`)
      return { steps: [await cli(['create', 'from-cjs'])], tree: tree(), db: await db() }
    },
  },
  {
    name: 'config-json',
    run: async ({ cli, uri, write, tree, db }) => {
      write('migrate.json', json({ uri, collection: 'json_config', migrationsPath: './json-migrations', templatePath: './template.ts', autosync: true }))
      write('template.ts', '// json config template\n')
      return { steps: [await cli(['create', 'from-json'])], tree: tree(), db: await db() }
    },
  },
  {
    name: 'config-path',
    run: async ({ cli, uri, write, db }) => {
      write('conf/custom.json', json({ uri, collection: 'custom_config', migrationsPath: './custom-migrations' }))
      return {
        steps: [await cli(['create', 'by-flag', '-f', './conf/custom.json']), await cli(['create', 'by-long-flag', '--config-path', './conf/custom']), await cli(['create', 'by-env'], { env: { MIGRATE_CONFIG_PATH: './conf/custom' } })],
        db: await db(),
      }
    },
  },
  {
    name: 'config-errors',
    run: async ({ cli, write }) => {
      write('migrate.yaml', 'uri: mongodb://127.0.0.1/never\n')
      write('broken.json', '{ "uri": ')
      const explicit = [await cli(['list', '-f', './migrate.yaml']), await cli(['list', '-f', './missing.json']), await cli(['list', '-f', './broken.json'])]
      write('migrate.json', '{ "uri": ')
      return { steps: [...explicit, await cli(['list'])] }
    },
  },
  {
    name: 'env-files',
    run: async ({ cli, uri, write, db }) => {
      write('.env', `MIGRATE_MONGO_URI=${uri}\nMIGRATE_MONGO_COLLECTION=env_base\nMIGRATE_MIGRATIONS_PATH=./env-migrations\n`)
      const steps = [await cli(['create', 'from-env'])]
      write('.env.local', 'MIGRATE_MONGO_COLLECTION=env_local\n')
      steps.push(await cli(['create', 'from-env-local']))
      steps.push(await cli(['create', 'local-beats-process'], { env: { MIGRATE_MONGO_COLLECTION: 'from_process' } }))
      write('.env.staging', 'MIGRATE_MONGO_COLLECTION=env_staging\n')
      steps.push(await cli(['create', 'from-mode-flag', '--mode', 'staging']))
      write('.env.staging.local', 'MIGRATE_MONGO_COLLECTION=env_staging_local\n')
      steps.push(await cli(['create', 'from-mode-local', '--mode', 'staging']))
      steps.push(await cli(['create', 'from-mode-env'], { env: { MIGRATE_MODE: 'staging' } }))
      return { steps, db: await db() }
    },
  },
  {
    name: 'env-vars',
    run: async ({ cli, uri, write, tree, db }) => {
      write('tpl.ts', '// template from MIGRATE_TEMPLATE_PATH\n')
      write('seed/1700000000001-seeded.ts', people('seeded'))
      return {
        steps: [
          await cli(['create', 'via-env'], { env: { MIGRATE_MONGO_URI: uri, MIGRATE_MIGRATIONS_PATH: './env-migrations', MIGRATE_MONGO_COLLECTION: 'env_collection', MIGRATE_TEMPLATE_PATH: './tpl.ts' } }),
          await cli(['create', 'via-camel-case'], { env: { migrateMongoUri: uri, migrateMigrationsPath: './camel-migrations', migrateMongoCollection: 'camel_collection' } }),
          await cli(['up'], { env: { MIGRATE_MONGO_URI: uri, MIGRATE_MIGRATIONS_PATH: './seed', MIGRATE_AUTOSYNC: 'true' } }),
        ],
        tree: tree(),
        db: await db(),
      }
    },
  },
  {
    name: 'precedence',
    run: async ({ cli, uri, write, db }) => {
      write('migrate.json', json({ uri, collection: 'from_file', migrationsPath: './file-migrations' }))
      return {
        steps: [
          await cli(['create', 'file-wins']),
          await cli(['create', 'env-wins'], { env: { MIGRATE_MONGO_COLLECTION: 'from_env', MIGRATE_MIGRATIONS_PATH: './env-migrations' } }),
          await cli(['create', 'cli-wins', '-c', 'from_cli', '-m', './cli-migrations'], { env: { MIGRATE_MONGO_COLLECTION: 'from_env', MIGRATE_MIGRATIONS_PATH: './env-migrations' } }),
          await cli(['create', 'cli-uri-wins', '-d', uri, '-c', 'from_cli_uri'], { env: { MIGRATE_MONGO_URI: 'mongodb://127.0.0.1:1/never' } }),
        ],
        db: await db(),
      }
    },
  },
  {
    name: 'flags',
    run: async ({ cli, uri, write, tree, db }) => {
      write('templates/custom.ts', '// custom template\nexport async function up(): Promise<void> {}\n')
      return {
        steps: [
          await cli(['create', 'templated', '-d', uri, '-t', './templates/custom.ts', '-m', './nested/deep/migrations', '-c', 'custom_collection']),
          await cli(['create', 'templated-long', '--uri', uri, '--template-path', './templates/custom.ts', '--migrations-path', './nested/deep/migrations', '--collection', 'custom_collection']),
          await cli(['create', 'missing-template', '-d', uri, '-t', './templates/nope.ts']),
        ],
        tree: tree(),
        db: await db(),
      }
    },
  },
  {
    name: 'connection-refused',
    run: async ({ cli, closedUri, write }) => {
      write('migrate.json', json({ uri: closedUri, connectOptions: { serverSelectionTimeoutMS: 1500 } }))
      const started = Date.now()
      const step = await cli(['list'])
      return { steps: [step], within20s: Date.now() - started < 20_000 }
    },
  },
]

const script = async (context: ScenarioContext, fixture: string): Promise<Observation> => {
  for (const file of ['shared.cjs', 'api-scenario.cjs', 'nest-scenario.cjs', fixture]) {
    fs.copyFileSync(path.join(fixturesDir, file), path.join(context.dir, file))
  }
  const resultPath = path.join(context.dir, 'result.json')
  const result = await context.node(fixture, [resultPath, JSON.stringify({ uri: context.uri, closedUri: context.closedUri, workDir: context.dir })])
  const output = fs.existsSync(resultPath) ? (JSON.parse(fs.readFileSync(resultPath, 'utf8')) as unknown) : null
  return { exitCode: result.exitCode, timedOut: result.timedOut, stdout: result.stdout, stderr: result.stderr, result: output, db: await context.db() }
}

const typesScenario: Scenario = {
  name: 'types',
  run: async (context) => {
    const source = fs.readFileSync(path.join(fixturesDir, 'consumer-types.ts'), 'utf8')
    context.write('esm.mts', source)
    context.write('cjs.cts', source)
    const compilerOptions = { module: 'nodenext', moduleResolution: 'nodenext', target: 'es2022', strict: true, noEmit: true, skipLibCheck: true, typeRoots: [path.join(repoRoot, 'node_modules', '@types')], types: ['node'] }
    context.write('tsconfig.json', json({ compilerOptions, files: ['esm.mts', 'cjs.cts'] }))
    const result = await context.node(path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc'), ['-p', 'tsconfig.json'])
    return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr }
  },
}

const manifestScenario: Scenario = {
  name: 'manifest',
  run: async ({ consumer }) => {
    const root = path.join(consumer.dir, 'node_modules', PACKAGE_NAME)
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as Record<string, unknown>
    const fields = ['name', 'version', 'type', 'bin', 'main', 'module', 'types', 'exports', 'typesVersions', 'engines', 'dependencies', 'peerDependencies', 'peerDependenciesMeta']
    const files = Object.keys(tree(root)).filter((file) => !file.endsWith('.map'))
    return { manifest: Object.fromEntries(fields.map((field) => [field, manifest[field]])), files, binLink: fs.realpathSync(consumer.bin) === fs.realpathSync(path.join(root, 'dist', 'cli.js')) }
  },
}

export const scenarios: Scenario[] = [
  ...cliScenarios,
  { name: 'api-esm', run: (context) => script(context, 'api.mjs') },
  { name: 'api-cjs', run: (context) => script(context, 'api.cjs') },
  { name: 'nest-esm', run: (context) => script(context, 'nest.mjs') },
  { name: 'nest-cjs', run: (context) => script(context, 'nest.cjs') },
  typesScenario,
  manifestScenario,
]
