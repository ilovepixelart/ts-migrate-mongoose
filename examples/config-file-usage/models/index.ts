import mongoose from 'mongoose'
import mongooseOptions from '../options/mongoose'

import User from './User'

const getModels = async () => {
  // https://mongoosejs.com/docs/guide.html#strictQuery
  mongoose.set('strictQuery', false)

  // Ensure connection is open so we can run migrations
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MIGRATE_MONGO_URI ?? 'mongodb://localhost:27017/express', mongooseOptions)
  }

  // Return models that will be used in migration methods
  return {
    User
  }
}

export default getModels
