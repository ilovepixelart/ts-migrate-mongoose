import { json, people } from './sources'

import type { Scenario } from '../harness'

// Each option resolves to the first source that sets it: command line, then environment, then config file, then
// its default. Every combination of the three sources runs once, in its own working directory. A source's value
// names the source, so the outcome shows which one won.
export const SOURCES = ['cli', 'env', 'file'] as const
export const present = (mask: number): (typeof SOURCES)[number][] => SOURCES.filter((_, bit) => (mask >> bit) & 1)
const MASKS = [0, 1, 2, 3, 4, 5, 6, 7]

const OPTIONS = {
  collection: { flag: '-c', env: 'MIGRATE_MONGO_COLLECTION', key: 'collection', value: (mask: number, source: string) => `c${String(mask)}_${source}` },
  'migrations-path': { flag: '-m', env: 'MIGRATE_MIGRATIONS_PATH', key: 'migrationsPath', value: (_mask: number, source: string) => `./from-${source}` },
  'template-path': { flag: '-t', env: 'MIGRATE_TEMPLATE_PATH', key: 'templatePath', value: (_mask: number, source: string) => `./template-${source}.ts` },
}

const optionPrecedence = (option: keyof typeof OPTIONS): Scenario => ({
  name: `precedence-${option}`,
  run: async ({ cli, uri, write, tree, db }) => {
    const { flag, env, key, value } = OPTIONS[option]
    const steps = []
    for (const mask of MASKS) {
      const dir = `mask-${String(mask)}`
      const sources = present(mask)
      for (const source of SOURCES) write(`${dir}/template-${source}.ts`, `// template from ${source}\n`)
      if (sources.includes('file')) write(`${dir}/migrate.json`, json({ [key]: value(mask, 'file') }))
      const args = sources.includes('cli') ? [flag, value(mask, 'cli')] : []
      const environment = sources.includes('env') ? { [env]: value(mask, 'env') } : {}
      steps.push(await cli(['create', `mask-${String(mask)}`, '-d', uri, ...args], { env: environment, cwd: dir }))
    }
    return { steps, tree: tree(), db: await db() }
  },
})

// The uri wins the same way, shown by connecting: the source that should win points at the server, every other
// source at a closed port, so the command only succeeds when the right one won.
const uriPrecedence: Scenario = {
  name: 'precedence-uri',
  run: async ({ cli, uri, closedUri, write, db }) => {
    const steps = []
    for (const mask of MASKS) {
      const dir = `mask-${String(mask)}`
      const sources = present(mask)
      const winner = sources[0]
      const uriFor = (source: string) => (source === winner ? uri : closedUri)
      write(`${dir}/migrate.json`, json({ ...(sources.includes('file') ? { uri: uriFor('file') } : {}), collection: `u${String(mask)}`, connectOptions: { serverSelectionTimeoutMS: 1500 } }))
      const args = sources.includes('cli') ? ['-d', uriFor('cli')] : []
      const environment = sources.includes('env') ? { MIGRATE_MONGO_URI: uriFor('env') } : {}
      steps.push(await cli(['create', `mask-${String(mask)}`, ...args], { env: environment, cwd: dir }))
    }
    return { steps, db: await db() }
  },
}

// autosync is a boolean that only shows on a terminal, where it decides whether the import prompt appears. Each
// combination runs twice: the winning source set to true and every other source to false, then the reverse.
const autosyncPrecedence: Scenario = {
  name: 'precedence-autosync',
  run: async ({ tty, uri, write, db }) => {
    const steps = []
    for (const winnerValue of [true, false]) {
      for (const mask of MASKS) {
        const dir = `${String(winnerValue)}-mask-${String(mask)}`
        const sources = present(mask)
        const valueFor = (source: string) => (source === sources[0] ? winnerValue : !winnerValue)
        write(`${dir}/migrations/1700000000001-pending.ts`, people('pending'))
        if (sources.includes('file')) write(`${dir}/migrate.json`, json({ autosync: valueFor('file') }))
        const args = sources.includes('cli') ? ['-a', String(valueFor('cli'))] : []
        const env = sources.includes('env') ? { MIGRATE_AUTOSYNC: String(valueFor('env')) } : {}
        // Enter answers a prompt with nothing selected; without a prompt the keys are never sent.
        steps.push(await tty(['list', '-d', uri, '-c', `${String(winnerValue)}_${String(mask)}`, ...args], ['\r'], { cwd: dir, env }))
      }
    }
    return { steps, db: await db() }
  },
}

