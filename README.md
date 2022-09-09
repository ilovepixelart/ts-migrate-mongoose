# ts-migrate-mongoose

A node/typescript based migration framework for mongoose

## Motivation

ts-migrate-mongoose is a migration framework for projects which are already using mongoose.

**Most other migration frameworks:**

- Use a local state file to keep track of which migrations have been run: This is a problem for PaS providers like heroku where the file system is wiped each time you deploy
- Not configurable enough: There are not a granular enough controls to manage which migrations get run
- Rely on a document-level migration: You have to change your application code to run a migration if it hasn't been run on a document you're working with

**ts-migrate-mongoose:**

- Stores migration state in MongoDB
- Provides plenty of features such as
  - Access to mongoose models in migrations
  - Use of promises or standard callbacks
  - custom config files or env variables for migration options
  - ability to delete unused migrations
- Relies on a simple *GLOBAL* state of whether or not each migration has been called

### Getting Started with the CLI

You can install it locally in your project

```bash
 npm install ts-migrate-mongoose
```

and then run

```bash
./node_modules/.bin/migrate [command] [options]
```

#### OR

Install it globally

```bash
 npm install -g ts-migrate-mongoose
```

and then run

```bash
migrate [command] [options]
```

### Usage

```bash
Usage: migrate -d <mongo-uri> [[create|up|down<migration-name>]|list|prune] [optional options]

Commands:
  list                     Lists all migrations and their current state.
  create <migration-name>  Creates a new migration file.
  up [migration-name]      Migrates all the migration files that have not yet
                           been run in chronological order. Not including
                           [migration-name] will run up on all migrations that
                           are in a down state.
  down <migration-name>    Rolls back all migrations down to given name (if down
                           function was provided)
  prune                    Allows you to delete extraneous migrations by
                           removing extraneous local migration files/database
                           migrations.
 
 
Options:
  -d, --connectionString   The URI of the database connection                           [string] [required]
  --collection            The mongo collection name to use for migrations [string] [default: "migrations"]
  --md, --migrations-dir  The path to the migration files               [string] [default: "./migrations"]
  -t, --template-file     The template file to use when creating a migration                      [string]
  -c, --change-dir        Change current working directory before running  anything               [string]
  --autosync              Automatically add any migrations on filesystem but not in db to db     [boolean]
                          rather than asking interactively (use in scripts)
  -h, --help              Show help                                                              [boolean]

 
 
Examples:
  node_modules/.bin/migrate list -d mongodb://localhost/migrations
  node_modules/.bin/migrate create add_users -d mongodb://localhost/migrations
  node_modules/.bin/migrate up add_user -d mongodb://localhost/migrations
  node_modules/.bin/migrate down delete_names -d mongodb://localhost/migrations
  node_modules/.bin/migrate prune -d mongodb://localhost/migrations
  node_modules/.bin/migrate list --config settings.json
```

### Setting Options Automatically

If you want to not provide the options such as `--connectionString` to the program every time you have 2 options.

#### 1. Set the option as an Environment Variable in two formats

- UPPERCASE

  ```bash
  export MIGRATE_CONNECTION_STRING=mongodb://localhost/migrations
  export MIGRATE_TEMPLATE_PATH=migrations/template.ts
  export MIGRATE_MIGRATIONS_PATH=migrations
  export MIGRATE_COLLECTION=migrations
  export MIGRATE_AUTOSYNC=true
  ```

- camelCase

  ```bash
  export migrateConnectionString=mongodb://localhost/migrations
  export migrateTemplatePath=migrations/template.ts
  export migrateMigrationsPath=migrations
  export migrateCollection=migrations
  export migrateAutosync=true
  ```

#### 2. Environment `.env` files are also supported. All variables will be read from the `.env` file and set by ts-migrate-mongoose

- UPPERCASE

  ```bash
  MIGRATE_CONNECTION_STRING=mongodb://localhost/migrations
  MIGRATE_TEMPLATE_PATH=migrations/template.ts
  MIGRATE_MIGRATIONS_PATH=migrations
  MIGRATE_COLLECTION=migrations
  MIGRATE_AUTOSYNC=true
  ```

- camelCase

  ```bash
  migrateConnectionString=mongodb://localhost/migrations
  migrateTemplatePath=migrations/template.ts
  migrateMigrationsPath=migrations
  migrateCollection=migrations
  migrateAutosync=true
  ```

#### 2. Provide a config file (defaults to *migrate.json* or *migrate.ts*)

```bash
# If you have migrate.ts/migrate.json in the directory, you don't need to do anything
migrate list
 
# Otherwise you can provide a config file
migrate list --config somePath/myCustomConfigFile[.json]
```

#### Options Override Order

Command line args *beat* Env vars *beats* Config File

Just make sure you don't have aliases of the same option with 2 different values between env vars and config file

### Migration Files

By default, ts-migrate-mongoose assumes your migration folder exists.

Here's an example of a migration created using `migrate create some-migration-name` . This example demonstrates how you can access your `mongoose` models and handle errors in your migrations

#### 1662715725041-first-migration-demo.ts

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

### Access to mongoose models in your migrations

Just go about your business as usual, importing your models and making changes to your database.

ts-migrate-mongoose makes an independent connection to MongoDB to fetch and write migration states and makes no assumptions about your database configurations or even prevent you from making changes to multiple or even non-mongo databases in your migrations. As long as you can import the references to your models you can use them in migrations.

Below is an example of a typical setup in a mongoose project

#### models/User.ts

```typescript
import { Schema, model } from 'mongoose'

interface IUser {
  firstName: string
  lastName: string
}

const UserSchema = new Schema<IUser>({
  firstName: String,
  lastName: String
})

export default model<IUser>('user', UserSchema)
```

#### Back to migration file 1662715725041-first-migration-demo.ts

```typescript
import User from '../models/User'

await async function up() {
  // Then you can use it in the migration like so  
  await User.create({ firstName: 'Ada', lastName: 'Lovelace' });
  
  // Or do something such as
  const users = await User.find();
  /* Do something with users */
}
```

If you're using the package programmatically. You can access your models using the connection you constructed the Migrator with through the `this` context.

```typescript
export async function up() {
  // "this('user')"  is the same as calling "connection.model('user')"
  // using the connection you passed to the Migrator constructor.
  await this('user').create({ firstName: 'Ada', lastName: 'Lovelace' });
}
```

### Notes

Currently, the **-d**/**connectionString**  must include the database to use for migrations in the uri.

example: `-d mongodb://localhost:27017/development` .

If you don't want to pass it in every time feel free to use the `migrate.json` config file or an environment variable

### Examples

Feel Free to check out the examples in the project to get a better idea of usage

### How to contribute

1. Start an issue. We will discuss the best approach
2. Make a pull request. I'll review it and comment until we are both confident about it
3. I'll merge your PR and bump the version of the package
