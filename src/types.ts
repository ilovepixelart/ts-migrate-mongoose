import type { ConnectOptions, Connection } from 'mongoose'

/**
 * Represents a migration file.
 * @interface
 * @property {string} filename - The name of the migration file.
 * @property {Date} createdAt - The date the migration file was created.
 * @property {boolean} existsInDatabase - Whether the migration file exists in the database.
 */
export interface MigrationFile {
  filename: string
  createdAt: Date
  existsInDatabase: boolean
}

/**
 * Represents a migration.
 * @interface
 * @property {string} name - The name of the migration.
 * @property {string} filename - The name of the migration file.
 * @property {'down' | 'up'} state - The state of the migration.
 * @property {Date} createdAt - The date the migration was created.
 * @property {Date} updatedAt - The date the migration was last updated.
 */
export interface Migration {
  name: string
  filename: string
  state: 'down' | 'up'
  createdAt: Date
  updatedAt: Date
}

/**
 * Represents the default configuration options.
 * @interface
 * @property {ConfigOptions} [default] - The default configuration options.
 */
export interface ConfigOptionsDefault {
  default?: ConfigOptions
}

/**
 * Represents the migration functions.
 * @interface
 * @property {(connection: Connection) => Promise<void>} [up] - The function to run when migrating up.
 * @property {(connection: Connection) => Promise<void>} [down] - The function to run when migrating down.
 */
export interface MigrationFunctions {
  up?: (connection: Connection) => Promise<void>
  down?: (connection: Connection) => Promise<void>
}

/**
 * Represents the default migration functions.
 * @interface
 * @property {MigrationFunctions} [default] - The default migration functions.
 */
export interface MigrationFunctionsDefault {
  default?: MigrationFunctions
}

interface CommonOptions {
  connectOptions?: ConnectOptions
  migrationsPath?: string
  templatePath?: string
  collection?: string
  autosync?: boolean
}

/**
 * Represents the configuration options.
 * @interface
 * @property {string} [uri] - The URI of the MongoDB database.
 * @property {string} [configPath] - The path to the configuration file.
 * @property {string} [mode] - The mode to run the migrator in.
 */
export interface ConfigOptions extends CommonOptions {
  uri?: string
  configPath?: string
  mode?: string
}

/**
 * Represents the migrator options.
 * @interface
 * @property {string} uri - The URI of the MongoDB database.
 * @property {boolean} [cli] - Whether the migrator is running in CLI mode.
 */
export interface MigratorOptions extends CommonOptions {
  uri: string
  cli?: boolean
}

/**
 * Represents the environment variables.
 * @enum
 * @property {string} MIGRATE_CONFIG_PATH - The path to the migration configuration file.
 * @property {string} MIGRATE_MONGO_COLLECTION - The name of the MongoDB collection for migrations.
 * @property {string} MIGRATE_MIGRATIONS_PATH - The path to the migrations directory.
 * @property {boolean} MIGRATE_AUTOSYNC - Whether to automatically sync migrations without prompting.
 * @property {boolean} MIGRATE_CLI - Whether the migration tool is running in CLI mode.
 * @property {string} MIGRATE_MODE - The mode to run the migrator in.
 * @property {string} MIGRATE_MONGO_URI - The URI of the MongoDB database.
 * @property {string} MIGRATE_TEMPLATE_PATH - The path to the migration template file.
 */
export enum Env {
  MIGRATE_CONFIG_PATH = 'MIGRATE_CONFIG_PATH',
  MIGRATE_MONGO_COLLECTION = 'MIGRATE_MONGO_COLLECTION',
  MIGRATE_MIGRATIONS_PATH = 'MIGRATE_MIGRATIONS_PATH',
  MIGRATE_AUTOSYNC = 'MIGRATE_AUTOSYNC',
  MIGRATE_CLI = 'MIGRATE_CLI',
  MIGRATE_MODE = 'MIGRATE_MODE',
  MIGRATE_MONGO_URI = 'MIGRATE_MONGO_URI',
  MIGRATE_TEMPLATE_PATH = 'MIGRATE_TEMPLATE_PATH',
}
