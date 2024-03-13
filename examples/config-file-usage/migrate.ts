import connectOptions from './options/mongoose'

export default {
  uri: 'mongodb://localhost/my-db',
  migrationsPath: 'migrations',
  connectOptions,
}
