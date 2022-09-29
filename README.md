# ts-migrate-mongoose

A node, typescript based migration framework for mongoose

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

**Most other migration frameworks:**

- Use a local state file to keep track of which migrations have been run: This is a problem for PaS providers like heroku where the file system is wiped each time you deploy
- Not configurable enough: There are not a granular enough controls to manage which migrations get run
- Rely on a document-level migration: You have to change your application code to run a migration if it hasn't been run on a document you're working with

**ts-migrate-mongoose:**

- Stores migration state in MongoDB
- Provides plenty of features such as
  - Access to mongoose models in migrations
  - Use of promises
  - Custom config files `migrate.json` / `migrate.ts` or `.env` file for migration options
  - Ability to delete unused migrations
- Relies on a simple *GLOBAL* state of whether or not each migration has been called

## Getting Started with the CLI

- Locally inside your project

```bash
npm install ts-migrate-mongoose
npm exec migrate [command] [options]
# or
yarn add ts-migrate-mongoose
yarn migrate [command] [options]
```

- Install it globally

```bash
npm install -g ts-migrate-mongoose
migrate [command] [options]
# or
yarn global add ts-migrate-mongoose
migrate [command] [options]
```

- Full details about commands and options can be found by running

```bash
yarn migrate help
# or
npm exec migrate help
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
  -cd, --change-dir <path>      change current working directory before running anything
  -h, --help                    display help for command

Commands:
  list                          list all migrations
  create <migration-name>       create a new migration file
  up [migration-name]           run all migrations or a specific migration if name provided
  down <migration-name>         roll back migrations down to given name
  prune                         delete extraneous migrations from migration folder or database
  help [command]                display help for command
```

- More examples

```bash
yarn migrate list -d mongodb://localhost/my-db
yarn migrate create add_users -d mongodb://localhost/my-db
yarn migrate up add_user -d mongodb://localhost/my-db
yarn migrate down delete_names -d mongodb://localhost/my-db
yarn migrate prune -d mongodb://localhost/my-db
yarn migrate list --config settings.json
# or 
npm exec migrate list -d mongodb://localhost/my-db
npm exec migrate create add_users -d mongodb://localhost/my-db
npm exec migrate up add_user -d mongodb://localhost/my-db
npm exec migrate down delete_names -d mongodb://localhost/my-db
npm exec migrate prune -d mongodb://localhost/my-db
npm exec migrate list --config settings.json
```

## Setting Options Automatically

If you don't want to provide `-d --uri` to the program every time you have 2 options.

### 1. Set the options using environment variables in two formats

  ```bash
  export MIGRATE_MONGO_URI=mongodb://localhost/my-db
  export MIGRATE_MONGO_COLLECTION=migrations
  export MIGRATE_MIGRATIONS_PATH=migrations
  export MIGRATE_TEMPLATE_PATH=migrations/template.ts
  export MIGRATE_AUTOSYNC=true
  # or 
  export migrateMongoUri=mongodb://localhost/my-db
  export migrateMongoCollection=migrations
  export migrateMigrationsPath=migrations
  export migrateTemplatePath=migrations/template.ts
  export migrateAutosync=true
  ```

### 2. Environment `.env` files are also supported. All variables will be read from the `.env` file and set by ts-migrate-mongoose

  ```bash
  MIGRATE_MONGO_URI=mongodb://localhost/my-db
  ...
  # or 
  migrateMongoUri=mongodb://localhost/my-db
  ...
  ```

### 3. Provide a config file (defaults to *migrate.json* or *migrate.ts*)

```bash
# If you have migrate.ts or migrate.json in the directory, you don't need to do anything
yarn migrate list
# or
npm exec migrate list
 
# Otherwise you can provide a config file
yarn migrate list --config somePath/myCustomConfigFile[.json]
# or
npm exec migrate list --config somePath/myCustomConfigFile[.json]
```

## Options Override Order

Command line args *beat* Env vars *beats* Config File

Just make sure you don't have aliases of the same option with 2 different values between env vars and config file

## Migration Files

By default, ts-migrate-mongoose assumes your migration folder exists.

Here's an example of a migration created using `migrate create some-migration-name` . This example demonstrates how you can access your `mongoose` models and handle errors in your migrations

- 1662715725041-first-migration-demo.ts

```typescript
/**
 * Make any changes you need to make to the database here
 */
export async function up () {
  // Write migration here
}

/**
 * Make any changes that UNDO the up function side effects here (if possible)
 */
export async function down () {
  // Write migration here
}
```

## Access to mongoose models in your migrations

Just go about your business as usual, importing your models and making changes to your database.

ts-migrate-mongoose makes an independent connection to MongoDB to fetch and write migration states and makes no assumptions about your database configurations or even prevent you from making changes to multiple or even non-mongo databases in your migrations. As long as you can import the references to your models you can use them in migrations.

Below is an example of a typical setup in a mongoose project

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

- 1662715725041-first-migration-demo.ts

```typescript
import User from '../models/User'

export async function up() {
  // Then you can use it in the migration like so  
  await User.create({ firstName: 'Ada', lastName: 'Lovelace' })
  
  // Or do something such as
  const users = await User.find()
  /* Do something with users */
}
```

## Notes

Currently, the **-d**/**uri**  must include the database to use for migrations in the uri.

example: `-d mongodb://localhost:27017/development` .

If you don't want to pass it in every time feel free to use the `migrate.json` config file or an environment variable

Feel Free to check out the examples in the project to get a better idea of usage

## How to contribute

1. Start an issue. We will discuss the best approach
2. Make a pull request. I'll review it and comment until we are both confident about it
3. I'll merge your PR and bump the version of the package
