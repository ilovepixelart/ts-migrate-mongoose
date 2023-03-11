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

ts-migrate-mongoose is a migration framework for projects which are already using mongoose

## Features

- Stores migration state in MongoDB
- Flexibility in configuration `migrate.json` / `migrate.ts` or `.env`
- Ability to use mongoose models when running migrations
- Ability to use of async/await in migrations
- Ability to run migrations from the CLI
- Ability to run migrations programmatically
- Ability to prune old migrations, and sync new migrations
- Ability to create custom templates for migrations

## Installation

- Locally inside your project

```bash
yarn add ts-migrate-mongoose
npm install ts-migrate-mongoose
```

- Install it globally

```bash
yarn global add ts-migrate-mongoose
npm install -g ts-migrate-mongoose
```

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
MIGRATE_MONGO_URI=mongodb://localhost/my-db
MIGRATE_MONGO_COLLECTION=migrations
MIGRATE_CONFIG_PATH=./migrate
MIGRATE_MIGRATIONS_PATH=./migrations
MIGRATE_TEMPLATE_PATH=./migrations/template.ts
MIGRATE_AUTOSYNC=false
# or 
migrateMongoUri=mongodb://localhost/my-db
migrateMongoCollection=migrations
migrateConfigPath=./migrate
migrateMigrationsPath=./migrations
migrateTemplatePath=./migrations/template.ts
migrateAutosync=false
```

| Config file          | `.env` / export          | Default      | Required | Description                                      |
| -------------------- | ------------------------ | ------------ | -------- | ------------------------------------------------ |
| uri                  | MIGRATE_MONGO_URI        | -            | Yes      | mongo connection string                          |
| collection           | MIGRATE_MONGO_COLLECTION | migrations   | No       | collection name to use for the migrations        |
| configPath           | MIGRATE_CONFIG_PATH      | ./migrate    | No       | path to the config file                          |
| migrationsPath       | MIGRATE_MIGRATIONS_PATH  | ./migrations | No       | path to the migration files                      |
| templatePath         | MIGRATE_TEMPLATE_PATH    | -            | No       | template file to use when creating a migration   |
| autosync             | MIGRATE_AUTOSYNC         | false        | No       | automatically sync new migrations without prompt |

## Getting Started with the CLI

```bash
yarn migrate help
npx migrate help
```

```text
CLI migration tool for mongoose

Options:
  -f, --config-path <path>      path to the config file (default: "migrate")
  -d, --uri <string>            mongo connection string
  -c, --collection <string>     collection name to use for the migrations (default: "migrations")
  -a, --autosync <boolean>      automatically sync new migrations without prompt (default: false)
  -m, --migrations-path <path>  path to the migration files (default: "./migrations")
  -t, --template-path <path>    template file to use when creating a migration
  -h, --help                    display help for command

Commands:
  list                          list all migrations
  create <migration-name>       create a new migration file
  up [migration-name]           run all migrations or a specific migration if name provided
  down <migration-name>         roll back migrations down to given name
  prune                         delete extraneous migrations from migration folder or database
  help [command]                display help for command
```

- Examples yarn

```bash
yarn migrate list -d mongodb://localhost/my-db
yarn migrate create add_users -d mongodb://localhost/my-db
yarn migrate up add_user -d mongodb://localhost/my-db
yarn migrate down delete_names -d mongodb://localhost/my-db
yarn migrate prune -d mongodb://localhost/my-db
yarn migrate list --config settings.json
```

- Examples npm

```bash
npx migrate list -d mongodb://localhost/my-db
npx migrate create add_users -d mongodb://localhost/my-db
npx migrate up add_user -d mongodb://localhost/my-db
npx migrate down delete_names -d mongodb://localhost/my-db
npx migrate prune -d mongodb://localhost/my-db
npx migrate list --config settings.json
```

## Options Override Order

Note that options are overridden in the following order:

- Command line args > Env vars > Config file

## Migration Files

This example demonstrates how you can create a migration file using the CLI
\
By default, ts-migrate-mongoose assumes your migration folder exists (if it does not it will create one for you)

Here's an example of a migration created using:

```bash
yarn migrate create first-migration-demo
npx migrate create first-migration-demo
```

Executing the above command will create a migration file in the `./migrations` folder with the following content:

- 1673525773572-first-migration-demo.ts

```typescript
/* eslint-disable import/first */
// Orders is important, import your models bellow this two lines, NOT above
import mongoose from 'mongoose'
mongoose.set('strictQuery', false) // https://mongoosejs.com/docs/guide.html#strictQuery

// Import your models here

// Make any changes you need to make to the database here
export async function up () {
  await this.connect(mongoose)
  // Write migration here
}

// Make any changes that UNDO the up function side effects here (if possible)
export async function down () {
  await this.connect(mongoose)
  // Write migration here
}
```

## Using mongoose models in your migrations

As long as you can import the references to your models you can use them in migrations
\
Below is an example of a typical setup in a mongoose project:

- models/User.ts

```typescript
import { Schema, model } from 'mongoose'

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
    type: String,
    required: false
  }
})

export default model<IUser>('user', UserSchema)
```

- 1673525773572-first-migration-demo.ts

```typescript
/* eslint-disable import/first */
// Orders is important, import your models bellow this two lines, NOT above
import mongoose from 'mongoose'
mongoose.set('strictQuery', false) // https://mongoosejs.com/docs/guide.html#strictQuery

// Import your models here
import User from '../models/User'

// Make any changes you need to make to the database here
export async function up() {
  await this.connect(mongoose)
  // Then you can use it in the migration like so 
  await User.create({ firstName: 'John', lastName: 'Doe' })
  
  // Or do something such as
  const users = await User.find()
  /* Do something with users */
}
```

## Notes

- Currently, the `-d` or `--uri`  must include the database to use for migrations in the uri.
- Example: `-d mongodb://localhost:27017/development`
- If you don't want to pass it in every time feel free to use `migrate.ts` or `migrate.json` config file or an environment variable
- Feel Free to check out the `/examples` folder in the project to get a better idea of usage in Programmatic and CLI mode
