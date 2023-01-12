/* eslint-disable import/first */
// Orders is important, import your models bellow this two lines, NOT above
import mongoose from 'mongoose'
mongoose.set('strictQuery', false) // https://mongoosejs.com/docs/guide.html#strictQuery

// Import your models here
import User from '../models/User'

// Make any changes you need to make to the database here
export async function up () {
  await this.connect(mongoose)
  // Write migration here
  await User.create({ firstName: 'Ada' })
}

// Make any changes that UNDO the up function side effects here (if possible)
export async function down () {
  await this.connect(mongoose)
  // Write migration here
  await User.deleteOne({ firstName: 'Ada' })
}
