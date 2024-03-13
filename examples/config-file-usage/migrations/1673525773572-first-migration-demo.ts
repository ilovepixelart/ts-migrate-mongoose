import getModels from '../models'

export async function up() {
  const { User } = await getModels()
  // Write migration here
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

export async function down() {
  const { User } = await getModels()
  // Write migration here
  await User.deleteMany({ firstName: { $in: ['Jane', 'John'] } }).exec()
}
