import dotenv from 'dotenv'
import path from 'path'
import colors from 'colors'
import { Command } from 'commander'
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

  const migrationsPath = options.migrationsPath || process.env.MIGRATE_MIGRATIONS_PATH || fileOptions.migrationsPath
  const templatePath = options.templatePath || process.env.MIGRATE_TEMPLATE_PATH || fileOptions.templatePath
  const uri = options.uri || process.env.MIGRATE_MONGO_URI || fileOptions.uri
  const collection = options.collection || process.env.MIGRATE_MONGO_COLLECTION || fileOptions.collection
  const autosync = Boolean(options.autosync || process.env.MIGRATE_AUTOSYNC || fileOptions.autosync)

  if (!uri) {
    throw new Error('You need to provide the Mongo URI Connection string to persist migration status.\nUse option --uri / -u to provide the URI.'.red)
  }

  const migrator = new Migrator({
    migrationsPath,
    templatePath,
    uri,
    collection,
    autosync,
    cli: true
  })

  await migrator.connection.asPromise()

  return migrator
}

export const program = new Command()
let migrator: Migrator

program
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
    const opts = program.opts()
    migrator = await getMigrator(opts)
  })

program
  .command('list')
  .description('List all migrations')
  .action(async function () {
    console.log('Listing migrations'.cyan)
    await migrator.list()
  })

program
  .command('create <migration-name>')
  .description('Creates a new migration file')
  .action(async function (migrationName) {
    await migrator.create(migrationName)
    console.log('Migration created. Run ' + `mongoose-migrate up ${migrationName}`.cyan + ' to apply the migration')
  })

program
  .command('up [migration-name]')
  .description('Run all migrations or a specific migration')
  .action(async function (migrationName) {
    await migrator.run('up', migrationName)
  })

program
  .command('down <migration-name>')
  .description('Rolls back migrations down to given name (if down function was provided)')
  .action(async function (migrationName) {
    await migrator.run('down', migrationName)
  })

program
  .command('prune')
  .description('Allows you to delete extraneous migrations by removing extraneous local migration files/database migrations')
  .action(async function () {
    await migrator.prune()
  })

export const cli = async (): Promise<void> => {
  await program.parseAsync(process.argv).catch((err) => {
    program.error(err.message, { exitCode: 1 })
  })
}
