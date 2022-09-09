import User from '../models/User'

export async function up () {
  await User.create({ firstName: 'Ada' })
}

export async function down () {
  await User.deleteOne({ firstName: 'Ada' })
}
