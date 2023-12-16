import type { ConnectOptions } from 'mongoose'

interface IMigratorOptions {
  uri: string
  connectOptions?: ConnectOptions
  migrationsPath?: string
  templatePath?: string
  collection?: string
  autosync?: boolean
  cli?: boolean
}

export default IMigratorOptions
