import type { Connection, ConnectOptions } from "mongoose"

export interface IConfigModule {
  default?: IOptions
}

export interface IFileMigration {
  filename: string
  createdAt: Date
  existsInDatabase: boolean
}

export interface IMigration {
  name: string
  filename: string
  state: 'down' | 'up'
  createdAt: Date
  updatedAt: Date
}

export interface IMigrationModule {
  up?: (connection: Connection) => Promise<void>
  down?: (connection: Connection) => Promise<void>
}

export interface IMigratorOptions {
  uri: string
  connectOptions?: ConnectOptions
  migrationsPath?: string
  templatePath?: string
  collection?: string
  autosync?: boolean
  cli?: boolean
}

export interface IOptions {
  uri?: string
  connectOptions?: ConnectOptions
  migrationsPath?: string
  templatePath?: string
  collection?: string
  autosync?: boolean
  configPath?: string
  mode?: string
}