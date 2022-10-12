import { Schema } from 'mongoose'

import type { Connection, HydratedDocument } from 'mongoose'
import type IMigration from './interfaces/IMigration'

export const getMigrationModel = (connection: Connection, collection = 'migrations') => {
  const MigrationSchema = new Schema<IMigration>({
    name: String,
    state: {
      type: String,
      enum: ['down', 'up'],
      default: 'down'
    },
    createdAt: Date
  }, {
    collection,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret: HydratedDocument<IMigration>) {
        delete ret.id
        delete ret.__v
        return ret
      }
    }
  })

  MigrationSchema.virtual('filename').get(function () {
    return `${this.createdAt.getTime()}-${this.name}.ts`
  })

  return connection.model<IMigration>(collection, MigrationSchema)
}
