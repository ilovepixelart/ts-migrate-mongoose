import type { Connection, ConnectOptions } from 'mongoose'

export interface MigrationFile {
  filename: string
  createdAt: Date
  existsInDatabase: boolean
}

export interface Migration {
  name: string
  filename: string
  state: 'down' | 'up'
  createdAt: Date
  updatedAt: Date
}

export interface ConfigOptionsDefault {
  default?: ConfigOptions
}

export interface MigrationFunctions {
  up?: (connection: Connection) => Promise<void>
  down?: (connection: Connection) => Promise<void>
}

export interface MigrationFunctionsDefault {
  default?: MigrationFunctions
}

interface CommonOptions {
  connectOptions?: ConnectOptions
  migrationsPath?: string
  templatePath?: string
  collection?: string
  autosync?: boolean
  /** Take a lock in MongoDB before changing migration state, so concurrent processes run each migration once. Default `true`. */
  lock?: boolean
  /** Milliseconds to wait for another process to release the lock before failing. Default `300000`. */
  lockTimeout?: number
  /** Collection that holds the lock document. Default `<collection>_lock`. */
  lockCollection?: string
}

export interface ConfigOptions extends CommonOptions {
  uri?: string
  configPath?: string
  mode?: string
}

export interface MigratorOptions extends CommonOptions {
  uri: string
  cli?: boolean
}

export enum Env {
  MIGRATE_CONFIG_PATH = 'MIGRATE_CONFIG_PATH',
  MIGRATE_MONGO_COLLECTION = 'MIGRATE_MONGO_COLLECTION',
  MIGRATE_MIGRATIONS_PATH = 'MIGRATE_MIGRATIONS_PATH',
  MIGRATE_AUTOSYNC = 'MIGRATE_AUTOSYNC',
  MIGRATE_CLI = 'MIGRATE_CLI',
  MIGRATE_MODE = 'MIGRATE_MODE',
  MIGRATE_MONGO_URI = 'MIGRATE_MONGO_URI',
  MIGRATE_TEMPLATE_PATH = 'MIGRATE_TEMPLATE_PATH',
  MIGRATE_LOCK = 'MIGRATE_LOCK',
  MIGRATE_LOCK_TIMEOUT = 'MIGRATE_LOCK_TIMEOUT',
  MIGRATE_LOCK_COLLECTION = 'MIGRATE_LOCK_COLLECTION',
}
