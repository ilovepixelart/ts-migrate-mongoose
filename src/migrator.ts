import fs from 'node:fs'
import path from 'node:path'
import chalk from 'chalk'
import inquirer from 'inquirer'
import mongoose from 'mongoose'

import { getMigrationModel } from './model'

import type { Connection, FilterQuery, HydratedDocument, Model } from 'mongoose'
import type IFileMigration from './interfaces/IFileMigration'
import type IMigration from './interfaces/IMigration'
import type IMigrationModule from './interfaces/IMigrationModule'
import type IMigratorOptions from './interfaces/IMigratorOptions'

import { DEFAULT_MIGRATE_AUTOSYNC, DEFAULT_MIGRATE_CLI, DEFAULT_MIGRATE_MIGRATIONS_PATH, DEFAULT_MIGRATE_MONGO_COLLECTION } from './defaults'

import defaultTemplate from './template'

import { register } from '@swc-node/register/register'
register()

export * as IOptions from './interfaces/IOptions'

/**
 * This class is responsible for running migrations
 * @class Migrator
 */
class Migrator {
  readonly migrationModel: Model<IMigration>
  readonly connection: Connection

  private uri?: string
  private template: string
  private migrationsPath: string
  private collection: string
  private autosync: boolean
  private cli: boolean

  private constructor(options: IMigratorOptions) {
    // https://mongoosejs.com/docs/guide.
    mongoose.set('strictQuery', false)

    this.template = this.getTemplate(options.templatePath)
    this.migrationsPath = path.resolve(options.migrationsPath ?? DEFAULT_MIGRATE_MIGRATIONS_PATH)
    this.collection = options.collection ?? DEFAULT_MIGRATE_MONGO_COLLECTION
    this.autosync = options.autosync ?? DEFAULT_MIGRATE_AUTOSYNC
    this.cli = options.cli ?? DEFAULT_MIGRATE_CLI

    this.ensureMigrationsPath()

    if (options.uri) {
      this.uri = options.uri
      this.connection = mongoose.createConnection(this.uri, options.connectOptions)
    } else {
      const message = chalk.red('No mongoose connection or mongo uri provided to migrator')
      throw new Error(message)
    }

    this.migrationModel = getMigrationModel(this.connection, this.collection)
  }

  /**
   * Asynchronously creates a new migrator instance
   * @param options The options to use
   * @returns A promise that resolves to the created migrator
   * @memberof Migrator
   * @static
   * @async
   */
  static async connect(options: IMigratorOptions): Promise<Migrator> {
    const migrator = new Migrator(options)
    await migrator.connected()
    return migrator
  }

