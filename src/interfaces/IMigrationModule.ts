import type { Connection } from 'mongoose'

interface IMigrationModule {
  up?: (connection: Connection) => Promise<void>
  down?: (connection: Connection) => Promise<void>
}

export default IMigrationModule
