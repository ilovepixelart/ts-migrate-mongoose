import type { ConnectOptions, Connection } from 'mongoose'

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
}
