import fs from 'node:fs'
import path from 'node:path'

// NOSONAR — regex from dotenv, intentionally complex for .env format parsing
const LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm

interface ConfigOutput {
  parsed: Record<string, string>
  error?: Error
}

interface ConfigOptions {
  path?: string
  override?: boolean
  quiet?: boolean
}

export const parse = (src: string): Record<string, string> => {
  const obj: Record<string, string> = {}

  const lines = src.replaceAll(/\r\n?/gm, '\n')

  for (const match of lines.matchAll(LINE)) {
    const key = match[1] as string

    let value = (match[2] ?? '').trim()

    const maybeQuote = value[0]

    value = value.replaceAll(/^(['"`])([\s\S]*)\1$/gm, '$2')

    if (maybeQuote === '"') {
      value = value.replaceAll(String.raw`\n`, '\n')
      value = value.replaceAll(String.raw`\r`, '\r')
    }

    obj[key] = value
  }

  return obj
}

const populate = (parsed: Record<string, string>, override = false): void => {
  for (const [key, value] of Object.entries(parsed)) {
    if (override || !(key in process.env)) {
      process.env[key] = value
    }
  }
}

export const config = (options?: ConfigOptions): ConfigOutput => {
  const envPath = options?.path ? path.resolve(options.path) : path.resolve(process.cwd(), '.env')

  try {
    const src = fs.readFileSync(envPath, 'utf8')
    const parsed = parse(src)
    populate(parsed, options?.override)
    return { parsed }
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Failed to read .env file')
    if (!options?.quiet) {
      console.error(err.message)
    }
    return { parsed: {}, error: err }
  }
}
