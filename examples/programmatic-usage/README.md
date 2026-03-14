# Example of using the library programmatically

Full examples:

- Express: [ts-express-tsx](https://github.com/ilovepixelart/ts-express-tsx), [ts-express-esbuild](https://github.com/ilovepixelart/ts-express-esbuild)
- Nest: [ts-express-nest](https://github.com/ilovepixelart/ts-express-nest)

## Basic usage

```typescript
import { Migrator } from 'ts-migrate-mongoose'

const migrator = await Migrator.connect({
  uri: 'mongodb://localhost:27017/my-db',
  autosync: true,
})

// Run all pending up migrations
await migrator.run('up')

// Run a specific migration up
await migrator.run('up', 'add-users')

// Run a single migration up (not all pending)
await migrator.run('up', 'add-users', true)

// Roll back a specific migration
await migrator.run('down', 'add-users')

// List all migrations and their status
await migrator.list()

// Create a new migration file
await migrator.create('add-users')

// Remove migrations from DB that don't exist in file system
await migrator.prune()

// Close the connection when done
await migrator.close()
```

## Custom migration flow

```typescript
import { Migrator } from 'ts-migrate-mongoose'

const migrator = await Migrator.connect({
  uri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/my-db',
  autosync: true,
})

await migrator.run('down', 'old-migration')
await migrator.prune()

const migrations = await migrator.run('up')
for (const migration of migrations) {
  console.log('up:', migration.filename)
}

await migrator.close()
```

## NestJS

Import `MigrationModule` from `ts-migrate-mongoose/nest`:

```typescript
import { MigrationModule } from 'ts-migrate-mongoose/nest'

@Module({
  imports: [
    MigrationModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI'),
        autosync: true,
      }),
    }),
  ],
})
export class AppModule {}
```

For custom flow control, use the `onBootstrap` callback:

```typescript
MigrationModule.forRoot({
  uri: process.env.MONGO_URI,
  autosync: true,
  onBootstrap: async (migrator) => {
    await migrator.run('down', 'test')
    await migrator.prune()
    await migrator.run('up')
  },
})
```

## Additional Information

- **Error Handling**: Handle errors gracefully in your migration functions.
- **Testing Migrations**: Test your migrations in a staging environment.
- **Backup**: Always back up your database before running migrations.
