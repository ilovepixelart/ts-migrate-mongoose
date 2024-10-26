# ts-migrate-mongoose

A node/typescript based migration framework for mongoose

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

[![npm](https://nodei.co/npm/ts-migrate-mongoose.png)](https://www.npmjs.com/package/ts-migrate-mongoose)

## Motivation

ts-migrate-mongoose is a migration framework for projects that are already using mongoose

## Features

- [x] Stores migration state in MongoDB
- [x] Flexibility in configuration `migrate.json` or `migrate.ts` or `.env` and/or `.env.local`
- [x] Use mongoose models when running migrations
- [x] Use async/await in migrations
- [x] Run migrations from the CLI
- [x] Run migrations programmatically
- [x] Prune old migrations, and sync new migrations
- [x] Create custom templates for migrations
- [x] Run individual migration up/down using -s, --single
- [x] Supports CommonJS

## Example

How to use it with:

- Express: [ts-express-swc](https://github.com/ilovepixelart/ts-express-swc), [ts-express-esbuild](https://github.com/ilovepixelart/ts-express-esbuild)
- Nest: [ts-express-nest](https://github.com/ilovepixelart/ts-express-nest)

## Installation

- Locally inside your project

```bash
npm install ts-migrate-mongoose
pnpm add ts-migrate-mongoose
yarn add ts-migrate-mongoose
bun add ts-migrate-mongoose
```

- Install it globally

```bash
npm install -g ts-migrate-mongoose
pnpm add -g ts-migrate-mongoose
yarn global add ts-migrate-mongoose
bun add -g ts-migrate-mongoose
```

## Migrations and alias imports

If you are using alias imports in your project, you can use `tsconfig.json` paths to resolve them for you project.
\
But `ts-migrate-mongoose` uses `swc` to compile the migrations internally, so you also need to add `.swcrc` file to project root
\
Starting from `"@swc/core": "1.3.74"`, you need to use `target` or `env` not both, in example bellow we use `"target": "es2021"`

```json
{
  "jsc": {
    "parser": {
      "syntax": "typescript",
      "decorators": true,
      "dynamicImport": true
    },
    "target": "es2021",
    "keepClassNames": true,
    "loose": true,
    // Important part bellow, copy it from your tsconfig.json
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
    // Important part above, copy it from your tsconfig.json
  },
  "module": {
    "type": "commonjs"
  },
  "sourceMaps": true
}
```

Now your migrations will be compiled with `swc` and you can use alias imports in your migrations.

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
# or 
migrateMode=development
migrateMongoUri=mongodb://localhost/my-db
migrateMongoCollection=migrations
migrateConfigPath=./migrate
migrateMigrationsPath=./migrations
migrateTemplatePath=./migrations/template.ts
migrateAutosync=false
```

| Config file          | `.env` / export          | Default      | Required | Description                                      |
| -------------------- | ------------------------ | ------------ | -------- | ------------------------------------------------ |
| mode                 | MIGRATE_MODE             | -            | No       | environment mode to use .env.[mode] file         |
| uri                  | MIGRATE_MONGO_URI        | -            | Yes      | mongo connection string                          |
| collection           | MIGRATE_MONGO_COLLECTION | migrations   | No       | collection name to use for the migrations        |
| configPath           | MIGRATE_CONFIG_PATH      | ./migrate    | No       | path to the config file                          |
| migrationsPath       | MIGRATE_MIGRATIONS_PATH  | ./migrations | No       | path to the migration files                      |
| templatePath         | MIGRATE_TEMPLATE_PATH    | -            | No       | template file to use when creating a migration   |
| autosync             | MIGRATE_AUTOSYNC         | false        | No       | automatically sync new migrations without prompt |

## Getting started with the CLI

Explore and lear commands, rest of the tutorial will be using npm

```bash
npx migrate -h
pnpm migrate -h
yarn migrate -h
bun run migrate -h
```

```text
CLI migration tool for mongoose

Options:
  -f, --config-path <path>         path to the config file
  -d, --uri <string>               mongo connection string
  -c, --collection <string>        collection name to use for the migrations
  -a, --autosync <boolean>         automatically sync new migrations without prompt
  -m, --migrations-path <path>     path to the migration files
  -t, --template-path <path>       template file to use when creating a migration
  --mode <string>                  environment mode to use .env.[mode] file
  -h, --help                       display help for command

Commands:
  list                             list all migrations
  create <migration-name>          create a new migration file
  up [options] [migration-name]    run all migrations or a specific migration if name is provided
  down [options] <migration-name>  roll back migrations down to given name
  prune                            delete extraneous migrations from migration folder or database
  help [command]                   display help for command
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

## Migration files

This example demonstrates how you can create a migration file using the CLI
\
By default, ts-migrate-mongoose assumes your migration folder exists (if it does not it will create one for you)

Here's an example of a migration created using:

```bash
npx migrate create first-migration
pnpm migrate create first-migration
yarn migrate create first-migration
bun run migrate create first-migration
```

Executing the above command will create a migration file in the `./migrations` folder with the following content:

- 1673525773572-first-migration.ts

```typescript
// Import your models here

export async function up (): Promise<void> {
  // Write migration here
}

export async function down (): Promise<void> {
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

const UserSchema = new Schema<IUser>({
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

- models/index.ts - ensures that all models are exported and you establish a connection to the database

```typescript
import mongoose from 'mongoose'
import mongooseOptions from '../options/mongoose'

import User from './User'

const getModels = async () => {
  // In case you using mongoose 6
  // https://mongoosejs.com/docs/guide.html#strictQuery
  mongoose.set('strictQuery', false)

  // Ensure connection is open so we can run migrations
  await mongoose.connect(process.env.MIGRATE_MONGO_URI ?? 'mongodb://localhost/my-db', mongooseOptions)

  // Return models that will be used in migration methods
  return {
    mongoose,
    User
  }
}

export default getModels
```

- 1673525773572-first-migration-demo.ts - your migration file

```typescript
import getModels from '../models'

export async function up () {
  const { User } = await getModels()
  // Write migration here
  await User.create([
    {
      firstName: 'John',
      lastName: 'Doe'
    },
    {
      firstName: 'Jane',
      lastName: 'Doe'
    }
  ])
}

export async function down () {
  const { User } = await getModels()
  // Write migration here
  await User.deleteMany({ firstName: { $in: ['Jane', 'John'] } }).exec()
}
```

## Notes

- Currently, the `-d` or `--uri` must include the database to use for migrations in the uri.
- Example: `-d mongodb://localhost:27017/development`
- If you don't want to pass it every time feel free to use `migrate.ts` or `migrate.json` config file or an environment variable
- Feel Free to check out the `/examples` folder in the project to get a better idea of usage in Programmatic and CLI mode

## Check my other projects

- [ts-patch-mongoose](https://github.com/ilovepixelart/ts-patch-mongoose) - Patch history & events plugin for mongoose
- [ts-cache-mongoose](https://github.com/ilovepixelart/ts-cache-mongoose) - Cache plugin for mongoose Queries and Aggregate (in-memory, redis)
