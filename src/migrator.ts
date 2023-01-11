import fs from 'fs'
import inquirer from 'inquirer'
import path from 'path'
import chalk from 'chalk'
import { createConnection } from 'mongoose'

import { getMigrationModel } from './model'

import type { Connection, FilterQuery, HydratedDocument, LeanDocument, Model, Mongoose } from 'mongoose'
import type IMigration from './interfaces/IMigration'
import type IFileMigration from './interfaces/IFileMigration'
import type IMigratorOptions from './interfaces/IMigratorOptions'
import type IMigrationModule from './interfaces/IMigrationModule'

import swcrc from './swcrc'
// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-var-requires
require('@swc/register')(swcrc)

export const defaultTemplate = `/* eslint-disable import/first */
// Orders is important, import your models bellow this two lines, NOT above
import mongoose from 'mongoose'
mongoose.set('strictQuery', false) // https://mongoosejs.com/docs/guide.html#strictQuery

// Import your models here

// Make any changes you need to make to the database here
export async function up () {
  await this.connect(mongoose)
  // Write migration here
}

// Make any changes that UNDO the up function side effects here (if possible)
export async function down () {
  await this.connect(mongoose)
  // Write migration here
}
`

/**
 * This class is responsible for running migrations
 * @class Migrator
 */
class Migrator {
  uri: string | undefined
  mongoose: Mongoose | undefined
  template: string
  migrationsPath: string
  connection: Connection
  collection: string
  autosync: boolean
  cli: boolean
  migrationModel: Model<IMigration>

  constructor (options: IMigratorOptions) {
    this.template = defaultTemplate

    if (options.templatePath && fs.existsSync(options.templatePath)) {
      this.template = fs.readFileSync(options.templatePath, 'utf8')
    }

    this.migrationsPath = path.resolve(options.migrationsPath ?? './migrations')
    this.collection = options.collection ?? 'migrations'
    this.autosync = options.autosync ?? false
    this.cli = options.cli ?? false

    this.ensureMigrationsPath()

    if (options.connection) {
      this.connection = options.connection
    } else if (options.uri) {
      this.uri = options.uri
      this.connection = createConnection(this.uri, { autoCreate: true })
    } else {
      throw new Error(chalk.red('No mongoose connection or mongo uri provided to migrator'))
    }

    this.migrationModel = getMigrationModel(this.connection, this.collection)
  }

  /**
   * Logs a message to the console if the migrator is running in cli mode or if force is true
   * @param logString The string to log
   * @param force If true, the message will be logged even if the migrator is not running in cli mode
   * @returns void
   * @memberof Migrator
   */
  log (logString: string, force = false): void {
    if (force || this.cli) {
      console.log(logString)
    }
  }

  /**
   * Logs migration status to the console
   * @param direction The direction of the migration
   * @param filename The filename of the migration
   * @returns void
   * @memberof Migrator
   */
  logMigrationStatus (direction: 'down' | 'up', filename: string): void {
    this.log(chalk[direction === 'up' ? 'green' : 'red'](`${direction}:`) + ` ${filename} `)
  }

  /**
   * Ensures that the migrations path exists
   * @returns void
   * @memberof Migrator
   */
  ensureMigrationsPath (): void {
    if (!fs.existsSync(this.migrationsPath)) {
      fs.mkdirSync(this.migrationsPath, { recursive: true })
    }
  }

  /**
   * Connection status of the migrator
   * @returns A promise that resolves to the connection status
   * @memberof Migrator
   * @async
   * @example
   * const migrator = new Migrator({ uri: 'mongodb://localhost:27017' })
   * const connected = await migrator.connected()
   * console.log(connected) // true
   */
  async connected (): Promise<Connection> {
    return this.connection.asPromise()
  }

  /**
   * Creates a new migration in database to reflect the changes in file system
   * @param migrationName The name of the migration
   * @returns A promise that resolves to the created migrations
   * @memberof Migrator
   * @async
   */
  async syncMigrations (migrationsInFs: string[]): Promise<IMigration[]> {
    const promises = migrationsInFs.map(async (filename) => {
      const filePath = path.join(this.migrationsPath, filename)
      const timestampSeparatorIndex = filename.indexOf('-')
      const timestamp = filename.slice(0, timestampSeparatorIndex)
      const migrationName = filename.slice(timestampSeparatorIndex + 1, filename.lastIndexOf('.'))

      this.log(`Adding migration ${filePath} into database from file system. State is ` + chalk.red('down'))
      const createdMigration = await this.migrationModel.create({
        name: migrationName,
        createdAt: timestamp
      })
      return createdMigration.toJSON()
    })

    return Promise.all(promises)
  }

