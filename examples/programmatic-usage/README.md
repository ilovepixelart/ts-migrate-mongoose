# Example of using the library programmatically

```typescript
import Migrator from 'ts-migrate-mongoose'

// Define all your variables
const collection = 'myMigrations'
const autosync = true

const migrator = new Migrator({
  // Path to migrations directory, default is ./migrations
  migrationsPath:  '/path/to/migrations/',
  // The template to use when creating migrations needs up and down functions exposed
  // No need to specify unless you want to use a custom template
  templatePath: '/path/to/template.ts',
  // MongoDB connection string URI
  uri: 'mongodb://localhost/my-db',
  // Collection name to use for migrations (defaults to 'migrations')
  collection: 'migrations', 
  // Ff making a CLI app, set this to false to prompt the user, otherwise true
  autosync: true
});


const migrationName = 'my-migration-name';

// Create a new migration
await migrator.create(migrationName).then(() => {
  console.log(`Migration created. Run `+ `migrate up ${migrationName}`.cyan + ` to apply the migration`);
});

// Migrate Up
await migrator.run('up', migrationName);

// Migrate Down
await migrator.run('down', migrationName);

// List Migrations
/*
Example return val

Promise which resolves with
[
 { name: 'my-migration', filename: '149213223424_my-migration.ts', state: 'up' },
 { name: 'add-cows', filename: '149213223453_add-cows.ts', state: 'down' }
]
*/
await migrator.list();


// Prune extraneous migrations from file system
await migrator.prune();

// Synchronize DB with latest migrations from file system
/*
Looks at the file system migrations and imports any migrations that are
on the file system but missing in the database into the database

This functionality is opposite of prune()
*/
await migrator.sync();
```
