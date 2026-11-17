# ts-migrate-mongoose

A migration framework for Mongoose, built with TypeScript.

[![npm](https://img.shields.io/npm/v/ts-migrate-mongoose)](https://www.npmjs.com/package/ts-migrate-mongoose)
[![npm](https://img.shields.io/npm/dt/ts-migrate-mongoose)](https://www.npmjs.com/package/ts-migrate-mongoose)
[![GitHub](https://img.shields.io/github/license/ilovepixelart/ts-migrate-mongoose)](https://github.com/ilovepixelart/ts-migrate-mongoose/blob/main/LICENSE)
\
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=ilovepixelart_ts-migrate-mongoose&metric=coverage)](https://sonarcloud.io/summary/new_code?id=ilovepixelart_ts-migrate-mongoose)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=ilovepixelart_ts-migrate-mongoose&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=ilovepixelart_ts-migrate-mongoose)
\
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=ilovepixelart_ts-migrate-mongoose&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=ilovepixelart_ts-migrate-mongoose)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=ilovepixelart_ts-migrate-mongoose&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=ilovepixelart_ts-migrate-mongoose)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=ilovepixelart_ts-migrate-mongoose&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=ilovepixelart_ts-migrate-mongoose)
\
[![Socket Badge](https://badge.socket.dev/npm/package/ts-migrate-mongoose)](https://socket.dev/npm/package/ts-migrate-mongoose)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/ilovepixelart/ts-migrate-mongoose/badge)](https://securityscorecards.dev/viewer/?uri=github.com/ilovepixelart/ts-migrate-mongoose)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12477/badge)](https://www.bestpractices.dev/en/projects/12477)

## Motivation

ts-migrate-mongoose is a migration framework for mongoose
\
I need a way to manage database migrations for mongoose models, run them from the CLI or programmatically, and keep track of which migrations have been applied. It should support both ESM and CommonJS, work with all major Node.js frameworks, and be flexible enough to handle complex migration scenarios.

## Supports and tested with

```json
{
  "node": ">=20",
  "mongoose": ">=6.6.0 <10"
}
```

CI tests on Node.js `22.x` and `24.x` against mongoose `6.12.2`, `7.6.4`, `8.23.0`, and `9.4.1`, and on `26.x` with the mongoose version the lockfile pins.

## Features

- Stores migration state in MongoDB
- Flexible configuration using `migrate.json`, `migrate.ts`, `.env`
- Utilizes mongoose models during migrations
- Supports async/await in migrations
- Run migrations from the CLI or programmatically
- Prune old migrations and sync new migrations
- Create custom templates for migrations
- Run individual migration up/down using -s, --single
- Migration lock: processes started together (parallel deploy jobs, NestJS replicas) run each migration once
- Supports ESM and CommonJS

## Installation

`mongoose` is a peer dependency: install it alongside `ts-migrate-mongoose`.

```bash
npm install ts-migrate-mongoose mongoose
pnpm add ts-migrate-mongoose mongoose
yarn add ts-migrate-mongoose mongoose
bun add ts-migrate-mongoose mongoose
```

Or globally:

```bash
npm install -g ts-migrate-mongoose mongoose
pnpm add -g ts-migrate-mongoose mongoose
yarn global add ts-migrate-mongoose mongoose
bun add -g ts-migrate-mongoose mongoose
```

## Example

Works with any Node.js framework: Express, Fastify, Koa, Hono, Nest, etc.
\
How to use it with:

- Express: [ts-express-tsx](https://github.com/ilovepixelart/ts-express-tsx), [ts-express-esbuild](https://github.com/ilovepixelart/ts-express-esbuild)
- Nest: [ts-express-nest](https://github.com/ilovepixelart/ts-express-nest)

## Migrations and alias imports

If you are using alias imports in your project, you can use `tsconfig.json` paths to resolve them for your project.

## Configuration

If you don't want to provide `-d` or `--uri` flag in CLI or Programmatic mode, you can configure it.
\
Create a `migrate.json` or `migrate.ts` or `.env` file in the root of your project:

- `migrate.json`

```json
{
  "uri": "mongodb://localhost/my-db",
  "collection": "migrations",
  "migrationsPath": "./migrations",
  "templatePath": "./migrations/template.ts",
  "autosync": false
}
```

- `migrate.ts`

```typescript
export default {
  uri: "mongodb://localhost/my-db",
  collection: "migrations",
  migrationsPath: "./migrations",
  templatePath: "./migrations/template.ts",
  autosync: false,
  connectOptions: {
    autoIndex: true,
  },
};
```

- `.env`

```bash
# You can set this variable or in your CI/CD pipeline
# Or use --mode flag in CLI mode to switch between .env files
MIGRATE_MODE=development
```

If mode is set, it will look for `.env.[mode]` file in the root of your project
\
For example, if `MIGRATE_MODE=development` it will look for `.env.development` file
\
If mode is not set, it will look for `.env` file in the root of your project

```bash
.env                # loaded in all cases
.env.local          # loaded in all cases (used as override for local development)
.env.[mode]         # only loaded in specified mode
.env.[mode].local   # only loaded in specified mode (used as override for local development)
```

```bash
# Example .env file content
MIGRATE_MONGO_URI=mongodb://localhost/my-db
MIGRATE_MONGO_COLLECTION=migrations
MIGRATE_CONFIG_PATH=./migrate
MIGRATE_MIGRATIONS_PATH=./migrations
MIGRATE_TEMPLATE_PATH=./migrations/template.ts
MIGRATE_AUTOSYNC=false
MIGRATE_LOCK=true
MIGRATE_LOCK_TIMEOUT=300000
MIGRATE_LOCK_COLLECTION=migrations_lock
```

| Config file          | `.env` / export          | Default      | Required | Description                                      |
| -------------------- | ------------------------ | ------------ | -------- | ------------------------------------------------ |
| mode                 | MIGRATE_MODE             | -            | No       | environment mode to use .env.[mode] file         |
| uri                  | MIGRATE_MONGO_URI        | -            | Yes      | mongo connection string                          |
| collection           | MIGRATE_MONGO_COLLECTION | migrations   | No       | collection name to use for the migrations        |
| configPath           | MIGRATE_CONFIG_PATH      | -            | No       | will lookup ./migrate[.ts,.js,.json] in root     |
| migrationsPath       | MIGRATE_MIGRATIONS_PATH  | ./migrations | No       | path to the migration files                      |
| templatePath         | MIGRATE_TEMPLATE_PATH    | -            | No       | template file to use when creating a migration   |
| autosync             | MIGRATE_AUTOSYNC         | false        | No       | automatically sync new migrations without prompt |
| lock                 | MIGRATE_LOCK             | true         | No       | take the migration lock, see [Migration lock](#migration-lock) |
| lockTimeout          | MIGRATE_LOCK_TIMEOUT     | 300000       | No       | milliseconds to wait for another process to release the lock |
| lockCollection       | MIGRATE_LOCK_COLLECTION  | `<collection>_lock` | No | collection that holds the lock               |
| connectOptions       | -                        | -            | No       | mongoose connection options (config file only)   |

## Getting started with the CLI

Explore and learn commands, rest of the tutorial will be using npm

```bash
npx migrate -h
pnpm migrate -h
yarn migrate -h
bun migrate -h
```

```text
CLI migration tool for mongoose

Usage: migrate <command> [options]

Commands:
  list                       list all migrations
  create <migration-name>    create a new migration file
  up [migration-name]        run all migrations or a specific migration if name provided
  down <migration-name>      roll back migrations down to given name
  prune                      delete extraneous migrations from migration folder or database

Options:
  -f, --config-path <path>        path to the config file
  -d, --uri <string>              mongo connection string
  -c, --collection <string>       collection name to use for the migrations
  -a, --autosync <boolean>        automatically sync new migrations without prompt
  -m, --migrations-path <path>    path to the migration files
  -t, --template-path <path>      template file to use when creating a migration
      --mode <string>             environment mode to use .env.[mode] file
      --lock <boolean>            take the migration lock before changing migration state (default true)
      --lock-timeout <ms>         how long to wait for another process to release the lock (default 300000)
      --lock-collection <name>    collection that holds the lock (default <collection>_lock)
  -s, --single                    run single migration (up/down only)
  -h, --help                      display help
  -v, --version                   display version
```

Before you start make sure you setup .env file or migrate.ts/json file so you don't need to provide -d on each command

```bash
npx migrate create add-users -d mongodb://localhost/my-db
```

In case you want to run just one migration up or down use option --single

```bash
npx migrate create first-migration
npx migrate create second-migration
npx migrate list
npx migrate up second-migration -s # will migrate up only second-migration
npx migrate down second-migration -s # will migrate down only second-migration
npx migrate up -s # will migrate up first-migration
```

## Options override order

Note that options are overridden in the following order:

- Command line args > Env vars > Config file

## Migration lock

`up`, `down`, `create`, `prune`, `sync` and `list` (when it has new files to import) take a lock in MongoDB before they change migration state. When several processes start at once, such as parallel deploy jobs or NestJS replicas that all migrate on bootstrap, one runs the pending migrations and the others wait, then re-read the state and skip what is already applied. A process with no competition takes the lock immediately and does not wait.

- The lock is one document per migrations collection in `<collection>_lock` (for the default collection, `migrations_lock`). It records the holder (`host:pid:id`), when it was taken, and when its lease expires. The holder renews the 60 second lease every 20 seconds and removes the document when it finishes.
- A waiting process retries every 500 ms for up to `lockTimeout` milliseconds (default 300000, 5 minutes), then fails with an error naming the holder. `lockTimeout: 0` fails at once instead of waiting. In NestJS that error fails the bootstrap.
- If a holder crashes, its lock expires one lease (at most 60 seconds) after its last renewal and the next process takes it over. A TTL index on `expiresAt` also removes the leftover document. To clear a stale lock sooner, run the command printed in the timeout error, for example `db.getCollection("migrations_lock").deleteOne({ _id: "migrations" })`.
- The lease is renewed by a timer, so a migration that blocks the event loop (synchronous work, no `await`) for more than 60 seconds can lose the lock to a waiting process. The holder then stops before its next migration with an error instead of running alongside the new holder. Expiry compares clocks across hosts, so keep them in sync (NTP).
- `list` without new files to import only reads, so a status check does not wait behind a running migration.
- The lock needs read and write access to the lock collection; creating the TTL index is attempted and skipped if not permitted. Set `lock: false` (`--lock false`, `MIGRATE_LOCK=false`) to run without the lock, as in 5.4.0 and earlier, if your database user cannot write to that collection or you already serialize migrations yourself.

Databases used by earlier versions with concurrent runs can hold two state documents for the same migration file. `up` and `down` run such a file once, and the CLI prints `Found 2 state documents for <file>; running it once`. Both documents are kept; delete the extra one yourself if you want `list` to show it once.

## Migration files

This example demonstrates how you can create a migration file using the CLI
\
By default, ts-migrate-mongoose assumes your migration folder exists (if it does not it will create one for you)

Here's an example of a migration created using:

```bash
npx migrate create first-migration
pnpm migrate create first-migration
yarn migrate create first-migration
bun migrate create first-migration
```

Executing the above command will create a migration file in the `./migrations` folder with the following content:

- 1673525773572-first-migration.ts

```typescript
// Import your schemas here
import type { Connection } from 'mongoose'

export async function up (connection: Connection): Promise<void> {
  // Write migration here
}

export async function down (connection: Connection): Promise<void> {
  // Write migration here
}
```

## Using mongoose models in your migrations

As long as you can import the references to your models you can use them in migrations
\
Below is an example of a typical setup in a mongoose project:

- models/User.ts - defines the User model

```typescript
import { Schema, model, models } from 'mongoose'

interface IUser {
  firstName: string
  lastName?: string
}

export const UserSchema = new Schema<IUser>({
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String
  }
})

export default models.User ?? model<IUser>('User', UserSchema)
```

- 1673525773572-first-migration-demo.ts - your migration file

```typescript
import { UserSchema } from '../models/User'
import type { Connection } from 'mongoose'

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
```

## Programmatic mode

Works with any Node.js framework: Express, Fastify, Koa, Hono, etc:

```typescript
import { Migrator } from 'ts-migrate-mongoose'

const migrator = await Migrator.connect({
  uri: 'mongodb://localhost:27017/my-db',
  autosync: true,
})

await migrator.run('up')        // Run all pending migrations
await migrator.run('down', 'x') // Roll back a specific migration
await migrator.list()           // List all migrations and their status
await migrator.create('name')   // Create a new migration file
await migrator.prune()          // Remove orphaned migrations from DB
await migrator.close()          // Close the connection
```

### Express / Fastify / Koa / Hono

```typescript
import { Migrator } from 'ts-migrate-mongoose'

// Run before starting your server
const migrator = await Migrator.connect({
  uri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/my-db',
  autosync: true,
})
await migrator.run('up')
await migrator.close()

// Start your server
app.listen(3000)
```

### NestJS (because it's special)

Import `MigrationModule` from `ts-migrate-mongoose/nest`:

```typescript
import { MigrationModule } from 'ts-migrate-mongoose/nest'

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGO_URI),
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

Runs all pending up migrations on application bootstrap. Replicas that start together take turns through the [migration lock](#migration-lock), so each migration runs once. For custom control:

```typescript
MigrationModule.forRoot({
  uri: process.env.MONGO_URI,
  onBootstrap: async (migrator) => {
    await migrator.run('down', 'test')
    await migrator.prune()
    await migrator.run('up')
  },
})
```

See [programmatic usage examples](/examples/programmatic-usage) for the full API and more examples.

## Contributing

Check [CONTRIBUTING.md](CONTRIBUTING.md)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

## Notes

- Currently, the `-d` or `--uri` must include the database to use for migrations in the uri.
- Example: `-d mongodb://localhost:27017/development`
- If you don't want to pass it every time feel free to use `migrate.ts` or `migrate.json` config file or an environment variable
- Feel Free to check out the `/examples` folder in the project to get a better idea of usage in Programmatic and CLI mode

## Check my other projects

- [ts-patch-mongoose](https://github.com/ilovepixelart/ts-patch-mongoose) - Patch history & events plugin for mongoose
- [ts-cache-mongoose](https://github.com/ilovepixelart/ts-cache-mongoose) - Cache plugin for mongoose Queries and Aggregate (in-memory, redis)
