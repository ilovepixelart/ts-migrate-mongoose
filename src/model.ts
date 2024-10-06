import { Schema } from 'mongoose'

import type { Connection, Model } from 'mongoose'
import type IMigration from './interfaces/IMigration'

/**
 * This function returns a mongoose model for the migration collection.
 * The model is used to query the database for the migrations.
 * @param connection The mongoose connection to use
 * @param collection The name of the collection to use
 */
export const getMigrationModel = (connection: Connection, collection: string): Model<IMigration> => {
  const MigrationSchema = new Schema<IMigration>(
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
    return `${this.createdAt.getTime().toString()}-${this.name}.ts`
  })

  return connection.model<IMigration>(collection, MigrationSchema)
}
