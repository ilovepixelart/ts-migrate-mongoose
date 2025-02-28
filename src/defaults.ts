/**
 * Default configuration values for the migration tool.
 * @constant
 * @type {object}
 * @property {string} MIGRATE_CONFIG_PATH - The default path to the migration configuration file.
 * @property {string} MIGRATE_MONGO_COLLECTION - The default name of the MongoDB collection for migrations.
 * @property {string} MIGRATE_MIGRATIONS_PATH - The default path to the migrations directory.
 * @property {boolean} MIGRATE_AUTOSYNC - Whether to automatically sync migrations without prompting.
 * @property {boolean} MIGRATE_CLI - Whether the migration tool is running in CLI mode.
 */
export const defaults = {
  MIGRATE_CONFIG_PATH: './migrate',
  MIGRATE_MONGO_COLLECTION: 'migrations',
  MIGRATE_MIGRATIONS_PATH: './migrations',
  MIGRATE_AUTOSYNC: false,
  MIGRATE_CLI: false,
} as const
