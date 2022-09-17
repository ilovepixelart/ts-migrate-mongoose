import { Schema, Connection, MongooseError } from 'mongoose'

import IMigration from './interfaces/IMigration'

export const getMigrationModel = (connection: Connection, collection = 'migrations') => {
  connection.on('error', (err: MongooseError) => {
    console.error(`MongoDB Connection Error: ${err}`)
  })

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
      transform: function (doc, ret) {
        delete ret._id
        delete ret.id
        delete ret.__v
        return ret
      }
    }
  })

  MigrationSchema.virtual('filename').get(function () {
    return `${this.createdAt?.getTime()}-${this.name}.ts`
  })

  return connection.model<IMigration>(collection, MigrationSchema)
}