  /**
   * Get migrations in database and in file system at the same time
   * @returns A promise that resolves to the migrations in database and in file system
   * @memberof Migrator
   * @async
   */
  async getMigrations (): Promise<{ migrationsInDb: IMigration[], migrationsInFs: IFileMigration[] }> {
    const files = fs.readdirSync(this.migrationsPath)
    const migrationsInDb = await this.migrationModel.find({}).exec()
    const migrationsInFs = files
      .filter((filename) => /^\d{13,}-/.test(filename) && filename.endsWith('.ts'))
      .map((filename) => {
        const timestamp = parseInt(filename.split('-')[0])
        const createdAt = new Date(timestamp)
        const existsInDatabase = migrationsInDb.some((migration) => filename === migration.filename)
        return { createdAt, filename, existsInDatabase }
      })

    return { migrationsInDb, migrationsInFs }
  }

  /**
   * Creates a prompt for the user to chose migrations to run
   * @param migrations The migrations to chose from
   * @param message The message to display to the user
   * @returns A promise that resolves to the chosen migrations or all migrations if autosync is true
   * @memberof Migrator
   * @async
   */
  async choseMigrations (migrations: string[], message: string): Promise<string[]> {
    if (!this.autosync && migrations.length) {
      const answers = await inquirer.prompt<{ chosen: string[] }>({
        type: 'checkbox',
        message,
        name: 'chosen',
        choices: migrations
      })
      return answers.chosen
    }
    return migrations
  }

  /**
   * Run migrations in a given direction
   * @param migrationsToRun The migrations to run
   * @param direction The direction of the migrations
   * @returns A promise that resolves to the ran migrations
   * @memberof Migrator
   * @async
   */
  async runMigrations (migrationsToRun: HydratedDocument<IMigration>[], direction: 'down' | 'up'): Promise<LeanDocument<IMigration>[]> {
    const migrationsRan: LeanDocument<IMigration>[] = []
    const connect = async (mongoose: Mongoose): Promise<void> => {
      if (this.cli && this.uri && mongoose.connection.readyState !== 1) {
        await mongoose.connect(this.uri)
        this.mongoose = mongoose
      }
    }
    for await (const migration of migrationsToRun) {
      const migrationFilePath = path.join(this.migrationsPath, migration.filename)
      const migrationFunctions = await import(migrationFilePath) as IMigrationModule

      const migrationFunction = migrationFunctions[direction]
      if (!migrationFunction) {
        throw new Error(chalk.red(`The '${direction}' export is not defined in ${migration.filename}.`))
      }

      try {
        await migrationFunction.apply({
          connect: (mongoose: Mongoose) => connect(mongoose)
        })

        this.logMigrationStatus(direction, migration.filename)

        await this.migrationModel.where({ name: migration.name }).updateMany({ $set: { state: direction } }).exec()
        migrationsRan.push(migration.toJSON())
      } catch (err: unknown) {
        this.log(chalk.red(`Failed to run migration ${migration.name} due to an error`))
        this.log(chalk.red('Not continuing. Make sure your data is in consistent state'))
        throw err instanceof (Error) ? err : new Error(err as string)
      }
    }

    return migrationsRan
  }

  /**
   * Close the underlying connection to mongo
   * @memberof Migrator
   * @async
   */
  async close (): Promise<void> {
    await this.connection.close()
    if (this.mongoose) {
      await this.mongoose.disconnect()
    }
  }

  /**
   * Create a new migration file
   * @param migrationName Name of the migration
   * @returns A promise that resolves to the created migration
   */
  async create (migrationName: string): Promise<HydratedDocument<IMigration>> {
    await this.connected()
    const existingMigration = await this.migrationModel.findOne({ name: migrationName }).exec()
    if (existingMigration) {
      throw new Error(chalk.red(`There is already a migration with name '${migrationName}' in the database`))
    }

    await this.sync()
    const now = Date.now()
    const newMigrationFile = `${now}-${migrationName}.ts`
    fs.writeFileSync(path.join(this.migrationsPath, newMigrationFile), this.template)
    const migrationCreated = await this.migrationModel.create({
      name: migrationName,
      createdAt: now
    })
    this.log(`Created migration ${migrationName} in ${this.migrationsPath}`)
    return migrationCreated
  }

