# Example of using a config file

by using a config file (`migrate.ts` or `migrate.json` by default), you can skip providing the options to the CLI command every time.

Now instead of running this command to create a new migration

```bash
./node_modules/.bin/migrate --migrationsDir db/migrations -d mongodb://localhost/db-dev create my_new_migration
```

we can simply run

```bash
./node_modules/.bin/migrate create my_new_migration
```

**NOTE** that migrations directory is **not** the default `./migrations` in this example

You can change the name of the config file to expect by providing the `config` option e.g. `--config some_other_config_file_name.json`. Note that this file has to be a valid JSON file.

**Override Order:**

1. Command line args
2. Config file
3. Env var

With lower number taking precedence (winning).
