import getModels from '../models'

export async function up () {
  const { User } = await getModels()
  // Write migration here
  const created = await User.create([
    {
      firstName: 'John',
      lastName: 'Doe'
    },
    {
      firstName: 'Jane',
      lastName: 'Doe'
    }
  ])
  console.log(created)
}

export async function down () {
  const { User } = await getModels()
  // Write migration here
  const deleted = await User.deleteMany({ firstName: { $in: ['Jane', 'John'] } }).exec()
  console.log(deleted)
}
