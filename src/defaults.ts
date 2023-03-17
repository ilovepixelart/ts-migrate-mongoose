import path from 'path'

export const DEFAULT_MIGRATE_CONFIG_PATH = './migrate'
export const DEFAULT_MIGRATE_MONGO_COLLECTION = 'migrations'
export const DEFAULT_MIGRATE_MIGRATIONS_PATH = './migrations'
export const DEFAULT_MIGRATE_TEMPLATE_PATH = path.join(__dirname, 'template.ts')
export const DEFAULT_MIGRATE_AUTOSYNC = false
export const DEFAULT_MIGRATE_CLI = false
