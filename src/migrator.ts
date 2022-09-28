import fs from 'fs'
import inquirer from 'inquirer'
import path from 'path'
import colors from 'colors'
import { register } from 'ts-node'

import mongoose, { Connection, FilterQuery, HydratedDocument, LeanDocument, Model } from 'mongoose'

import type IMigration from './interfaces/IMigration'
import type IMigratorOptions from './interfaces/IMigratorOptions'

import { registerOptions } from './options'
import { getMigrationModel } from './model'

colors.enable()
register(registerOptions)

const defaultTemplate = `/**
 * Make any changes you need to make to the database here
 */
export async function up () {
  // Write migration here
}

/**
 * Make any changes that UNDO the up function side effects here (if possible)
 */
export async function down () {
  // Write migration here
}
`

class Migrator {
  uri?: string
  template: string
  migrationPath: string
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

    this.migrationPath = path.resolve(options.migrationsPath || './migrations')
    this.collection = options.collection || 'migrations'
    this.autosync = options.autosync || false
    this.cli = options.cli || false

    this.ensureMigrationPath()

    if (options.connection) {
      this.connection = options.connection
    } else if (options.uri) {
      this.connection = mongoose.createConnection(options.uri, { autoCreate: true })
    } else {
      throw new Error('No mongoose connection or mongo uri provided to migrator'.red)
    }