  /**
   * Close the underlying connection to mongo
   * @memberof Migrator
   * @async
   */
  async close(): Promise<void> {
    await this.connection.close()
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
  async list(): Promise<HydratedDocument<IMigration>[]> {
    await this.sync()
    const migrations = await this.migrationModel.find().sort({ createdAt: 1 }).exec()
    if (!migrations.length) this.log(chalk.yellow('There are no migrations to list'))
    return migrations.map((migration: HydratedDocument<IMigration>) => {
      this.logMigrationStatus(migration.state, migration.filename)
      return migration
    })
  }

  /**
   * Create a new migration file
   * @param migrationName Name of the migration
   * @returns A promise that resolves to the created migration
   */
  async create(migrationName: string): Promise<HydratedDocument<IMigration>> {
    const existingMigration = await this.migrationModel.findOne({ name: migrationName }).exec()
    if (existingMigration) {
      const message = chalk.red(`There is already a migration with name '${migrationName}' in the database`)
      throw new Error(message)
    }

    await this.sync()
    const now = Date.now()
    const newMigrationFile = `${now.toString()}-${migrationName}.ts`
    fs.writeFileSync(path.join(this.migrationsPath, newMigrationFile), this.template)
    const migrationCreated = await this.migrationModel.create({
      name: migrationName,
      createdAt: now,
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
  async run(direction: 'up' | 'down', migrationName?: string, single = false): Promise<HydratedDocument<IMigration>[]> {
    await this.sync()

    let untilMigration: HydratedDocument<IMigration> | null = null
    const state = direction === 'up' ? 'down' : 'up'
    const key = direction === 'up' ? '$lte' : '$gte'
    const sort = direction === 'up' ? 1 : -1

    if (migrationName) {
      untilMigration = await this.migrationModel.findOne({ name: migrationName }).exec()
    } else {
      untilMigration = await this.migrationModel
        .findOne({ state })
        .sort({ createdAt: single ? sort : (-sort as -1 | 1) })
        .exec()
    }

    if (!untilMigration) {
      if (migrationName) {
        const message = chalk.red(`Could not find migration with name '${migrationName}' in the database`)
        throw new ReferenceError(message)
      }
      return this.noPendingMigrations()
    }

    const query: FilterQuery<IMigration> = {
      createdAt: { [key]: untilMigration.createdAt },
      state,
    }

    const migrationsToRun = []

    if (single) {
      migrationsToRun.push(untilMigration)
    } else {
      const migrations = await this.migrationModel.find(query).sort({ createdAt: sort }).exec()
      migrationsToRun.push(...migrations)
    }

    if (!migrationsToRun.length) {
      return this.noPendingMigrations()
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
  async sync(): Promise<HydratedDocument<IMigration>[]> {
    try {
      const { migrationsInFs } = await this.getMigrations()

      let migrationsToImport = migrationsInFs.filter((file) => !file.existsInDatabase).map((file) => file.filename)

      this.log('Synchronizing database with file system migrations...')
      migrationsToImport = await this.choseMigrations(migrationsToImport, 'The following migrations exist in the migrations folder but not in the database.\nSelect the ones you want to import into the database')

      return this.syncMigrations(migrationsToImport)
    } catch (error) {
      const message = 'Could not synchronize migrations in the migrations folder up to the database'
      if (error instanceof Error) {
        error.message = `${message}\n${error.message}`
      }
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
  async prune(): Promise<HydratedDocument<IMigration>[]> {
    try {
      let migrationsDeleted: HydratedDocument<IMigration>[] = []

      const { migrationsInDb, migrationsInFs } = await this.getMigrations()

      let migrationsToDelete = migrationsInDb.filter((migration) => !migrationsInFs.find((file) => file.filename === migration.filename)).map((migration) => migration.name)

      migrationsToDelete = await this.choseMigrations(migrationsToDelete, 'The following migrations exist in the database but not in the migrations folder.\nSelect the ones you want to remove from the database')

      if (migrationsToDelete.length) {
        migrationsDeleted = await this.migrationModel.find({ name: { $in: migrationsToDelete } }).exec()
        this.log(`Removing migration(s) from database: \n${chalk.cyan(migrationsToDelete.join('\n'))} `)
        await this.migrationModel.deleteMany({ name: { $in: migrationsToDelete } }).exec()
      }

      return migrationsDeleted
    } catch (error) {
      const message = 'Could not prune extraneous migrations from database'
      if (error instanceof Error) {
        error.message = `${message}\n${error.message}`
      }
      throw error
    }
  }

  /**
   * @returns A promise that resolves to the migrations in the database
   * @memberof Migrator
   * @private
   * @async
   */
  private async noPendingMigrations(): Promise<HydratedDocument<IMigration>[]> {
    this.log(chalk.yellow('There are no pending migrations'))
    if (this.cli) {
      this.log('Current migrations status: ')
      await this.list()
    }
    return []
  }

  /**
   * Logs a message to the console if the migrator is running in cli mode or if force is true
   * @param message The string to log
   * @returns void
   * @memberof Migrator
   * @private
   */
  private log(message: string): void {
    if (this.cli) {
      console.log(message)
    }
  }

  /**
   * Logs migration status to the console
   * @param direction The direction of the migration
   * @param filename The filename of the migration
   * @returns void
   * @memberof Migrator
   * @private
   */
  private logMigrationStatus(direction: 'down' | 'up', filename: string): void {
    this.log(`${chalk[direction === 'up' ? 'green' : 'red'](`${direction}:`)} ${filename} `)
  }

  /**
   * Gets template from file system
   * @param templatePath The path to the template
   * @returns The template string
   * @memberof Migrator
   * @private
   */
  private getTemplate(templatePath: string | undefined): string {
    if (templatePath && fs.existsSync(templatePath)) {
      return fs.readFileSync(templatePath, 'utf8')
    }
    return defaultTemplate
  }

  /**
   * Ensures that the migrations path exists
   * @returns void
   * @memberof Migrator
   * @private
   */
  private ensureMigrationsPath(): void {
    if (!fs.existsSync(this.migrationsPath)) {
      fs.mkdirSync(this.migrationsPath, { recursive: true })
    }
  }

  /**
   * Connection status of the migrator
   * @returns A promise that resolves to the connection status
   * @memberof Migrator
   * @private
   * @async
   * @example
   * const migrator = new Migrator({ uri: 'mongodb://localhost:27017' })
   * const connected = await migrator.connected()
   * console.log(connected) // true
   */
  private async connected(): Promise<Connection> {
    return this.connection.asPromise()
  }

  /**
   * Creates a new migration in database to reflect the changes in file system
   * @param migrationName The name of the migration
   * @returns A promise that resolves to the created migrations
   * @memberof Migrator
   * @private
   * @async
   */
  private async syncMigrations(migrationsInFs: string[]): Promise<HydratedDocument<IMigration>[]> {
    const promises = migrationsInFs.map(async (filename) => {
      const filePath = path.join(this.migrationsPath, filename)
      const timestampSeparatorIndex = filename.indexOf('-')
      const timestamp = filename.slice(0, timestampSeparatorIndex)
      const migrationName = filename.slice(timestampSeparatorIndex + 1, filename.lastIndexOf('.'))

      this.log(`Adding migration ${filePath} into database from file system. State is ${chalk.red('down')}`)
      return this.migrationModel.create({
        name: migrationName,
        createdAt: timestamp,
      })
    })

    return Promise.all(promises)
  }

  /**
   * Get migrations in database and in file system at the same time
   * @returns A promise that resolves to the migrations in database and in file system
   * @memberof Migrator
   * @private
   * @async
   */
  private async getMigrations(): Promise<{
    migrationsInDb: IMigration[]
    migrationsInFs: IFileMigration[]
  }> {
    const files = fs.readdirSync(this.migrationsPath)
    const migrationsInDb = await this.migrationModel.find({}).exec()
    const migrationsInFs = files
      .filter((filename) => /^\d{13,}-/.test(filename) && filename.endsWith('.ts'))
      .map((filename) => {
        const [time] = filename.split('-')
        const timestamp = Number.parseInt(time ?? '')
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
   * @private
   * @async
   */
  private async choseMigrations(migrations: string[], message: string): Promise<string[]> {
    if (!this.autosync && migrations.length) {
      const answers = await inquirer.prompt<{ chosen: string[] }>({
        type: 'checkbox',
        message,
        name: 'chosen',
        choices: migrations,
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
   * @private
   * @async
   */
  private async runMigrations(migrationsToRun: HydratedDocument<IMigration>[], direction: 'down' | 'up'): Promise<HydratedDocument<IMigration>[]> {
    const migrationsRan: HydratedDocument<IMigration>[] = []
    for await (const migration of migrationsToRun) {
      const migrationFilePath = path.join(this.migrationsPath, migration.filename)
      const migrationFunctions = (await import(migrationFilePath)) as IMigrationModule

      const migrationFunction = migrationFunctions[direction]
      if (!migrationFunction) {
        const message = chalk.red(`The '${direction}' export is not defined in ${migration.filename}.`)
        throw new Error(message)
      }

      try {
        await migrationFunction()

        this.logMigrationStatus(direction, migration.filename)

        await this.migrationModel
          .where({ name: migration.name })
          .updateMany({ $set: { state: direction } })
          .exec()
        migrationsRan.push(migration)
      } catch (error) {
        const message = `Failed to run migration with name '${migration.name}' due to an error`
        if (error instanceof Error) {
          error.message = `${message}\n${error.message}`
        }
        throw error
      }
    }

    return migrationsRan
  }
}

export default Migrator