// --mode and MIGRATE_MODE pick the .env.<mode> file; MIGRATE_MODE can come from the process or from .env, which never
// overrides the process. Each .env.<mode> file names its mode in the collection it selects.
const modePrecedence: Scenario = {
  name: 'precedence-mode',
  run: async ({ cli, uri, write, db }) => {
    const steps = []
    for (const mask of MASKS) {
      const dir = `mask-${String(mask)}`
      const sources = present(mask)
      for (const source of SOURCES) write(`${dir}/.env.from${source}`, `MIGRATE_MONGO_COLLECTION=mode${String(mask)}_${source}\n`)
      if (sources.includes('file')) write(`${dir}/.env`, 'MIGRATE_MODE=fromfile\n')
      const args = sources.includes('cli') ? ['--mode', 'fromcli'] : []
      const env = sources.includes('env') ? { MIGRATE_MODE: 'fromenv' } : {}
      steps.push(await cli(['create', `mask-${String(mask)}`, '-d', uri, ...args], { env, cwd: dir }))
    }
    return { steps, db: await db() }
  },
}

// -f, MIGRATE_CONFIG_PATH (process, then .env) and the default ./migrate pick the config file; each names itself in
// the collection it sets.
const configPathPrecedence: Scenario = {
  name: 'precedence-config-path',
  run: async ({ cli, uri, write, db }) => {
    const steps = []
    for (const mask of MASKS) {
      const dir = `mask-${String(mask)}`
      const sources = present(mask)
      for (const source of [...SOURCES, 'default']) write(`${dir}/${source === 'default' ? 'migrate' : `conf-${source}`}.json`, json({ uri, collection: `cfg${String(mask)}_${source}` }))
      if (sources.includes('file')) write(`${dir}/.env`, 'MIGRATE_CONFIG_PATH=./conf-file.json\n')
      const args = sources.includes('cli') ? ['-f', './conf-cli.json'] : []
      const env = sources.includes('env') ? { MIGRATE_CONFIG_PATH: './conf-env.json' } : {}
      steps.push(await cli(['create', `mask-${String(mask)}`, ...args], { env, cwd: dir }))
    }
    return { steps, db: await db() }
  },
}

const precedenceScenarios: Scenario[] = [optionPrecedence('collection'), optionPrecedence('migrations-path'), optionPrecedence('template-path'), uriPrecedence, autosyncPrecedence, modePrecedence, configPathPrecedence]

