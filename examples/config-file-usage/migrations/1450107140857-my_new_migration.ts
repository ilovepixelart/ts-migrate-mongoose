import mongoose from 'mongoose'
// Import your models here
import User from '../models/User'

// https://mongoosejs.com/docs/guide.html#strictQuery
mongoose.set('strictQuery', false)
/**
 * Make any changes you need to make to the database here
 */
export async function up () {
  await this.connect(mongoose)
  // Write migration here
  await User.create({ firstName: 'Ada' })
}

/**
 * Make any changes that UNDO the up function side effects here (if possible)
 */
export async function down () {
  await this.connect(mongoose)
  // Write migration here
  await User.deleteOne({ firstName: 'Ada' })
}
