import type { ConnectOptions } from 'mongoose'

interface IMigratorOptions {
  uri: string,
  connectOptions?: ConnectOptions
  templatePath?: string
  migrationsPath?: string
  collection?: string
  autosync?: boolean
  cli?: boolean
}

export default IMigratorOptions
