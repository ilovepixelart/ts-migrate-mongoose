# Example for CLI

After running `npm i ts-migrate-mongoose`, you will have the migration binary available to you as `./node_modules/.bin/migrate`.
You can run it with:

```bash
npx migrate <command> <options>
```

## Creating a migration

You can simply create a new migration (e.g. `my-new-migration`) by running

```bash
npx migrate <options> create my-new-migration
```

where `<options>` must at a MINIMUM contain the database url (using the `-d`/`--uri` option).

## Listing migrations

This shows you the migrations with their current states.

*down* means the migrations has not been run yet
*up* means the migration has run and won't be running again

```bash
npx migrate list <options>
```

## Running a migration (migrate up)

Let's say your `migrate list` command shows

```bash
up: 1450107140857-user-credit-to-vault.ts
up: 1452541801404-user-default-billing-to-default-billing-incoming.ts
up: 1461351953091-add_inventory.ts
down: 1463003345598-add_processed_credit_cards.ts
down: 1463603842010-add_default_regional_settings.ts
```

This means the first 3 migrations have run. You need to run the next 2 to be all up to date with the latest schema/data changes made by other developers.

simply run

```bash
npx migrate up add_default_regional_settings <options>
```

To migrate *up TO (and including)*  `1463603842010-add_default_regional_settings.ts`

Your new state will be

```bash
up: 1450107140857-user-credit-to-vault.ts
up: 1452541801404-user-default-billing-to-default-billing-incoming.ts
up: 1461351953091-add_inventory.ts
up: 1463003345598-add_processed_credit_cards.ts
up: 1463603842010-add_default_regional_settings.ts
```

## Undoing migrations (migrate down)

What if you want to undo the previous step?

Simply run

```bash
npx migrate down add_processed_credit_cards <options>
```

and you'll migrate *down TO (and including)* `1463003345598-add_processed_credit_cards.ts`

Your new state will be

```bash
up: 1450107140857-user-credit-to-vault.ts
up: 1452541801404-user-default-billing-to-default-billing-incoming.ts
up: 1461351953091-add_inventory.ts
down: 1463003345598-add_processed_credit_cards.ts
down: 1463603842010-add_default_regional_settings.ts
```

## Synchronizing your DB with new migrations

Lets say you `git pull` the latest changes from your project and someone had made a new migration called `add_unicorns` which adds much requested unicorns to your app.

Now, when you go run any migration command (e.g. `migrate list`), you are prompted with

```bash
? The following migrations exist in the migrations folder but not in the database.
Select the ones you want to import into the database (Press <space> to select)
❯◯ 1463003339853-add_unicorns.ts
```

This is telling you that someone added a migration file that's your database doesn't have yet.
If you select it by pressing **Space** then **Enter** on your keyboard, you can tell `ts-migrate-mongoose` to import it into the database.

Once imported, the default state is down so you'll have to `migrate up add_unicorns` to be all up-to-date.

**IF ON THE OTHER HAND** you don't want this migration, simply run

```bash
npx migrate prune
```

and you'll be prompted to remove it from the **FILE SYSTEM**.

## But what happens if I want to sync automatically instead of doing this every time?

just add the option `--autosync` and the migrate command will automatically import new migrations in your migrations folder before running commands.
