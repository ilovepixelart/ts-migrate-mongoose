// The laws of the package's public surface, each enforced by contract tests titled `law <id>: ...`.
// tests/e2e/contract/laws.e2e.ts fails when a public subject has no law, when a law names a subject that does not
// exist, or when a law has no test. Subjects come from the artifact itself: cli:<command> and the options in the
// README help (pinned to the binary), env:<key> for the exported Env enum, export:<name> for every runtime export, and
// <Class>.<member> for every public member in the published declarations.

export interface Law {
  id: string
  statement: string
  subjects: string[]
}

export const laws: Law[] = [
  {
    id: 'cli-exit',
    statement: 'Every command exits 0 with nothing on stderr when it succeeds, and 1 with the reason on stderr when it fails.',
    subjects: ['cli:list', 'cli:create', 'cli:up', 'cli:down', 'cli:prune'],
  },
  {
    id: 'cli-args',
    statement: 'An unknown command or option, a missing migration name, --single outside up and down, or no uri is refused with exit 1 and the reason in red.',
    subjects: ['cli:create', 'cli:down', '-s', '--single'],
  },
  {
    id: 'cli-help',
    statement: 'No command, -h, --help and <command> --help print the README help, and -v, --version the installed version, without a database.',
    subjects: ['-h', '--help', '-v', '--version'],
  },
  {
    id: 'option-precedence',
    statement: 'Every option comes from the command line, else the environment (MIGRATE_* or camelCase, set in the process or a .env file), else the config file, else its default: uri, collection, migrations path, template path, autosync, mode and config path.',
    subjects: [
      '-d',
      '--uri',
      '-c',
      '--collection',
      '-m',
      '--migrations-path',
      '-t',
      '--template-path',
      '-a',
      '--autosync',
      '--mode',
      '-f',
      '--config-path',
      'env:MIGRATE_MONGO_URI',
      'env:MIGRATE_MONGO_COLLECTION',
      'env:MIGRATE_MIGRATIONS_PATH',
      'env:MIGRATE_TEMPLATE_PATH',
      'env:MIGRATE_AUTOSYNC',
      'env:MIGRATE_MODE',
      'env:MIGRATE_CONFIG_PATH',
    ],
  },
  {
    id: 'config-file',
    statement: 'Options are read from migrate.ts, migrate.js (ESM or CommonJS) or migrate.json, or the file named by -f, --config-path or MIGRATE_CONFIG_PATH; an explicit file that cannot be used is reported.',
    subjects: ['-f', '--config-path', 'env:MIGRATE_CONFIG_PATH'],
  },
  {
    id: 'env-files',
    statement: '.env, .env.local, .env.<mode> and .env.<mode>.local load in that order of precedence, with dotenv syntax, below the process environment; --mode or MIGRATE_MODE picks the mode.',
    subjects: ['--mode', 'env:MIGRATE_MODE'],
  },
  {
    id: 'autosync',
    statement: 'New migration files are imported without a prompt when autosync is on or stdin is not a terminal.',
    subjects: ['-a', '--autosync', 'env:MIGRATE_AUTOSYNC', 'Migrator.sync'],
  },
  {
    id: 'prompt',
    statement: 'On a terminal, sync and prune ask first and act on exactly the chosen migrations; Ctrl+C exits 130 changing nothing.',
    subjects: ['cli:list', 'cli:prune'],
  },
  {
    id: 'single',
    statement: 'With --single, up and down move one migration: the named one, else the first pending (up) or the last applied (down).',
    subjects: ['-s', '--single', 'Migrator.run'],
  },
  {
    id: 'name-safe',
    statement: 'create accepts exactly the names the proven validator accepts (tests/laws/names); none contains "..", "/" or "\\".',
    subjects: ['cli:create', 'Migrator.create'],
  },
  {
    id: 'create',
    statement: 'create writes <timestamp>-<name>.ts from the template into the migrations folder, creating it, and records the migration down; a name already recorded is refused.',
    subjects: ['cli:create', 'Migrator.create', 'Migrator.migrationModel'],
  },
  {
    id: 'run-model',
    statement: 'run, sync, prune and list agree with the proven model (tests/laws/migrations) on every command of random sequences: the same migrations run, in the same order, and the same states are listed.',
    subjects: ['Migrator.run', 'Migrator.sync', 'Migrator.prune', 'Migrator.list', 'cli:up', 'cli:down', 'cli:list', 'cli:prune'],
  },
  {
    id: 'sync-idempotent',
    statement: 'Syncing again imports nothing.',
    subjects: ['Migrator.sync', 'cli:list'],
  },
  {
    id: 'failure-stops',
    statement: 'A failing migration stops the run: earlier ones stay up, it and later ones stay down, and the error names it and keeps its cause.',
    subjects: ['Migrator.run', 'cli:up'],
  },
  {
    id: 'file-resolution',
    statement: 'A migration runs from its .ts, .js, .mjs or .cjs file with named or default exports; .d.ts and other files are never migrations; a missing file or export is reported by name.',
    subjects: ['cli:up', 'cli:down'],
  },
  {
    id: 'run-input',
    statement: 'run rejects a migration name that is not a string, such as a query operator object, before touching the database.',
    subjects: ['Migrator.run'],
  },
  {
    id: 'alias-imports',
    statement: 'Migrations resolve the path aliases in the project tsconfig.json.',
    subjects: ['cli:up'],
  },
  {
    id: 'path-guard',
    statement: 'A recorded migration whose file would resolve outside the migrations folder is never imported.',
    subjects: ['Migrator.run'],
  },
  {
    id: 'connect',
    statement: 'connect rejects without a uri, and within the server selection timeout when MongoDB is unreachable, leaving nothing open; close releases the connection.',
    subjects: ['Migrator.connect', 'Migrator.close', 'Migrator.connection'],
  },
  {
    id: 'api-logging',
    statement: 'The API writes to the console only when its cli option is set; the MIGRATE_CLI variable does not turn it on.',
    subjects: ['Migrator.connect', 'env:MIGRATE_CLI'],
  },
  {
    id: 'strict-query',
    statement: "Connecting turns mongoose's strictQuery off for the process, so migrations may filter on fields missing from the schema.",
    subjects: ['Migrator.connect'],
  },
  {
    id: 'compatibility',
    statement: 'The Node.js and mongoose ranges the README says are supported are the ones the package declares in engines and peerDependencies.',
    subjects: ['export:Migrator'],
  },
  {
    id: 'module-formats',
    statement: 'require and import give the same exports and behaviour, and the published types check under nodenext for .mts and .cts.',
    subjects: ['export:Env', 'export:Migrator', 'export:MIGRATION_OPTIONS', 'export:MigrationModule', 'export:MigrationService'],
  },
  {
    id: 'nest-lifecycle',
    statement: 'MigrationModule boots by running pending migrations (or onBootstrap with the connected Migrator), exposes it as MigrationService.instance, closes it on shutdown, and refuses to boot when MongoDB is unreachable.',
    subjects: ['MigrationModule.forRoot', 'MigrationService.instance', 'MigrationService.onApplicationBootstrap', 'MigrationService.onApplicationShutdown'],
  },
  {
    id: 'nest-di',
    statement: 'forRootAsync builds the options through useFactory with inject and imports, useClass or useExisting, and refuses to boot without one; isGlobal decides whether other modules can inject MigrationService.',
    subjects: ['MigrationModule.forRootAsync', 'export:MIGRATION_OPTIONS'],
  },
]
