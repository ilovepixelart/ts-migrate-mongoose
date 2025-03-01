# Example of using the library programmatically

Check the full example [here using express + typescript 5](https://github.com/ilovepixelart/ts-express-tsx)

```typescript
import { Migrator } from 'ts-migrate-mongoose'

const migrator = await Migrator.connect({
  uri: 'mongodb://localhost/my-db',
  autosync: true
})

const migrationName = 'add-users'

// Create a new migration
await migrator.create(migrationName).then(() => {
  console.log('Migration created')
})

// Migrate Up
await migrator.run('up', migrationName)

// Migrate Down
await migrator.run('down', migrationName)

// List Migrations
/*
Example return value:
[
 { name: 'add-users', filename: '1735680000000-add-users.ts', state: 'down' }
]
*/
await migrator.list()

// Prune extraneous migrations from the file system
await migrator.prune()

// Synchronize DB with the latest migrations from the file system
/*
Imports any migrations that are on the file system but missing in the database into the database.
This functionality is the opposite of prune()
*/
await migrator.sync()
```

## Additional Information

- **Migration Naming**: Use descriptive names for your migrations.
- **Error Handling**: Handle errors gracefully in your migration functions.
- **Testing Migrations**: Test your migrations in a staging environment.
- **Backup**: Always back up your database before running migrations.