    this.migrationModel = getMigrationModel(this.connection, this.collection)
  }

  ensureMigrationPath () {
    if (!fs.existsSync(this.migrationPath)) {
      fs.mkdirSync(this.migrationPath, { recursive: true })
    }
  }

  async connected (): Promise<Connection> {
    return this.connection.asPromise()
  }

  log (logString: string, force = false) {
    if (force || this.cli) {
      console.log(logString)
    }
  }

  async syncMigrations (migrationsInFs: string[]) {
    const promises = migrationsInFs.map(async (filename) => {
      const filePath = path.join(this.migrationPath, filename)
      const timestampSeparatorIndex = filename.indexOf('-')
      const timestamp = filename.slice(0, timestampSeparatorIndex)
      const migrationName = filename.slice(timestampSeparatorIndex + 1, filename.lastIndexOf('.'))

      this.log(`Adding migration ${filePath} into database from file system. State is ` + 'down'.red)
      const createdMigration = await this.migrationModel.create({
        name: migrationName,
        createdAt: timestamp
      })
      return createdMigration.toJSON()
    })

    return Promise.all(promises)
  }

  async getMigrations () {
    const files = fs.readdirSync(this.migrationPath)
    const migrationsInDb = await this.migrationModel.find({}).exec()
    const migrationsInFs = files
      .filter((filename) => /^\d{13,}-/.test(filename) && filename.endsWith('.ts'))
      .map((filename) => {
        const createdAt = parseInt(filename.split('-')[0])
        const existsInDatabase = migrationsInDb.some((migration) => filename === migration.filename)
        return { createdAt, filename, existsInDatabase }
      })

    return { migrationsInDb, migrationsInFs }
  }

  async choseMigrations (migrations: string[], message: string): Promise<string[]> {
    if (!this.autosync && migrations.length) {
      const answers: { chosen: string[] } = await inquirer.prompt({
        type: 'checkbox',
        message,
        name: 'chosen',
        choices: migrations
      })
      return answers.chosen
    }
    return migrations
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  async callMigrationFunction (migrationFunction: Function, args: unknown[]) {
    await new Promise((resolve, reject) => {
      const callPromise = migrationFunction.call(
        this.connection.model.bind(this.connection),
        /* istanbul ignore next */
        function callback (err: Error) {
          if (err) return reject(err)
          resolve(null)
        },
        ...args
      )

      if (callPromise && typeof callPromise.then === 'function') {
        callPromise.then(resolve).catch(reject)
      }
    })
  }

  logMigrationStatus (direction: 'up' | 'down', filename: string) {
    this.log(`${direction}:`[direction === 'up' ? 'green' : 'red'] + ` ${filename} `)
  }

  async runMigrations (migrationsToRun: HydratedDocument<IMigration>[], direction: 'up' | 'down', args: unknown[]) {
    const migrationsRan: LeanDocument<IMigration>[] = []
    if (migrationsToRun.length && this.cli === true && this.uri && mongoose.connection.readyState !== 1) {
      await mongoose.connect(this.uri)
    }
    for await (const migration of migrationsToRun) {
      const migrationFilePath = path.join(this.migrationPath, migration.filename)
      const migrationFunctions = await import(migrationFilePath)

      const migrationFunction = migrationFunctions[direction]
      if (!migrationFunction) {
        throw new Error(`The '${direction}' export is not defined in ${migration.filename}.`.red)
      }

      try {
        await this.callMigrationFunction(migrationFunction, args)

        this.logMigrationStatus(direction, migration.filename)

        await this.migrationModel.where({ name: migration.name }).updateMany({ $set: { state: direction } }).exec()
        migrationsRan.push(migration.toJSON())
      } catch (err: unknown) {
        this.log(`Failed to run migration ${migration.name} due to an error`.red)
        this.log('Not continuing. Make sure your data is in consistent state'.red)
        throw err instanceof (Error) ? err : new Error(err as string)
      }
    }

    return migrationsRan
  }

  /**
   * Close the underlying connection to mongo
   * @returns {Promise<void>} A promise that resolves when connection is closed
   */
  async close (): Promise<void> {
    if (this.connection) {
      await this.connection.close()
    }
  }

  /**
   * Create a new migration
   * @param {string} migrationName
   * @returns {Promise<Object>} A promise of the Migration created
   */
  async create (migrationName: string): Promise<HydratedDocument<IMigration>> {
    await this.connected()
    const existingMigration = await this.migrationModel.findOne({ name: migrationName }).exec()
    if (existingMigration) {
      throw new Error(`There is already a migration with name '${migrationName}' in the database`.red)
    }

    await this.sync()
    const now = Date.now()
    const newMigrationFile = `${now}-${migrationName}.ts`
    fs.writeFileSync(path.join(this.migrationPath, newMigrationFile), this.template)
    // create instance in db
    await this.connected()
    const migrationCreated = await this.migrationModel.create({
      name: migrationName,
      createdAt: now
    })
    this.log(`Created migration ${migrationName} in ${this.migrationPath}`)
    return migrationCreated
  }

  /**
   * Runs migrations up to or down to a given migration name
   * @param migrationName
   * @param direction
   */
  async run (direction: 'up' | 'down' = 'up', migrationName?: string, ...args: unknown[]): Promise<LeanDocument<IMigration>[]> {
    await this.connected()
    await this.sync()

    if (direction !== 'up' && direction !== 'down') {
      throw new Error(`The direction '${direction}' is not supported, use the 'up' or 'down' direction`)
    }

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
      this.log('There are no pending migrations'.yellow)
      this.log('Current migrations status: ')
      await this.list()
    }

    const migrationsRan = await this.runMigrations(migrationsToRun, direction, args)

    if (migrationsToRun.length === migrationsRan.length && migrationsRan.length > 0) {
      this.log('All migrations finished successfully'.green)
    }
    return migrationsRan
  }

  /**
   * Looks at the file system migrations and imports any migrations that are
   * on the file system but missing in the database into the database
   *
   * This functionality is opposite of prune()
   */
  async sync (): Promise<LeanDocument<IMigration>[]> {
    await this.connected()
    try {
      const { migrationsInFs } = await this.getMigrations()

      let migrationsToImport = migrationsInFs
        .filter((f) => f.existsInDatabase === false)
        .map((f) => f.filename)

      this.log('Synchronizing database with file system migrations...')
      migrationsToImport = await this.choseMigrations(migrationsToImport, 'The following migrations exist in the migrations folder but not in the database.\nSelect the ones you want to import into the database')

      return this.syncMigrations(migrationsToImport)
    } catch (error) {
      this.log('Could not synchronize migrations in the migrations folder up to the database'.red)
      throw error
    }
  }

  /**
   * Opposite of sync().
   * Removes files in migration directory which don't exist in database.
   */
  async prune () {
    await this.connected()
    try {
      const { migrationsInDb, migrationsInFs } = await this.getMigrations()

      let migrationsToDelete = migrationsInDb
        .filter((m) => !migrationsInFs.find((f) => f.filename === m.filename))
        .map((m) => m.name)

      migrationsToDelete = await this.choseMigrations(migrationsToDelete, 'The following migrations exist in the database but not in the migrations folder.\nSelect the ones you want to remove from the file system')

      const migrationsToDeleteDocs = await this.migrationModel.find({ name: { $in: migrationsToDelete } }).lean().exec()

      if (migrationsToDelete.length) {
        this.log(`Removing migration(s) from database: \n${migrationsToDelete.join('\n').cyan} `)
        await this.migrationModel.deleteMany({ name: { $in: migrationsToDelete } }).exec()
      }

      return migrationsToDeleteDocs
    } catch (error) {
      this.log('Could not prune extraneous migrations from database'.red)
      throw error
    }
  }

  /**
   * @example
   *   [
   *    { name: 'my-migration', filename: '149213223424_my-migration.ts', state: 'up' },
   *    { name: 'add-cows', filename: '149213223453_add-cows.ts', state: 'down' }
   *   ]
   */
  async list (): Promise<LeanDocument<IMigration>[]> {
    await this.connected()
    await this.sync()
    const migrations = await this.migrationModel.find().sort({ createdAt: 1 }).exec()
    if (!migrations.length) this.log('There are no migrations to list'.yellow)
    return migrations.map((migration: HydratedDocument<IMigration>) => {
      this.logMigrationStatus(migration.state, migration.filename)
      return migration.toJSON()
    })
  }
}

export default Migrator
