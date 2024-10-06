import path from 'node:path'
import chalk from 'chalk'
import { Command } from 'commander'
import { config } from 'dotenv'
import Migrator from './migrator'

import type IConfigModule from './interfaces/IConfigModule'
import type IMigratorOptions from './interfaces/IMigratorOptions'
import type IOptions from './interfaces/IOptions'

import { DEFAULT_MIGRATE_AUTOSYNC, DEFAULT_MIGRATE_CONFIG_PATH, DEFAULT_MIGRATE_MIGRATIONS_PATH, DEFAULT_MIGRATE_MONGO_COLLECTION } from './defaults'

import { register } from '@swc-node/register/register'
register()

/**
 * Get the options from the config file
 * @param configPath The options passed to the CLI
 * @returns The options from the config file
 */
export const getConfig = async (configPath: string): Promise<IOptions> => {
  let fileOptions: IOptions = {}
  if (configPath) {
    try {
      const file = path.resolve(configPath)
      const module = (await import(file)) as IConfigModule
      // In case of ESM module, default is nested twice
      const esm = module.default as IConfigModule | undefined
      if (esm?.default) {
        fileOptions = esm.default ?? {}
      } else {
        fileOptions = module.default ?? {}
      }
    } catch {
      fileOptions = {}
    }
  }
  return fileOptions
}

/**
 * Get the migrator instance
 * @param options The options passed to the CLI
 * @returns The migrator instance
 * @throws Error if the uri is not provided in the config file, environment or CLI
 */
export const getMigrator = async (options: IOptions): Promise<Migrator> => {
  config({ path: '.env' })
  config({ path: '.env.local', override: true })

  const mode = options.mode ?? process.env.MIGRATE_MODE ?? process.env.migrateMode

  if (mode) {
    config({ path: `.env.${mode}`, override: true })
    config({ path: `.env.${mode}.local`, override: true })
  }

  const configPath = options.configPath ?? process.env.MIGRATE_CONFIG_PATH ?? process.env.migrateConfigPath ?? DEFAULT_MIGRATE_CONFIG_PATH

  const fileOptions = await getConfig(configPath)

  const uri = options.uri ?? process.env.MIGRATE_MONGO_URI ?? process.env.migrateMongoUri ?? fileOptions.uri
  // no default value always required

  // Connect options can be only provided in the config file for cli usage
  const connectOptions = fileOptions.connectOptions

  const collection = options.collection ?? process.env.MIGRATE_MONGO_COLLECTION ?? process.env.migrateMongoCollection ?? fileOptions.collection ?? DEFAULT_MIGRATE_MONGO_COLLECTION

  const migrationsPath = options.migrationsPath ?? process.env.MIGRATE_MIGRATIONS_PATH ?? process.env.migrateMigrationsPath ?? fileOptions.migrationsPath ?? DEFAULT_MIGRATE_MIGRATIONS_PATH

  const templatePath = options.templatePath ?? process.env.MIGRATE_TEMPLATE_PATH ?? process.env.migrateTemplatePath ?? fileOptions.templatePath
  // can be empty then we use default template

  const autosync = Boolean(options.autosync ?? process.env.MIGRATE_AUTOSYNC ?? process.env.migrateAutosync ?? fileOptions.autosync ?? DEFAULT_MIGRATE_AUTOSYNC)

  if (!uri) {
    const message = chalk.red('You need to provide the MongoDB Connection URI to persist migration status.\nUse option --uri / -d to provide the URI.')
    throw new Error(message)
  }

  const migratorOptions: IMigratorOptions = {
    migrationsPath,
    uri,
    collection,
    autosync,
    cli: true,
  }

  if (templatePath) {
    migratorOptions.templatePath = templatePath
  }

  if (connectOptions) {
    migratorOptions.connectOptions = connectOptions
  }

  return Migrator.connect(migratorOptions)
}

/**
 * This class is responsible for running migrations in the CLI
 * @class Migrate
 */
export class Migrate {
  private program: Command
  private migrator!: Migrator

  constructor() {
    this.program = new Command()

    this.program
      .name('migrate')
      .description(chalk.cyan('CLI migration tool for mongoose'))
      .option('-f, --config-path <path>', 'path to the config file')
      .option('-d, --uri <string>', chalk.yellow('mongo connection string'))
      .option('-c, --collection <string>', 'collection name to use for the migrations')
      .option('-a, --autosync <boolean>', 'automatically sync new migrations without prompt')
      .option('-m, --migrations-path <path>', 'path to the migration files')
      .option('-t, --template-path <path>', 'template file to use when creating a migration')
      .option('--mode <string>', 'environment mode to use .env.[mode] file')
      .hook('preAction', async () => {
        const opts = this.program.opts<IOptions>()
        this.migrator = await getMigrator(opts)
      })

    this.program
      .command('list')
      .description('list all migrations')
      .action(async () => {
        console.log(chalk.cyan('Listing migrations'))
        await this.migrator.list()
      })

    this.program
      .command('create <migration-name>')
      .description('create a new migration file')
      .action(async (migrationName: string) => {
        await this.migrator.create(migrationName)
        console.log(`Migration created. Run ${chalk.cyan(`migrate up ${migrationName}`)} to apply the migration`)
      })

    this.program
      .command('up [migration-name]')
      .description('run all migrations or a specific migration if name provided')
      .option('-s, --single', 'run single migration', false)
      .action(async (migrationName?: string, options?: { single: boolean }) => {
        await this.migrator.run('up', migrationName, options?.single)
      })

    this.program
      .command('down <migration-name>')
      .description('roll back migrations down to given name')
      .option('-s, --single', 'run single migration', false)
      .action(async (migrationName?: string, options?: { single: boolean }) => {
        await this.migrator.run('down', migrationName, options?.single)
      })

    this.program
      .command('prune')
      .description('delete extraneous migrations from migration folder or database')
      .action(async () => {
        await this.migrator.prune()
      })
  }

  /**
   * Finish the CLI
   * @param error The error to log
   * @returns The parsed console arguments
   * @throws Error if error is provided
   */
  public async finish(exit: boolean, error?: Error): Promise<IOptions> {
    if (this.migrator instanceof Migrator) {
      await this.migrator.close()
    }

    if (error) {
      console.error(chalk.red(error.message))
      if (exit) process.exit(1)
      throw error
    }

    if (exit) process.exit(0)

    return this.program.opts<IOptions>()
  }

  /**
   * Run the CLI
   * @param exit Whether to exit the process after running the command, defaults to true
   * @returns The parsed options or void if exit is true
   */
  public async run(exit = true): Promise<IOptions> {
    return this.program
      .parseAsync(process.argv)
      .then(() => {
        return this.finish(exit)
      })
      .catch((error: unknown) => {
        return this.finish(exit, error instanceof Error ? error : new Error('An unknown error occurred'))
      })
  }
}

export const migrate = new Migrate()
