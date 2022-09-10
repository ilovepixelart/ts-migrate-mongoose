# Example of using a config file

By using a config file (`migrate.ts` or `migrate.json`), you can skip providing the options to the CLI command every time.

Fot demo purposes `migrate.ts` or `migrate.json` files were provided but you need you use only one

Now instead of running this command to create a new migration

Directory in this example is **not** the default `./migrations` but `./my-custom/migrations`.

```bash
# If you use yarn
yarn migrate --migrationsDir my-custom/migrations -d mongodb://localhost/my-db create my_new_migration
# If you use npm
npm exec migrate --migrationsDir my-custom/migrations -d mongodb://localhost/my-db create my_new_migration
```

We can simply run

```bash
# If you use yarn
yarn migrate create my_new_migration
# If you use npm
npm exec migrate create my_new_migration
```

You can change the name of the config file to expect by providing the `config` option e.g. `--config custom_config_file_name.json`
Note that this file has to be a valid `JSON` or `TypeScript` file with default export.

**Override Order:**

1. Command line args
2. Config file
3. Env var

With lower number taking precedence (winning).
