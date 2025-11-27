export const MIGRATION_FILE_EXTENSIONS = ['ts', 'js', 'mjs', 'cjs'] as const

// Regex to match migration files, excluding .d.ts files
export const MIGRATION_FILE_REGEX = new RegExp(String.raw`(?<!\.d)\.(${MIGRATION_FILE_EXTENSIONS.join('|')})$`)
