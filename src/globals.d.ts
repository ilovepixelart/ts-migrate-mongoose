declare namespace NodeJS {
  interface ProcessEnv {
    MIGRATE_MODE?: string
    MIGRATE_CONFIG_PATH?: string
    MIGRATE_MONGO_URI?: string
    MIGRATE_MONGO_COLLECTION?: string
    MIGRATE_MIGRATIONS_PATH?: string
    MIGRATE_TEMPLATE_PATH?: string
    MIGRATE_AUTOSYNC?: string
  }
}

declare module 'tsx'
