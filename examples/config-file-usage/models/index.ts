import mongoose from 'mongoose'
import mongooseOptions from '../options/mongoose'

import User from './User'

const getModels = async () => {
  // In case you using mongoose 6
  // https://mongoosejs.com/docs/guide.html#strictQuery
  mongoose.set('strictQuery', false)

  // Ensure connection is open so we can run migrations
  await mongoose.connect(process.env.MIGRATE_MONGO_URI ?? 'mongodb://localhost/my-db', mongooseOptions)

  // Return models that will be used in migration methods
  return {
    mongoose,
    User
  }
}

export default getModels
