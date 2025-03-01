import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import chalk from 'chalk'
import inquirer from 'inquirer'
import mongoose from 'mongoose'

import { defaults } from './defaults'
import { getMigrationModel } from './model'
import { template } from './template'

import type { Connection, FilterQuery, HydratedDocument, Model } from 'mongoose'
import type { Migration, MigrationFile, MigrationFunctions, MigrationFunctionsDefault, MigratorOptions } from './types'

export * from './types'

/**
 * This class is responsible for running migrations in the CLI and Programmatic mode
 */
export class Migrator {
  readonly migrationModel: Model<Migration>
  readonly connection: Connection

  private readonly uri?: string
  private readonly template: string
  private readonly migrationsPath: string
  private readonly collection: string
  private readonly autosync: boolean
  private readonly cli: boolean

  private constructor(options: MigratorOptions) {
    // https://mongoosejs.com/docs/guide.html
    mongoose.set('strictQuery', false)

    this.template = this.getTemplate(options.templatePath)
    this.migrationsPath = path.resolve(options.migrationsPath ?? defaults.MIGRATE_MIGRATIONS_PATH)
    this.collection = options.collection ?? defaults.MIGRATE_MONGO_COLLECTION
    this.autosync = options.autosync ?? defaults.MIGRATE_AUTOSYNC
    this.cli = options.cli ?? defaults.MIGRATE_CLI

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
   */
  static async connect(options: MigratorOptions): Promise<Migrator> {
    await import('tsx')
      .then(() => {
        console.log('Loaded tsx')
      })
      .catch(() => {
        console.log('Skipped tsx')
      })

    const migrator = new Migrator(options)
    await migrator.connected()
    return migrator
  }

  /**
   * Close the underlying connection to mongo
   */
  async close(): Promise<void> {
    await this.connection.close()
  }

  /**
   * Lists all migrations in the database and their status
   */
  async list(): Promise<HydratedDocument<Migration>[]> {
    await this.sync()
    const migrations = await this.migrationModel.find().sort({ createdAt: 1 }).exec()
    if (!migrations.length) this.log(chalk.yellow('There are no migrations to list'))
    return migrations.map((migration: HydratedDocument<Migration>) => {
      this.logMigrationStatus(migration.state, migration.filename)
      return migration
    })
  }

  /**
   * Create a new migration file
   */
  async create(migrationName: string): Promise<HydratedDocument<Migration>> {
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
   */
  async run(direction: 'up' | 'down', migrationName?: string, single = false): Promise<HydratedDocument<Migration>[]> {
    await this.sync()

    let untilMigration: HydratedDocument<Migration> | null = null
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

    const query: FilterQuery<Migration> = {
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
   */
  async sync(): Promise<HydratedDocument<Migration>[]> {
    try {
      const { migrationsInFs } = await this.getMigrations()

      let migrationsToImport = migrationsInFs.filter((file) => !file.existsInDatabase).map((file) => file.filename)

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
   */
  async prune(): Promise<HydratedDocument<Migration>[]> {
    try {
      let migrationsDeleted: HydratedDocument<Migration>[] = []

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
   * Logs a message to the console if there are no pending migrations
   * In cli mode, it also lists all migrations and their status
   */
  private async noPendingMigrations(): Promise<HydratedDocument<Migration>[]> {
    this.log(chalk.yellow('There are no pending migrations'))
    if (this.cli) {
      this.log('Current migrations status: ')
      await this.list()
    }
    return []
  }

  /**
   * Logs a message to the console if the migrator is running in cli mode or if force is true
   */
  private log(message: string): void {
    if (this.cli) {
      console.log(message)
    }
  }

  /**
   * Logs migration status to the console
   */
  private logMigrationStatus(direction: 'down' | 'up', filename: string): void {
    const color = direction === 'up' ? 'green' : 'red'
    const directionWithColor = chalk[color](`${direction}:`)
    this.log(`${directionWithColor} ${filename} `)
  }

  /**
   * Gets template from file system
   */
  private getTemplate(templatePath: string | undefined): string {
    if (templatePath && fs.existsSync(templatePath)) {
      return fs.readFileSync(templatePath, 'utf8')
    }
    return template
  }

  /**
   * Ensures that the migrations path exists
   */
  private ensureMigrationsPath(): void {
    if (!fs.existsSync(this.migrationsPath)) {
      fs.mkdirSync(this.migrationsPath, { recursive: true })
    }
  }

  /**
   * Connection status of the migrator to the database
   */
  private async connected(): Promise<Connection> {
    return this.connection.asPromise()
  }

  /**
   * Creates a new migration in database to reflect the changes in file system
   */
  private async syncMigrations(migrationsInFs: string[]): Promise<HydratedDocument<Migration>[]> {
    const promises = migrationsInFs.map(async (filename) => {
      const filePath = path.join(this.migrationsPath, filename)
      const timestampSeparatorIndex = filename.indexOf('-')
      const timestamp = filename.slice(0, timestampSeparatorIndex)
      const migrationName = filename.slice(timestampSeparatorIndex + 1)

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
   */
  private async getMigrations(): Promise<{
    migrationsInDb: Migration[]
    migrationsInFs: MigrationFile[]
  }> {
    const files = fs.readdirSync(this.migrationsPath)
    const migrationsInDb = await this.migrationModel.find({}).exec()

    const fileExtensionMatch = /(\.js|(?<!\.d)\.ts)$/ // allow .js and .ts files, but not .d.ts files
    const migrationsInFs = files
      .filter((filename) => /^\d{13,}-/.test(filename) && fileExtensionMatch.test(filename))
      .map((filename) => {
        const filenameWithoutExtension = filename.replace(/\.(js|ts)$/, '')
        const [time] = filename.split('-')
        const timestamp = Number.parseInt(time ?? '')
        const createdAt = new Date(timestamp)
        const existsInDatabase = migrationsInDb.some((migration) => filenameWithoutExtension === migration.filename)
        return { createdAt, filename: filenameWithoutExtension, existsInDatabase }
      })

    return { migrationsInDb, migrationsInFs }
  }

  /**
   * Creates a prompt for the user to chose the migrations to run
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
   */
  private async runMigrations(migrationsToRun: HydratedDocument<Migration>[], direction: 'down' | 'up'): Promise<HydratedDocument<Migration>[]> {
    const migrationsRan: HydratedDocument<Migration>[] = []
    for await (const migration of migrationsToRun) {
      const migrationFilePath = path.resolve(path.join(this.migrationsPath, migration.filename))
      const fileUrl = pathToFileURL(migrationFilePath).href
      const migrationFunctions = (await import(fileUrl)) as MigrationFunctions | MigrationFunctionsDefault
      const migrationFunction = 'default' in migrationFunctions ? migrationFunctions.default[direction] : (migrationFunctions as MigrationFunctions)[direction]
      if (!migrationFunction) {
        const message = chalk.red(`The '${direction}' export is not defined in ${migration.filename}.`)
        throw new Error(message)
      }

      try {
        await migrationFunction(this.connection)

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
