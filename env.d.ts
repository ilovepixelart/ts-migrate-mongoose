// <project_root>/index.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    MIGRATE_MODE: string
    MIGRATE_CONFIG_PATH: string
    MIGRATE_MONGO_URI: string
    MIGRATE_MONGO_COLLECTION: string
    MIGRATE_MIGRATIONS_PATH: string
    MIGRATE_TEMPLATE_PATH: string
    MIGRATE_AUTOSYNC: string
    // For weirdos who need camelCase
    migrateMode: string
    migrateConfigPath: string
    migrateMongoUri: string
    migrateMongoCollection: string
    migrateMigrationsPath: string
    migrateTemplatePath: string
    migrateAutosync: string
  }
}