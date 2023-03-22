// Import your models here
import User from '../models/User'

export async function up (): Promise<void> {
  // Write migration here
  await User.create({ firstName: 'Ada' })
}

export async function down (): Promise<void> {
  // Write migration here
  await User.deleteOne({ firstName: 'Ada' })
}
