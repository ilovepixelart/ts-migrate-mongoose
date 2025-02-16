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

export interface ConfigModule {
  default?: ConfigOptions
}

export interface MigrationModule {
  up?: (connection: Connection) => Promise<void>
  down?: (connection: Connection) => Promise<void>
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
