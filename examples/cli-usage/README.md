# Example for CLI

After running `npm i ts-migrate-mongoose`, you will have the migration binary available as `./node_modules/.bin/migrate`.
You can run it with:

```bash
npx migrate <command> <options>
```

## Creating a migration

Create a new migration (e.g., `add-users`) by running:

```bash
npx migrate <options> create add-users
```

where `<options>` must at a MINIMUM contain the database URL (using the `-d`/`--uri` option).

## Listing migrations

This shows you the migrations with their current states.

*down* means the migration has not been run yet.
*up* means the migration has run and won't be running again.

```bash
npx migrate list <options>
```

## Running a migration (migrate up)

Let's say your `migrate list` command shows:

```bash
up: 1735680000000-add-users.ts
up: 1735683600000-add-products.ts
up: 1735687200000-add-orders.ts
down: 1735690800000-add-payments.ts
down: 1735694400000-add-reviews.ts
```

This means the first 3 migrations have run. To run the next 2 and be up to date with the latest schema/data changes made by other developers, simply run:

```bash
npx migrate up add-reviews <options>
```

Your new state will be:

```bash
up: 1735680000000-add-users.ts
up: 1735683600000-add-products.ts
up: 1735687200000-add-orders.ts
up: 1735690800000-add-payments.ts
up: 1735694400000-add-reviews.ts
```

## Undoing migrations (migrate down)

To undo the previous step, simply run:

```bash
npx migrate down add-payments <options>
```

Your new state will be:

```bash
up: 1735680000000-add-users.ts
up: 1735683600000-add-products.ts
up: 1735687200000-add-orders.ts
down: 1735690800000-add-payments.ts
down: 1735694400000-add-reviews.ts
```

## Synchronizing your DB with new migrations

Let's say you `git pull` the latest changes from your project and someone had made a new migration called `add-analytics`.

When you run any migration command (e.g., `migrate list`), you are prompted with:

```bash
? The following migrations exist in the migrations folder but not in the database.
Select the ones you want to import into the database (Press <space> to select)
❯◯ 1735698000000-add-analytics.ts
```

This indicates that someone added a migration file that your database doesn't have yet.
If you select it by pressing **Space** then **Enter**, you can import it into the database.

Once imported, the default state is down, so you'll have to `migrate up add-analytics` to be up to date.

To remove it from the file system, simply run:

```bash
npx migrate prune
```

## Automatically syncing migrations

To sync automatically instead of doing this every time, add the `--autosync` option, and the migrate command will automatically import new migrations in your migrations folder before running commands.

## Additional Information

- **CLI Options**: Use the `--help` option to see all available commands and options.
