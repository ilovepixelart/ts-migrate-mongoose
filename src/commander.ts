import dotenv from 'dotenv'
import path from 'path'
import chalk from 'chalk'
import { Command } from 'commander'
import Migrator from './migrator'
import { register } from 'ts-node'
import { registerOptions } from './options'

import type IOptions from './interfaces/IOptions'
import type IConfigModule from './interfaces/IConfigModule'

dotenv.config()
register(registerOptions)

export const getConfig = async (options: IOptions): Promise<IOptions> => {
  let fileOptions: IOptions = {}
  if (options.configPath) {
    try {
      const configPath = path.resolve(options.configPath)
      const module = <IConfigModule>(await import(configPath))
      if (module.default) {
        fileOptions = module.default
      }
    } catch (err) {
      fileOptions = {}
    }
  }
  return fileOptions
}

export const getMigrator = async (options: IOptions): Promise<Migrator> => {
  const fileOptions = await getConfig(options)

  const uri = options.uri ||
    process.env.MIGRATE_MONGO_URI ||
    process.env.migrateMongoUri ||
    fileOptions.uri

  const collection = options.collection ||
    process.env.MIGRATE_MONGO_COLLECTION ||
    process.env.migrateMongoCollection ||
    fileOptions.collection

  const migrationsPath = options.migrationsPath ||
    process.env.MIGRATE_MIGRATIONS_PATH ||
    process.env.migrateMigrationsPath ||
    fileOptions.migrationsPath

  const templatePath = options.templatePath ||
    process.env.MIGRATE_TEMPLATE_PATH ||
    process.env.migrateTemplatePath ||
    fileOptions.templatePath

  const autosync = Boolean(options.autosync ||
    process.env.MIGRATE_AUTOSYNC ||
    process.env.migrateAutosync ||
    fileOptions.autosync)

  if (!uri) {
    throw new Error(chalk.red('You need to provide the MongoDB Connection URI to persist migration status.\nUse option --uri / -d to provide the URI.'))
  }

  const migrator = new Migrator({
    migrationsPath,
    templatePath,
    uri,
    collection,
    autosync,
    cli: true
  })

  await migrator.connected()

  return migrator
}

export class Migrate {
  private program: Command
  private migrator: Migrator | undefined
  constructor () {
    this.program = new Command()
    this.program
      .name('migrate')
      .description(chalk.cyan('CLI migration tool for mongoose'))
      .option('-f, --config-path <path>', 'path to the config file', 'migrate')
      .option('-d, --uri <string>', chalk.yellow('mongo connection string'))
      .option('-c, --collection <string>', 'collection name to use for the migrations', 'migrations')
      .option('-a, --autosync <boolean>', 'automatically sync new migrations without prompt', false)
      .option('-m, --migrations-path <path>', 'path to the migration files', './migrations')
      .option('-t, --template-path <path>', 'template file to use when creating a migration')
      .hook('preAction', async () => {
        const opts = this.program.opts<IOptions>()
        this.migrator = await getMigrator(opts)
      })

    this.program
      .command('list')
      .description('list all migrations')
      .action(async () => {
        console.log(chalk.cyan('Listing migrations'))
        await this.migrator?.list()
      })

    this.program
      .command('create <migration-name>')
      .description('create a new migration file')
      .action(async (migrationName: string) => {
        await this.migrator?.create(migrationName)
        console.log('Migration created. Run ' + chalk.cyan(`migrate up ${migrationName}`) + ' to apply the migration')
      })

    this.program
      .command('up [migration-name]')
      .description('run all migrations or a specific migration if name provided')
      .action(async (migrationName: string) => {
        await this.migrator?.run('up', migrationName)
      })

    this.program
      .command('down <migration-name>')
      .description('roll back migrations down to given name')
      .action(async (migrationName: string) => {
        await this.migrator?.run('down', migrationName)
      })

    this.program
      .command('prune')
      .description('delete extraneous migrations from migration folder or database')
      .action(async () => {
        await this.migrator?.prune()
      })
  }

  /**
   * Run the CLI
   * @param exit Whether to exit the process after running the command, defaults to true
   * @returns The parsed options or void if exit = true
   */
  public async run (exit = true): Promise<IOptions | void> {
    return this.program.parseAsync(process.argv)
      .then(async () => {
        await this.migrator?.close()
        if (exit) return process.exit(0)
        return this.program.opts<IOptions>()
      })
      .catch(async (err: Error) => {
        await this.migrator?.close()
        console.error(chalk.red(err.message))
        if (exit) return process.exit(1)
        throw err
      })
  }
}

export const migrate = new Migrate()
