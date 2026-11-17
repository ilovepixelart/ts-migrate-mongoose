import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import mongoose from 'mongoose'
import { chalk } from './chalk'
import { LOCK_LEASE_MS, MIGRATION_FILE_EXTENSIONS, MIGRATION_FILE_REGEX, MIGRATION_NAME_REGEX } from './constants'
import { defaults } from './defaults'
import { loader } from './loader'
import { MigrationLock } from './lock'
import { getMigrationModel } from './model'
import { checkbox } from './prompts'
import { template } from './template'

import type { Connection, HydratedDocument, Model } from 'mongoose'
import type { Lease } from './lock'
import type { Migration, MigrationFile, MigrationFunctions, MigrationFunctionsDefault, MigratorOptions } from './types'

/**
 * Resolves a migration file path by trying common extensions
 * Returns the full path with extension if found, otherwise returns the original path
 */
const resolveMigrationFile = (basePath: string): string => {
  // If the path already has an extension that exists, use it
  if (fs.existsSync(basePath)) {
    return basePath
  }

  // Try each extension in order
  for (const ext of MIGRATION_FILE_EXTENSIONS) {
    const pathWithExt = `${basePath}.${ext}`
    if (fs.existsSync(pathWithExt)) {
      return pathWithExt
    }
  }

  // Return original path if no extension found (will fail on import with a clear error)
  return basePath
}

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
  private readonly lock: MigrationLock | undefined
  private lease: Lease | undefined

  private constructor(options: MigratorOptions) {
    // Documented API contract: consumer migration files often query via
    // non-schema fields (e.g. data fixups where a field has since been
    // removed from the schema). Setting `strictQuery: false` preserves
    // the pre-mongoose-7 behaviour of passing unknown fields through
    // unchanged. The `should disable strict` CLI test locks in this
    // contract by running a migration whose deleteMany filter references
    // a field that no longer exists on the schema.
    //
    // This IS a process-wide mongoose setting and will affect other
    // mongoose connections in the same Node process. Callers who need
    // a different value in their own code should set it back after the
    // Migrator has finished — there is no per-connection alternative
    // that works consistently across all supported mongoose majors.
    mongoose.set('strictQuery', false)

    this.template = this.getTemplate(options.templatePath)
    this.migrationsPath = path.resolve(options.migrationsPath ?? defaults.MIGRATE_MIGRATIONS_PATH)
    this.collection = options.collection ?? defaults.MIGRATE_MONGO_COLLECTION
    this.autosync = options.autosync ?? defaults.MIGRATE_AUTOSYNC
    this.cli = options.cli ?? defaults.MIGRATE_CLI

    const lockTimeout = options.lockTimeout ?? defaults.MIGRATE_LOCK_TIMEOUT
    if (!Number.isFinite(lockTimeout) || lockTimeout < 0) {
      throw new Error(`lockTimeout must be a non-negative number of milliseconds, received ${lockTimeout}`)
    }

    this.ensureMigrationsPath()

    if (options.uri) {
      this.uri = options.uri
      this.connection = mongoose.createConnection(this.uri, options.connectOptions)
    } else {
      throw new Error('No mongoose connection or mongo uri provided to migrator')
    }

    this.migrationModel = getMigrationModel(this.connection, this.collection)
    this.lock = (options.lock ?? defaults.MIGRATE_LOCK) ? new MigrationLock(this.connection, options.lockCollection ?? `${this.collection}_lock`, this.collection, lockTimeout, LOCK_LEASE_MS) : undefined
  }

  /**
   * Asynchronously creates a new migrator instance
   */
  static async connect(options: MigratorOptions): Promise<Migrator> {
    await loader()

    const migrator = new Migrator(options)
    try {
      await migrator.connected()
      return migrator
    } catch (error) {
      // The constructor already opened a mongoose connection; if connecting
      // fails the caller never gets a handle and would otherwise leak the
      // socket. Best-effort close — swallow cleanup errors so they don't
      // mask the original failure.
      await migrator.close().catch(() => undefined)
      throw error
    }
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
    // With nothing to import, listing only reads, so it does not wait for a
    // migration another process is running.
    if (this.lock && !(await this.hasMigrationsToImport())) {
      return this.logMigrations()
    }
    return this.withLock(() => this.syncAndList())
  }

  private async syncAndList(): Promise<HydratedDocument<Migration>[]> {
    await this.syncFromFs()
    return this.logMigrations()
  }

  private async logMigrations(): Promise<HydratedDocument<Migration>[]> {
    const migrations = await this.migrationModel.find().sort({ createdAt: 1, _id: 1 }).exec()
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
    if (!MIGRATION_NAME_REGEX.test(migrationName)) {
      throw new Error(`Invalid migration name '${migrationName}'. Allowed characters: letters, digits, underscore, hyphen, and non-consecutive dots.`)
    }

    return this.withLock(() => this.createMigration(migrationName))
  }

  private async createMigration(migrationName: string): Promise<HydratedDocument<Migration>> {
    const existingMigration = await this.migrationModel.findOne({ name: migrationName }).exec()
    if (existingMigration) {
      throw new Error(`There is already a migration with name '${migrationName}' in the database`)
    }

    await this.syncFromFs()
    const now = Date.now()
    const newMigrationFile = `${now.toString()}-${migrationName}.ts`
    fs.writeFileSync(path.join(this.migrationsPath, newMigrationFile), this.template)
    const migrationCreated = await this.migrationModel.create({
      name: migrationName,
      createdAt: now,
    })
    this.log(`${chalk.green('Created')} migration ${chalk.cyan(migrationName)} in ${this.migrationsPath}`)
    return migrationCreated
  }

  /**
   * Runs migrations up to or down to a given migration name
   */
  async run(direction: 'up' | 'down', migrationName?: string, single = false): Promise<HydratedDocument<Migration>[]> {
    if (migrationName !== undefined && typeof migrationName !== 'string') {
      throw new Error(`migrationName must be a string, received ${typeof migrationName}`)
    }

    return this.withLock(() => this.runUntil(direction, migrationName, single))
  }

  private async runUntil(direction: 'up' | 'down', migrationName: string | undefined, single: boolean): Promise<HydratedDocument<Migration>[]> {
    await this.syncFromFs()

    const isUp = direction === 'up'
    const state = isUp ? 'down' : 'up'
    const key = isUp ? '$lte' : '$gte'
    const sort: 1 | -1 = isUp ? 1 : -1

    const untilMigration = await this.findUntilMigration(migrationName, state, single, sort)
    if (!untilMigration) {
      if (migrationName) {
        throw new Error(`Could not find migration with name '${migrationName}' in the database`)
      }
      return this.noPendingMigrations()
    }

    const migrationsToRun = await this.collectMigrationsToRun(untilMigration, key, state, single, sort)
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
   * Resolves the `untilMigration` boundary document for `run()`. Either the
   * explicitly-named migration, or the most-recent/least-recent candidate
   * in the target state depending on whether we're running a single step
   * or a full batch.
   */
  private async findUntilMigration(migrationName: string | undefined, state: 'down' | 'up', single: boolean, sort: 1 | -1): Promise<HydratedDocument<Migration> | null> {
    if (migrationName) {
      return this.migrationModel.findOne({ name: migrationName }).exec()
    }
    const tieBreaker: 1 | -1 = single ? sort : (-sort as 1 | -1)
    return this.migrationModel.findOne({ state }).sort({ createdAt: tieBreaker, _id: tieBreaker }).exec()
  }

  /**
   * Builds the ordered list of migrations to execute for `run()`. In single
   * mode, returns just the boundary doc; otherwise returns every pending
   * migration on the same side of the boundary, sorted deterministically.
   */
  private async collectMigrationsToRun(untilMigration: HydratedDocument<Migration>, key: '$lte' | '$gte', state: 'down' | 'up', single: boolean, sort: 1 | -1): Promise<HydratedDocument<Migration>[]> {
    if (single) {
      return [untilMigration]
    }
    const query = {
      createdAt: { [key]: untilMigration.createdAt },
      state,
    }
    const migrations = await this.migrationModel.find(query).sort({ createdAt: sort, _id: sort }).exec()
    return this.oncePerFile(migrations)
  }

  /**
   * Keeps the first state document of each file. Concurrent syncs before the
   * lock existed could store a file twice; running it once per document would
   * apply it twice. Every copy is still updated, as state is set by name.
   */
  private oncePerFile(migrations: HydratedDocument<Migration>[]): HydratedDocument<Migration>[] {
    const copies = new Map<string, number>()
    const unique = migrations.filter((migration) => {
      const seen = (copies.get(migration.filename) ?? 0) + 1
      copies.set(migration.filename, seen)
      return seen === 1
    })
    for (const [filename, count] of copies) {
      if (count > 1) this.log(chalk.yellow(`Found ${count} state documents for ${filename}; running it once`))
    }
    return unique
  }

  /**
   * Looks at the file system migrations and imports any migrations that are
   * on the file system but missing in the database into the database
   *
   * This functionality is opposite of prune()
   */
  async sync(): Promise<HydratedDocument<Migration>[]> {
    return this.withLock(() => this.syncFromFs())
  }

  private async syncFromFs(): Promise<HydratedDocument<Migration>[]> {
    try {
      const { migrationsInFs } = await this.getMigrations()

      let migrationsToImport = migrationsInFs.filter((file) => !file.existsInDatabase).map((file) => file.filename)

      migrationsToImport = await this.choseMigrations(migrationsToImport, 'The following migrations exist in the migrations folder but not in the database.\nSelect the ones you want to import into the database')

      return this.syncMigrations(migrationsToImport)
    } catch (error) {
      throw new Error('Could not synchronize migrations in the migrations folder up to the database', { cause: error })
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
    return this.withLock(() => this.pruneMigrations())
  }

  private async pruneMigrations(): Promise<HydratedDocument<Migration>[]> {
    try {
      let migrationsDeleted: HydratedDocument<Migration>[] = []

      const { migrationsInDb, migrationsInFs } = await this.getMigrations()

      let migrationsToDelete = migrationsInDb.filter((migration) => !migrationsInFs.some((file) => file.filename === migration.filename)).map((migration) => migration.name)

      migrationsToDelete = await this.choseMigrations(migrationsToDelete, 'The following migrations exist in the database but not in the migrations folder.\nSelect the ones you want to remove from the database')

      if (migrationsToDelete.length) {
        migrationsDeleted = await this.migrationModel.find({ name: { $in: migrationsToDelete } }).exec()
        this.log(`${chalk.red('Removing')} migration(s) from database:\n${chalk.cyan(migrationsToDelete.join('\n'))}`)
        await this.migrationModel.deleteMany({ name: { $in: migrationsToDelete } }).exec()
      }

      return migrationsDeleted
    } catch (error) {
      throw new Error('Could not prune extraneous migrations from database', { cause: error })
    }
  }

  /**
   * Runs an operation that changes migration state while holding the
   * migration lock, so that concurrent processes take turns.
   */
  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.lock) {
      return operation()
    }
    const lease = await this.lock.acquire()
    this.lease = lease
    try {
      return await operation()
    } finally {
      this.lease = undefined
      await lease.release()
    }
  }

  private async hasMigrationsToImport(): Promise<boolean> {
    try {
      const { migrationsInFs } = await this.getMigrations()
      return migrationsInFs.some((file) => !file.existsInDatabase)
    } catch {
      // Take the locked path, whose sync reports the failure as it always has.
      return true
    }
  }

  /**
   * Logs a message to the console if there are no pending migrations
   * In cli mode, it also lists all migrations and their status
   */
  private async noPendingMigrations(): Promise<HydratedDocument<Migration>[]> {
    this.log(chalk.yellow('There are no pending migrations'))
    if (this.cli) {
      this.log(chalk.cyan('Current migrations status:'))
      await this.syncAndList()
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
    this.log(`${directionWithColor} ${filename}`)
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

      this.log(`${chalk.green('Adding')} migration ${chalk.cyan(filePath)} into database. State is ${chalk.red('down')}`)
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

    const migrationsInFs = files
      .filter((filename) => /^\d{13,}-/.test(filename) && MIGRATION_FILE_REGEX.test(filename))
      .map((filename) => {
        const filenameWithoutExtension = filename.replace(MIGRATION_FILE_REGEX, '')
        const [time] = filename.split('-')
        const timestamp = Number.parseInt(time ?? '', 10)
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
      const selected = await checkbox({
        message,
        choices: migrations.map((migration) => ({ name: migration, value: migration })),
      })
      return selected
    }
    return migrations
  }

  /**
   * Run migrations in a given direction
   */
  private async runMigrations(migrationsToRun: HydratedDocument<Migration>[], direction: 'down' | 'up'): Promise<HydratedDocument<Migration>[]> {
    const migrationsRan: HydratedDocument<Migration>[] = []
    const migrationsRoot = path.resolve(this.migrationsPath) + path.sep
    for (const migration of migrationsToRun) {
      if (this.lease?.lost) {
        throw new Error(`Stopped before migration '${migration.name}': the migration lock was lost because its lease expired, so another process may be running migrations. Run the command again to continue.`)
      }
      const baseMigrationPath = path.resolve(path.join(this.migrationsPath, migration.filename))
      if (!baseMigrationPath.startsWith(migrationsRoot)) {
        throw new Error(`Refusing to import migration '${migration.filename}' — resolved path escapes the migrations directory.`)
      }
      const migrationFilePath = resolveMigrationFile(baseMigrationPath)
      const fileUrl = pathToFileURL(migrationFilePath).href
      const migrationFunctions = (await import(fileUrl)) as MigrationFunctions | MigrationFunctionsDefault
      const migrationFunction = (migrationFunctions as MigrationFunctionsDefault).default?.[direction] ?? (migrationFunctions as MigrationFunctions)[direction]
      if (!migrationFunction) {
        throw new Error(`The '${direction}' export is not defined in ${migration.filename}.`)
      }

      try {
        await migrationFunction(this.connection)

        this.logMigrationStatus(direction, migration.filename)

        await this.migrationModel.updateMany({ name: migration.name }, { $set: { state: direction } }).exec()
        migrationsRan.push(migration)
      } catch (error) {
        throw new Error(`Failed to run migration with name '${migration.name}' due to an error`, { cause: error })
      }
    }

    return migrationsRan
  }
}
