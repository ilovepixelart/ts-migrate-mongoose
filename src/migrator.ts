import fs from 'fs'
import inquirer from 'inquirer'
import path from 'path'
import chalk from 'chalk'
import mongoose from 'mongoose'

import { getMigrationModel } from './model'

import type { Connection, FilterQuery, HydratedDocument, LeanDocument, Model } from 'mongoose'
import type IMigration from './interfaces/IMigration'
import type IFileMigration from './interfaces/IFileMigration'
import type IMigratorOptions from './interfaces/IMigratorOptions'
import type IMigrationModule from './interfaces/IMigrationModule'

import {
  DEFAULT_MIGRATE_AUTOSYNC,
  DEFAULT_MIGRATE_CLI,
  DEFAULT_MIGRATE_MIGRATIONS_PATH,
  DEFAULT_MIGRATE_MONGO_COLLECTION
} from './defaults'

import swcrc from './swcrc'
// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-var-requires
require('@swc/register')(swcrc)

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

  private constructor (options: IMigratorOptions) {
    // https://mongoosejs.com/docs/guide.
    mongoose.set('strictQuery', false)

    this.template = this.getTemplate(options.templatePath)
    this.migrationsPath = path.resolve(options.migrationsPath ?? DEFAULT_MIGRATE_MIGRATIONS_PATH)
    this.collection = options.collection ?? DEFAULT_MIGRATE_MONGO_COLLECTION
    this.autosync = options.autosync ?? DEFAULT_MIGRATE_AUTOSYNC

    this.ensureMigrationsPath()

    if (options.uri) {
      this.uri = options.uri
      this.connection = mongoose.createConnection(this.uri, options.connectOptions)
    } else {
      throw new Error(chalk.red('No mongoose connection or mongo uri provided to migrator'))
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
  static async connect (options: IMigratorOptions): Promise<Migrator> {
    const migrator = new Migrator(options)
    await migrator.connected()
    return migrator
  }

  /**
   * Close the underlying connection to mongo
   * @memberof Migrator
   * @async
   */
  async close (): Promise<void> {
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
  async list (): Promise<LeanDocument<IMigration>[]> {
    await this.sync()
    const migrations = await this.migrationModel.find().sort({ createdAt: 1 }).exec()
    if (!migrations.length) console.log(chalk.yellow('There are no migrations to list'))
    return migrations.map((migration: HydratedDocument<IMigration>) => {
      this.logMigrationStatus(migration.state, migration.filename)
      return migration.toJSON()
    })
  }

  /**
   * Create a new migration file
   * @param migrationName Name of the migration
   * @returns A promise that resolves to the created migration
   */
  async create (migrationName: string): Promise<HydratedDocument<IMigration>> {
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
    console.log(`Created migration ${migrationName} in ${this.migrationsPath}`)
    return migrationCreated
  }

  /**
   * Runs migrations up to or down to a given migration name
   * @param direction Direction to run the migrations
   * @param migrationName Name of the migration to run to
   * @returns A promise that resolves to the ran migrations
   */
  async run (direction: 'down' | 'up', migrationName?: string): Promise<LeanDocument<IMigration>[]> {
    await this.sync()

    const untilMigration = migrationName
      ? await this.migrationModel.findOne({ name: migrationName }).exec()
      : await this.migrationModel.findOne().sort({ createdAt: direction === 'up' ? -1 : 1 }).exec()

    if (!untilMigration) {
      if (migrationName) throw new ReferenceError('Could not find that migration in the database')
      return this.noPendingMigrations()
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

    if (!migrationsToRun.length) {
      return this.noPendingMigrations()
    }

    const migrationsRan = await this.runMigrations(migrationsToRun, direction)

    if (migrationsToRun.length === migrationsRan.length && migrationsRan.length > 0) {
      console.log(chalk.green('All migrations finished successfully'))
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
    try {
      const { migrationsInFs } = await this.getMigrations()

      let migrationsToImport = migrationsInFs
        .filter((file) => !file.existsInDatabase)
        .map((file) => file.filename)

      console.log('Synchronizing database with file system migrations...')
      migrationsToImport = await this.choseMigrations(migrationsToImport, 'The following migrations exist in the migrations folder but not in the database.\nSelect the ones you want to import into the database')

      return this.syncMigrations(migrationsToImport)
    } catch (error) {
      console.log(chalk.red('Could not synchronize migrations in the migrations folder up to the database'))
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
    try {
      const { migrationsInDb, migrationsInFs } = await this.getMigrations()

      let migrationsToDelete = migrationsInDb
        .filter((migration) => !migrationsInFs.find((file) => file.filename === migration.filename))
        .map((migration) => migration.name)

      migrationsToDelete = await this.choseMigrations(migrationsToDelete, 'The following migrations exist in the database but not in the migrations folder.\nSelect the ones you want to remove from the file system')

      const migrationsToDeleteDocs = await this.migrationModel.find({ name: { $in: migrationsToDelete } }).lean().exec()

      if (migrationsToDelete.length) {
        console.log(`Removing migration(s) from database: \n${chalk.cyan(migrationsToDelete.join('\n'))} `)
        await this.migrationModel.deleteMany({ name: { $in: migrationsToDelete } }).exec()
      }

      return migrationsToDeleteDocs
    } catch (error) {
      console.log(chalk.red('Could not prune extraneous migrations from database'))
      throw error
    }
  }

  /**
   * @returns A promise that resolves to the migrations in the database
   * @memberof Migrator
   * @private
   * @async
   */
  private async noPendingMigrations (): Promise<LeanDocument<IMigration>[]> {
    console.log(chalk.yellow('There are no pending migrations'))
    console.log('Current migrations status: ')
    await this.list()
    return []
  }

  /**
     * Logs migration status to the console
     * @param direction The direction of the migration
     * @param filename The filename of the migration
     * @returns void
     * @memberof Migrator
     * @private
     */
  private logMigrationStatus (direction: 'down' | 'up', filename: string): void {
    console.log(chalk[direction === 'up' ? 'green' : 'red'](`${direction}:`) + ` ${filename} `)
  }

  /**
     * Gets template from file system
     * @param templatePath The path to the template
     * @returns The template string
     * @memberof Migrator
     * @private
     */
  private getTemplate (templatePath: string | undefined): string {
    // Case for local development
    const defaultTemplatePathTs = path.join(__dirname, 'template.ts')
    // Case for production after build
    const defaultTemplatePathJs = path.join(__dirname, 'template.js')
    if (templatePath && fs.existsSync(templatePath)) return fs.readFileSync(templatePath, 'utf8')
    if (fs.existsSync(defaultTemplatePathTs)) return fs.readFileSync(defaultTemplatePathTs, 'utf8')
    return fs.readFileSync(defaultTemplatePathJs, 'utf8')
  }

  /**
     * Ensures that the migrations path exists
     * @returns void
     * @memberof Migrator
     * @private
     */
  private ensureMigrationsPath (): void {
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
  private async connected (): Promise<Connection> {
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
  private async syncMigrations (migrationsInFs: string[]): Promise<IMigration[]> {
    const promises = migrationsInFs.map(async (filename) => {
      const filePath = path.join(this.migrationsPath, filename)
      const timestampSeparatorIndex = filename.indexOf('-')
      const timestamp = filename.slice(0, timestampSeparatorIndex)
      const migrationName = filename.slice(timestampSeparatorIndex + 1, filename.lastIndexOf('.'))

      console.log(`Adding migration ${filePath} into database from file system. State is ` + chalk.red('down'))
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
     * @private
     * @async
     */
  private async getMigrations (): Promise<{ migrationsInDb: IMigration[], migrationsInFs: IFileMigration[] }> {
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
     * @private
     * @async
     */
  private async choseMigrations (migrations: string[], message: string): Promise<string[]> {
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
     * @private
     * @async
     */
  private async runMigrations (migrationsToRun: HydratedDocument<IMigration>[], direction: 'down' | 'up'): Promise<LeanDocument<IMigration>[]> {
    const migrationsRan: LeanDocument<IMigration>[] = []
    for await (const migration of migrationsToRun) {
      const migrationFilePath = path.join(this.migrationsPath, migration.filename)
      const migrationFunctions = await import(migrationFilePath) as IMigrationModule

      const migrationFunction = migrationFunctions[direction]
      if (!migrationFunction) {
        throw new Error(chalk.red(`The '${direction}' export is not defined in ${migration.filename}.`))
      }

      try {
        await migrationFunction()

        this.logMigrationStatus(direction, migration.filename)

        await this.migrationModel.where({ name: migration.name }).updateMany({ $set: { state: direction } }).exec()
        migrationsRan.push(migration.toJSON())
      } catch (err: unknown) {
        console.log(chalk.red(`Failed to run migration ${migration.name} due to an error`))
        console.log(chalk.red('Not continuing. Make sure your data is in consistent state'))
        throw err
      }
    }

    return migrationsRan
  }
}

export default Migrator
