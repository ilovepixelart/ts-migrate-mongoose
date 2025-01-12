import { UserSchema } from '../models/User'
import { Connection } from 'mongoose'

export async function up(connection: Connection) {
  const User = connection.model('User', UserSchema)
  await User.create([
    {
      firstName: 'John',
      lastName: 'Doe',
    },
    {
      firstName: 'Jane',
      lastName: 'Doe',
    },
  ])
}

export async function down(connection: Connection) {
  const User = connection.model('User', UserSchema)
  await User.deleteMany({ firstName: { $in: ['Jane', 'John'] } }).exec()
}
