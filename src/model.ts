import { Schema } from 'mongoose'

import type { Connection, Model } from 'mongoose'
import type { Migration } from './types'

export const getMigrationModel = (connection: Connection, collection: string): Model<Migration> => {
  // mongoose 8 and later reject an empty name with this error; earlier versions store the migrations in a collection named "s".
  if (collection === '') throw new TypeError('Collection name cannot be empty')

  const MigrationSchema = new Schema<Migration>(
    {
      name: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        enum: ['down', 'up'],
        default: 'down',
      },
      createdAt: {
        type: Date,
        index: true,
      },
      updatedAt: {
        type: Date,
      },
    },
    {
      collection,
      autoCreate: true,
      timestamps: true,
    },
  )

  MigrationSchema.virtual('filename').get(function () {
    return `${this.createdAt.getTime().toString()}-${this.name}`
  })

  return connection.model<Migration>(collection, MigrationSchema)
}
