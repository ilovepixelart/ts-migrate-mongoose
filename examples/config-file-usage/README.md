# Example of using a config file

By using a config file (`migrate.ts` or `migrate.json`), you can skip providing the options to the CLI command every time.

Fot demo purposes `migrate.ts` or `migrate.json` files were provided but you need you use only one

Now instead of running this command to create a new migration

Directory in this example is **not** the default `./migrations` but `./my-custom/migrations`.

```bash
yarn migrate -m my-custom/migrations -d mongodb://localhost/my-db create my-new-migration
npx migrate -m my-custom/migrations -d mongodb://localhost/my-db create my-new-migration
```

We can simply run

```bash
yarn migrate create my-new-migration
npx migrate create my-new-migration
```

You can change the name of the config file to expect by providing the `config` option e.g. `--config custom-config-file-name.json`
Note that this file has to be a valid `JSON` or `TypeScript` file with default export.

## Options Override Order

Note that options are overridden in the following order:

- Command line args > Env vars > Config file
