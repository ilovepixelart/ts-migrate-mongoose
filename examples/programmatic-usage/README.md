# Example of using the library programmatically

```typescript
import migrateMongoose from 'ts-migrate-mongoose'

// Define all your variables
const migrationsDir = '/path/to/migrations/'
const templatePath
const dbUrl = 'mongodb://localhost/db'
const collection = 'myMigrations'
const autosync = true

const migrator = new migrateMongoose({
  migrationsPath:  migrationsDir, // Path to migrations directory
  templatePath: templatePath, // The template to use when creating migrations needs up and down functions exposed
  connectionString: dbUrl, // mongo url
  collection:  collection, // collection name to use for migrations (defaults to 'migrations')
  autosync: autosync // if making a CLI app, set this to false to prompt the user, otherwise true
});


const migrationName = 'myNewMigration', promise;

// Create a new migration
migrator.create(migrationName).then(() => {
  console.log(`Migration created. Run `+ `mongoose-migrate up ${migrationName}`.cyan + ` to apply the migration.`);
});

// Migrate Up
promise = migrator.run('up', migrationName);

// Migrate Down
promise = migrator.run('down', migrationName);

// List Migrations
/*
Example return val

Promise which resolves with
[
 { name: 'my-migration', filename: '149213223424_my-migration.ts', state: 'up' },
 { name: 'add-cows', filename: '149213223453_add-cows.ts', state: 'down' }
]

*/
promise = migrator.list();


// Prune extraneous migrations from file system
promise = migrator.prune();

// Synchronize DB with latest migrations from file system
/*
Looks at the file system migrations and imports any migrations that are
on the file system but missing in the database into the database

This functionality is opposite of prune()
*/
promise = migrator.sync();
```
