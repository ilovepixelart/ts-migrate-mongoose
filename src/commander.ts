import dotenv from 'dotenv'
import path from 'path'
import colors from 'colors'
import { Command, OptionValues } from 'commander'
import Migrator from './migrator'
import { register } from 'ts-node'
import { registerOptions } from './options'
import IOptions from './interfaces/IOptions'

dotenv.config()
colors.enable()
register(registerOptions)

export const getMigrator = async (options: IOptions): Promise<Migrator> => {
  let fileOptions: IOptions = {}
  if (options.configPath) {
    try {
      const configPath = path.resolve(options.configPath)
      fileOptions = (await import(configPath)).default
    } catch (err) {
      fileOptions = {}
    }
  }

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
    throw new Error('You need to provide the MongoDB Connection URI to persist migration status.\nUse option --uri / -d to provide the URI.'.red)
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
  private migrator: Migrator
  constructor (public exit: boolean = true) {
    this.exit = exit
    this.program = new Command()
    this.program
      .name('migrate')
      .description('A cli based migration tool for mongoose')
      .option('-f, --config-path <path>', 'Path to the config file', 'migrate')
      .option('-d, --uri <string>', 'MongoDB connection string URI')
      .option('-c, --collection <string>', 'The collection to use for the migrations', 'migrations')
      .option('-a, --autosync <boolean>', 'Automatically add new migrations in the migrations folder to the database instead of asking interactively', false)
      .option('-m, --migrations-path <path>', 'The path to the migration files', './migrations')
      .option('-t, --template-path <path>', 'The template file to use when creating a migration')
      .option('-cd, --change-dir <path>', 'Change current working directory before running anything')
      .hook('preAction', async () => {
        const opts = this.program.opts()
        this.migrator = await getMigrator(opts)
      })

    this.program
      .command('list')
      .description('List all migrations')
      .action(async () => {
        console.log('Listing migrations'.cyan)
        await this.migrator.list()
      })

    this.program
      .command('create <migration-name>')
      .description('Creates a new migration file')
      .action(async (migrationName) => {
        await this.migrator.create(migrationName)
        console.log('Migration created. Run ' + `migrate up ${migrationName}`.cyan + ' to apply the migration')
      })

    this.program
      .command('up [migration-name]')
      .description('Run all migrations or a specific migration')
      .action(async (migrationName) => {
        await this.migrator.run('up', migrationName)
      })

    this.program
      .command('down <migration-name>')
      .description('Rolls back migrations down to given name (if down function was provided)')
      .action(async (migrationName) => {
        await this.migrator.run('down', migrationName)
      })

    this.program
      .command('prune')
      .description('Allows you to delete extraneous migrations by removing extraneous local migration files/database migrations')
      .action(async () => {
        await this.migrator.prune()
      })
  }

  public async run (): Promise<void | OptionValues> {
    return this.program.parseAsync(process.argv)
      .then(async () => {
        await this.migrator.close()
        if (this.exit) process.exit(0)
        return this.program.opts()
      })
      .catch((err) => {
        console.error(err.message.red)
        if (this.exit) process.exit(1)
        throw err
      })
  }
}

export const migrate = new Migrate()
