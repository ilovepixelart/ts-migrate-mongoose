/* eslint-disable import/first */
// Orders is important, import your models bellow this two lines, NOT above
import mongoose from 'mongoose'
import type { Mongoose } from 'mongoose'
mongoose.set('strictQuery', false) // https://mongoosejs.com/docs/guide.html#strictQuery

interface IApply {
  connect: (mongoose: Mongoose) => Promise<void>
}

// Import your models here

// Make any changes you need to make to the database here
export async function up (this: IApply): Promise<void> {
  await this.connect(mongoose)
  // Write migration here
}

// Make any changes that UNDO the up function side effects here (if possible)
export async function down (this: IApply): Promise<void> {
  await this.connect(mongoose)
  // Write migration here
}
