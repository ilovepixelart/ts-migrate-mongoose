import { Schema } from 'mongoose'

import type { Connection, Model } from 'mongoose'
import type { Migration } from './types'

/**
 * This function returns a mongoose model for the migration collection.
 * The model is used to query the database for the migrations.
 * @param {Connection} connection - The mongoose connection to use
 * @param {string} collection - The name of the collection to use
 * @returns {Model<Migration>} - The mongoose model for the migration collection
 */
export const getMigrationModel = (connection: Connection, collection: string): Model<Migration> => {
  const MigrationSchema = new Schema<Migration>(
    {
      name: String,
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
