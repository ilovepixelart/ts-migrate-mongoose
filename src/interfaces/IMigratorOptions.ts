import { Connection } from 'mongoose'

interface IMigratorOptions {
  templatePath?: string
  migrationsPath?: string
  connectionString: string
  collection?: string
  autosync: boolean
  cli?: boolean
  connection?: Connection
}

export default IMigratorOptions