// Where the CLI takes its options from: config files, .env files, the environment and flags.
export const configurationScenarios: Scenario[] = [
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
    // Config file shapes besides a default export, each in its own working directory.
    name: 'config-shapes',
    run: async ({ cli, uri, write, db }) => {
      write('named-exports/migrate.ts', `export const uri = '${uri}'\nexport const collection = 'named_exports'\n`)
      // What tsc emits for `export default { ... }` compiled to CommonJS.
      write('tsc-commonjs/package.json', json({ type: 'commonjs' }))
      write('tsc-commonjs/migrate.js', `'use strict'\nObject.defineProperty(exports, '__esModule', { value: true })\nexports.default = { uri: '${uri}', collection: 'tsc_commonjs' }\n`)
      write('throws-non-error/migrate.ts', "throw 'not an Error'\n")
      write('esm-named-exports/package.json', json({ type: 'module' }))
      write('esm-named-exports/migrate.js', `export const uri = '${uri}'\nexport const collection = 'esm_named_exports'\n`)
      write('default-undefined/migrate.ts', 'export default undefined\n')
      return {
        steps: [
          await cli(['create', 'named-exports'], { cwd: 'named-exports' }),
          await cli(['create', 'tsc-commonjs'], { cwd: 'tsc-commonjs' }),
          await cli(['list', '-f', './migrate.ts'], { cwd: 'throws-non-error' }),
          await cli(['create', 'missing-mode-file', '-d', uri, '--mode', 'absent']),
          await cli(['create', 'esm-named-exports'], { cwd: 'esm-named-exports' }),
          await cli(['create', 'default-undefined', '-d', uri], { cwd: 'default-undefined' }),
        ],
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
    name: 'env-edge-cases',
    run: async ({ cli, uri, write, db }) => {
      write('migrate.json', json({ uri, collection: 'from_file' }))
      write('.env', 'MIGRATE_MONGO_COLLECTION=\n')
      return { steps: [await cli(['create', 'empty-env-value'])], db: await db() }
    },
  },
  {
    // One .env per case, each in its own working directory; the value becomes a collection or a migrations folder.
    name: 'env-quoting',
    run: async ({ cli, uri, write, tree, db }) => {
      const cases: Record<string, string> = {
        'cr-only': 'MIGRATE_MONGO_COLLECTION=cr_only\rMIGRATE_MIGRATIONS_PATH=./cr-path\r',
        'export-spaces': 'export   MIGRATE_MONGO_COLLECTION=exported\n',
        'equals-spaces': 'MIGRATE_MONGO_COLLECTION=   equals_spaced\n',
        'colon-spaces': 'MIGRATE_MONGO_COLLECTION:   colon_spaced\n',
        'single-after-spaces': "MIGRATE_MONGO_COLLECTION=   'single # kept'\n",
        'double-after-spaces': 'MIGRATE_MONGO_COLLECTION=   "double # kept"\n',
        'double-escapes': 'MIGRATE_MIGRATIONS_PATH="./dq\\nline\\rend"\n',
        'single-escapes': "MIGRATE_MIGRATIONS_PATH='./sq\\nline'\n",
        'backtick-escapes': 'MIGRATE_MIGRATIONS_PATH=`./bt\\nline`\n',
        'quote-at-start': 'MIGRATE_MONGO_COLLECTION="mid"post\n',
        'quote-at-end': 'MIGRATE_MIGRATIONS_PATH=./pre"mid"\n',
        'backtick-hash': 'MIGRATE_MIGRATIONS_PATH=`./bt # kept`\n',
        'backtick-after-text': 'MIGRATE_MIGRATIONS_PATH=./pre`a # b`\n',
        'no-final-newline': 'MIGRATE_MONGO_COLLECTION=no_final_newline',
      }
      const steps = []
      for (const [dir, env] of Object.entries(cases)) {
        write(`${dir}/.env`, env)
        steps.push(await cli(['create', dir, '-d', uri], { cwd: dir }))
      }
      return { steps, tree: tree(), db: await db() }
    },
  },
  {
    // An empty value on the command line, in MIGRATE_CONFIG_PATH or as the mode counts as unset: the next source
    // decides. Without a mode no .env.<mode> file is read, not even one named .env.undefined.
    name: 'empty-values',
    run: async ({ cli, uri, write, tree, db }) => {
      write('empty-template-path/tpl.ts', '// template from MIGRATE_TEMPLATE_PATH\n')
      write('empty-mode/.env.staging', 'MIGRATE_MONGO_COLLECTION=from_mode\n')
      write('empty-config-path/migrate.json', json({ collection: 'from_file' }))
      write('no-mode/.env.undefined', 'MIGRATE_MONGO_COLLECTION=from_env_undefined\n')
      const cases: [string, string[], Record<string, string>][] = [
        ['empty-uri', ['--uri', ''], { MIGRATE_MONGO_URI: uri }],
        ['empty-collection', ['-d', uri, '-c', ''], { MIGRATE_MONGO_COLLECTION: 'from_env' }],
        ['empty-migrations-path', ['-d', uri, '-m', ''], { MIGRATE_MIGRATIONS_PATH: './from-env' }],
        ['empty-template-path', ['-d', uri, '-t', ''], { MIGRATE_TEMPLATE_PATH: './tpl.ts' }],
        ['empty-mode', ['-d', uri, '--mode', ''], { MIGRATE_MODE: 'staging' }],
        ['empty-config-path', ['-d', uri, '-f', ''], {}],
        ['empty-config-path-env', ['-d', uri], { MIGRATE_CONFIG_PATH: '' }],
        ['no-mode', ['-d', uri], {}],
      ]
      const steps = []
      for (const [name, args, env] of cases) {
        write(`${name}/.keep`, '')
        steps.push(await cli(['create', name, ...args], { env, cwd: name }))
      }
      return { steps, tree: tree(), db: await db() }
    },
  },
  {
    name: 'env-unreadable',
    run: async ({ cli, uri, write, db }) => {
      write('.env.local/placeholder', 'a directory where .env.local should be\n')
      return { steps: [await cli(['create', 'env-file-is-a-directory', '-d', uri])], db: await db() }
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
  {
    name: 'env-syntax',
    run: async ({ cli, uri, write, tree, db }) => {
      write('tpl.ts', '// template named in a backtick-quoted value\n')
      const lines = ['# a comment line', `export MIGRATE_MONGO_URI=${uri}`, 'MIGRATE_MONGO_COLLECTION="quoted#collection" # an inline comment', "MIGRATE_MIGRATIONS_PATH = './spaced migrations'", 'MIGRATE_TEMPLATE_PATH=`./tpl.ts`', '']
      write('.env', lines.join('\r\n'))
      return {
        steps: [await cli(['create', 'from-dotenv-syntax']), await cli(['create', 'process-beats-dotenv'], { env: { MIGRATE_MONGO_COLLECTION: 'from_process' } })],
        tree: tree(),
        db: await db(),
      }
    },
  },
  ...precedenceScenarios,
]
