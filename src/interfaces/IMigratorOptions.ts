import type { Connection } from 'mongoose'

interface IMigratorOptionsBase {
  templatePath?: string
  migrationsPath?: string
  collection?: string
  autosync?: boolean
  cli?: boolean
}

interface IMigratorOptionsWithConnection extends IMigratorOptionsBase {
  connection: Connection
  uri?: never
}

interface IMigratorOptionsWithUri extends IMigratorOptionsBase {
  connection?: never
  uri: string
}

type IMigratorOptions = IMigratorOptionsWithConnection | IMigratorOptionsWithUri

export default IMigratorOptions
