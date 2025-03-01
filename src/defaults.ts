/**
 * Default configuration values for the migration tool.
 */
export const defaults = {
  MIGRATE_CONFIG_PATH: './migrate',
  MIGRATE_MONGO_COLLECTION: 'migrations',
  MIGRATE_MIGRATIONS_PATH: './migrations',
  MIGRATE_AUTOSYNC: false,
  MIGRATE_CLI: false,
} as const
