// <project_root>/index.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    MIGRATE_MODE: string | undefined
    MIGRATE_CONFIG_PATH: string | undefined
    MIGRATE_MONGO_URI: string | undefined
    MIGRATE_MONGO_COLLECTION: string | undefined
    MIGRATE_MIGRATIONS_PATH: string | undefined
    MIGRATE_TEMPLATE_PATH: string | undefined
    MIGRATE_AUTOSYNC: 'true' | undefined
  }
}
