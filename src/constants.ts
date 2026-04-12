export const MIGRATION_FILE_EXTENSIONS = ['ts', 'js', 'mjs', 'cjs'] as const

// Regex to match migration files, excluding .d.ts files
export const MIGRATION_FILE_REGEX = new RegExp(String.raw`(?<!\.d)\.(${MIGRATION_FILE_EXTENSIONS.join('|')})$`)

// Allowed characters in user-supplied migration names. Whitelists letters,
// digits, underscore, hyphen, and dot; the negative lookahead blocks
// consecutive dots so `..` path traversal is rejected even though single
// dots (e.g. `my.migration`) are supported.
export const MIGRATION_NAME_REGEX = /^(?!.*\.\.)[A-Za-z0-9._-]+$/
