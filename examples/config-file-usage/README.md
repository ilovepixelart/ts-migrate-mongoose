# Example of using a config file

By using a config file `migrate.ts` or `migrate.json`, you can skip providing the options to the CLI command every time.

For demo purposes, both `migrate.ts` and `migrate.json` files are provided, but you need to use only one.

Instead of running this command to create a new migration:

```bash
npx migrate create add-users-collection -d mongodb://localhost/my-db
```

You can simply run:

```bash
npx migrate create add-users-collection
```

You can change the name of the config file to expect by providing the `--config` option, e.g., `--config custom-config-file-name.json`.
Note that this file has to be a valid `JSON` or `TypeScript` file with a default export.

## Options override order

Options are overridden in the following order:

- Command line args > Env vars > Config file

## Additional Information

- **Config File Location**: Store your config file in a secure location.
- **Environment Variables**: Use environment variables to override config file settings.
- **Validation**: Validate your config file to ensure all required options are provided.
