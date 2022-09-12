import path from 'path'
import dotenv from 'dotenv'
import colors from 'colors'
import { register } from 'ts-node'
import yargs, { CommandModule } from 'yargs'
import { hideBin } from 'yargs/helpers'

import IArgs from './interfaces/IArgs'
import IConfiguration from './interfaces/IConfig'

import { registerOptions } from './options'
import Migrator from './migrator'

dotenv.config()
colors.enable()
register(registerOptions)

export const getMigrator = async (args: IArgs): Promise<Migrator> => {
  if (!args.d && !args.connectionString) {
    console.error('You need to provide the Mongo URI to persist migration status.\nUse option --connectionString / -d to provide the URI.'.red)
    process.exit(1)
  }

  const migrator = new Migrator({
    migrationsPath: path.resolve(args.md),
    templatePath: args.t,
    connectionString: args.d,
    collection: args.collection,
    autosync: args.autosync,
    cli: true
  })

  await migrator.connection.asPromise()
  if (migrator.connection.readyState === 1) {
    colors.green('Connected to MongoDB')
  }

  return migrator
}

export const listCmd: CommandModule = {
  command: 'list',
  aliases: ['ls'],
  describe: 'Lists all migrations and their current state.',
  handler: async (args: IArgs) => {
    const migrator = await getMigrator(args)
    await migrator.list()
  }
}

export const createCmd: CommandModule = {
  command: 'create <migration-name>',
  aliases: ['touch'],
  describe: 'Creates a new migration file.',
  builder: (yargs) => yargs.positional('migration-name', {
    describe: 'The name of the migration to create',
    type: 'string'
  }),
  handler: async (args: IArgs) => {
    const migrator = await getMigrator(args)
    await migrator.create(args.migrationName)
    console.log('Migration created. Run ' + `mongoose-migrate up ${args.migrationName}`.cyan + ' to apply the migration.')
  }
}

export const upCmd: CommandModule = {
  command: 'up [migration-name]',
  describe: 'Migrates all the migration files that have not yet been run in chronological order. ' +
    'Not including [migration-name] will run up on all migrations that are in a down state.',
  builder: (yargs) => yargs.positional('migration-name', {
    describe: 'The name of the migration to create',
    type: 'string'
  }),
  handler: async (args: IArgs) => {
    const migrator = await getMigrator(args)
    await migrator.run('up', args.migrationName)
  }
}

export const downCmd: CommandModule = {
  command: 'down <migration-name>',
  describe: 'Rolls back migrations down to given name (if down function was provided)',
  builder: (yargs) => yargs.positional('migration-name', {
    describe: 'The name of the migration to create',
    type: 'string'
  }),
  handler: async (args: IArgs) => {
    const migrator = await getMigrator(args)
    await migrator.run('down', args.migrationName)
  }
}

export const pruneCmd: CommandModule = {
  command: 'prune',
  describe: 'Allows you to delete extraneous migrations by removing extraneous local migration files/database migrations.',
  handler: async (args: IArgs) => {
    const migrator = await getMigrator(args)
    await migrator.prune()
  }
}

export const cli = async () => {
  await yargs(hideBin(process.argv)).usage('Usage: migrate -d <mongo-uri> [[create|up|down <migration-name>]|list] [optional options]')
    .default('config', 'migrate')
    .config('config', 'filepath to an options configuration json file', (pathToConfigFile: string) => {
      let options: IConfiguration

      try {
        options = require(path.resolve(pathToConfigFile))
      } catch (err) {
        options = {}
      }

      const config: IConfiguration = {
        connectionString: process.env.MIGRATE_CONNECTION_STRING ||
          process.env.migrateConnectionString ||
          options.connectionString ||
          null,
        templatePath: process.env.MIGRATE_TEMPLATE_PATH ||
          process.env.migrateTemplatePath ||
          options.templatePath ||
          null,
        migrationsPath: process.env.MIGRATE_MIGRATIONS_PATH ||
          process.env.migrateMigrationsPath ||
          options.migrationsPath ||
          'migrations',
        collection: process.env.MIGRATE_COLLECTION ||
          process.env.migrateCollection ||
          options.collection ||
          'migrations',
        autosync: Boolean(process.env.MIGRATE_AUTOSYNC) ||
          Boolean(process.env.migrateAutosync) ||
          options.autosync ||
          false
      }

      return {
        d: config.connectionString,
        t: config.templatePath,
        md: config.migrationsPath,
        collection: config.collection,
        autosync: config.autosync
      }
    })
    .command(listCmd).example('migrate list'.cyan, 'Lists all migrations and their current state.')
    .command(createCmd).example('migrate create add_users'.cyan, 'Creates a new migration file.')
    .command(upCmd).example('migrate up add_user'.cyan, 'Runs up on the add_user migration.')
    .command(downCmd).example('migrate down delete_names'.cyan, 'Runs down on the delete_names migration.')
    .command(pruneCmd).example('migrate prune'.cyan, 'Deletes extraneous migrations.')
    .option('collection', {
      description: 'The collection to use for the migrations',
      type: 'string',
      default: 'migrations',
      nargs: 1
    })
    .option('d', {
      demand: true,
      alias: 'connectionString',
      type: 'string',
      description: 'The URI of the database connection'.yellow,
      nargs: 1
    })
    .option('md', {
      normalize: true,
      alias: 'migrations-dir',
      description: 'The path to the migration files',
      default: './migrations',
      nargs: 1
    })
    .option('t', {
      normalize: true,
      alias: 'template-file',
      description: 'The template file to use when creating a migration',
      type: 'string',
      nargs: 1
    })
    .option('autosync', {
      type: 'boolean',
      description: 'Automatically add new migrations in the migrations folder to the database instead of asking interactively'
    })
    .option('c', {
      normalize: true,
      alias: 'change-dir',
      description: 'Change current working directory before running anything',
      type: 'string',
      nargs: 1
    })
    .help('h').alias('h', 'help')
    .demandCommand()
    .parse()

  process.exit(0)
}
