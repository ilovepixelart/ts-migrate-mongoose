import fs from 'node:fs'

// Regex from dotenv; it only parses the user's own .env file, so backtracking cost is not attacker-controlled
const LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm // NOSONAR

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

// A missing or unreadable env file adds no variables.
export const config = (envPath: string, override = false): void => {
  let src: string
  try {
    src = fs.readFileSync(envPath, 'utf8')
  } catch {
    return
  }
  populate(parse(src), override)
}