  /**
   * Runs migrations up to or down to a given migration name
   * @param direction Direction to run the migrations
   * @param migrationName Name of the migration to run to
   * @returns A promise that resolves to the ran migrations
   */
  async run (direction: 'down' | 'up' = 'up', migrationName?: string): Promise<LeanDocument<IMigration>[]> {
    await this.sync()

    const untilMigration = migrationName
      ? await this.migrationModel.findOne({ name: migrationName }).exec()
      : await this.migrationModel.findOne().sort({ createdAt: direction === 'up' ? -1 : 1 }).exec()

    if (!untilMigration) {
      if (migrationName) throw new ReferenceError('Could not find that migration in the database')
      else throw new Error('There are no pending migrations')
    }

    let query: FilterQuery<IMigration> = {
      createdAt: { $lte: untilMigration.createdAt },
      state: 'down'
    }

    if (direction === 'down') {
      query = {
        createdAt: { $gte: untilMigration.createdAt },
        state: 'up'
      }
    }

    const sortDirection = direction === 'up' ? 1 : -1
    const migrationsToRun = await this.migrationModel.find(query).sort({ createdAt: sortDirection }).exec()

    if (!migrationsToRun.length && this.cli) {
      this.log(chalk.yellow('There are no pending migrations'))
      this.log('Current migrations status: ')
      await this.list()
    }

    const migrationsRan = await this.runMigrations(migrationsToRun, direction)

    if (migrationsToRun.length === migrationsRan.length && migrationsRan.length > 0) {
      this.log(chalk.green('All migrations finished successfully'))
    }
    return migrationsRan
  }

  /**
   * Looks at the file system migrations and imports any migrations that are
   * on the file system but missing in the database into the database
   *
   * This functionality is opposite of prune()
   * @returns A promise that resolves to the imported migrations
   */
  async sync (): Promise<LeanDocument<IMigration>[]> {
    await this.connected()
    try {
      const { migrationsInFs } = await this.getMigrations()

      let migrationsToImport = migrationsInFs
        .filter((f) => !f.existsInDatabase)
        .map((f) => f.filename)

      this.log('Synchronizing database with file system migrations...')
      migrationsToImport = await this.choseMigrations(migrationsToImport, 'The following migrations exist in the migrations folder but not in the database.\nSelect the ones you want to import into the database')

      return this.syncMigrations(migrationsToImport)
    } catch (error) {
      this.log(chalk.red('Could not synchronize migrations in the migrations folder up to the database'))
      throw error
    }
  }

  /**
   * Removes files in migration directory which don't exist in database.
   * This is useful when you want to remove old migrations from the file system
   * And then remove them from the database using prune()
   *
   * This functionality is opposite of sync().
   * @returns A promise that resolves to the deleted migrations
   */
  async prune (): Promise<LeanDocument<IMigration>[]> {
    await this.connected()
    try {
      const { migrationsInDb, migrationsInFs } = await this.getMigrations()

      let migrationsToDelete = migrationsInDb
        .filter((m) => !migrationsInFs.find((f) => f.filename === m.filename))
        .map((m) => m.name)

      migrationsToDelete = await this.choseMigrations(migrationsToDelete, 'The following migrations exist in the database but not in the migrations folder.\nSelect the ones you want to remove from the file system')

      const migrationsToDeleteDocs = await this.migrationModel.find({ name: { $in: migrationsToDelete } }).lean().exec()

      if (migrationsToDelete.length) {
        this.log(`Removing migration(s) from database: \n${chalk.cyan(migrationsToDelete.join('\n'))} `)
        await this.migrationModel.deleteMany({ name: { $in: migrationsToDelete } }).exec()
      }

      return migrationsToDeleteDocs
    } catch (error) {
      this.log(chalk.red('Could not prune extraneous migrations from database'))
      throw error
    }
  }

  /**
   * Lists all migrations in the database and their status
   * @returns A promise that resolves to the migrations
   * @example
   *   [
   *    { name: 'my-migration', filename: '149213223424_my-migration.ts', state: 'up' },
   *    { name: 'add-cows', filename: '149213223453_add-cows.ts', state: 'down' }
   *   ]
   */
  async list (): Promise<LeanDocument<IMigration>[]> {
    await this.sync()
    const migrations = await this.migrationModel.find().sort({ createdAt: 1 }).exec()
    if (!migrations.length) this.log(chalk.yellow('There are no migrations to list'))
    return migrations.map((migration: HydratedDocument<IMigration>) => {
      this.logMigrationStatus(migration.state, migration.filename)
      return migration.toJSON()
    })
  }
}

export default Migrator
