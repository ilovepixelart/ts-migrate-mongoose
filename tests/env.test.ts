import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getEnv, getEnvBoolean, toCamelCase } from '../src/commander'
import { config, parse } from '../src/env'
import { Env } from '../src/types'

config({ path: '.env.test', quiet: true })

describe('Environment Variable Utilities', () => {
  beforeEach(() => {
    delete process.env.MIGRATE_MODE
    delete process.env.migrateMode
    delete process.env.MIGRATE_CONFIG_PATH
    delete process.env.migrateConfigPath
  })

  describe('toCamelCase', () => {
    it('should convert snake_case to camelCase', () => {
      expect(toCamelCase(Env.MIGRATE_CONFIG_PATH)).toBe('migrateConfigPath')
      expect(toCamelCase(Env.MIGRATE_MODE)).toBe('migrateMode')
    })
  })

  describe('getEnv', () => {
    it('should return the value of the environment variable', () => {
      process.env.MIGRATE_MODE = 'development'
      expect(getEnv(Env.MIGRATE_MODE)).toBe('development')
    })

    it('should return the value of the camelCase environment variable', () => {
      process.env.migrateMode = 'development'
      expect(getEnv(Env.MIGRATE_MODE)).toBe('development')
    })

    it('should return undefined if the environment variable is not set', () => {
      expect(getEnv(Env.MIGRATE_MODE)).toBeUndefined()
    })
  })

  describe('getEnvBoolean', () => {
    it('should return true if the environment variable is set to "true"', () => {
      process.env.MIGRATE_AUTOSYNC = 'true'
      expect(getEnvBoolean(Env.MIGRATE_AUTOSYNC)).toBe(true)
    })

    it('should return undefined if the environment variable is not set to "true"', () => {
      process.env.MIGRATE_AUTOSYNC = 'false'
      expect(getEnvBoolean(Env.MIGRATE_AUTOSYNC)).toBeUndefined()
    })

    it('should return undefined if the environment variable is not set', () => {
      expect(getEnvBoolean(Env.MIGRATE_AUTOSYNC)).toBeUndefined()
    })
  })
})

describe('parse — dotenv compatibility', () => {
  it('should parse basic key=value', () => {
    expect(parse('BASIC=basic')).toEqual({ BASIC: 'basic' })
  })

  it('should read after a skipped line', () => {
    expect(parse('\nAFTER_LINE=after_line').AFTER_LINE).toBe('after_line')
  })

  it('should default empty values to empty string', () => {
    expect(parse('EMPTY=').EMPTY).toBe('')
    expect(parse("EMPTY_SINGLE_QUOTES=''").EMPTY_SINGLE_QUOTES).toBe('')
    expect(parse('EMPTY_DOUBLE_QUOTES=""').EMPTY_DOUBLE_QUOTES).toBe('')
    expect(parse('EMPTY_BACKTICKS=``').EMPTY_BACKTICKS).toBe('')
  })

  it('should handle single-quoted values', () => {
    expect(parse("SINGLE_QUOTES='single_quotes'").SINGLE_QUOTES).toBe('single_quotes')
  })

  it('should respect surrounding spaces in single quotes', () => {
    expect(parse("SINGLE_QUOTES_SPACED='    single quotes    '").SINGLE_QUOTES_SPACED).toBe('    single quotes    ')
  })

  it('should handle double-quoted values', () => {
    expect(parse('DOUBLE_QUOTES="double_quotes"').DOUBLE_QUOTES).toBe('double_quotes')
  })

  it('should respect surrounding spaces in double quotes', () => {
    expect(parse('DOUBLE_QUOTES_SPACED="    double quotes    "').DOUBLE_QUOTES_SPACED).toBe('    double quotes    ')
  })

  it('should respect double quotes inside single quotes', () => {
    expect(parse(`DOUBLE_QUOTES_INSIDE_SINGLE='double "quotes" work inside single quotes'`).DOUBLE_QUOTES_INSIDE_SINGLE).toBe('double "quotes" work inside single quotes')
  })

  it('should respect single quotes inside double quotes', () => {
    expect(parse(`SINGLE_QUOTES_INSIDE_DOUBLE="single 'quotes' work inside double quotes"`).SINGLE_QUOTES_INSIDE_DOUBLE).toBe("single 'quotes' work inside double quotes")
  })

  it('should handle backtick-quoted values', () => {
    expect(parse('BACKTICKS=`backticks`').BACKTICKS).toBe('backticks')
  })

  it('should respect surrounding spaces in backticks', () => {
    expect(parse('BACKTICKS_SPACED=`    backticks    `').BACKTICKS_SPACED).toBe('    backticks    ')
  })

  it('should respect backticks inside single quotes', () => {
    expect(parse("BACKTICKS_INSIDE_SINGLE='`backticks` work inside single quotes'").BACKTICKS_INSIDE_SINGLE).toBe('`backticks` work inside single quotes')
  })

  it('should respect backticks inside double quotes', () => {
    expect(parse('BACKTICKS_INSIDE_DOUBLE="`backticks` work inside double quotes"').BACKTICKS_INSIDE_DOUBLE).toBe('`backticks` work inside double quotes')
  })

  it('should respect double quotes inside backticks', () => {
    expect(parse('DOUBLE_QUOTES_INSIDE_BACKTICKS=`double "quotes" work inside backticks`').DOUBLE_QUOTES_INSIDE_BACKTICKS).toBe('double "quotes" work inside backticks')
  })

  it('should respect single quotes inside backticks', () => {
    expect(parse("SINGLE_QUOTES_INSIDE_BACKTICKS=`single 'quotes' work inside backticks`").SINGLE_QUOTES_INSIDE_BACKTICKS).toBe("single 'quotes' work inside backticks")
  })

  it('should expand newlines in double-quoted values', () => {
    expect(parse(String.raw`EXPAND_NEWLINES="expand\nnew\nlines"`).EXPAND_NEWLINES).toBe('expand\nnew\nlines')
  })

  it('should not expand newlines in unquoted values', () => {
    expect(parse(String.raw`DONT_EXPAND_UNQUOTED=dontexpand\nnewlines`).DONT_EXPAND_UNQUOTED).toBe(String.raw`dontexpand\nnewlines`)
  })

  it('should not expand newlines in single-quoted values', () => {
    expect(parse(String.raw`DONT_EXPAND_SQUOTED='dontexpand\nnewlines'`).DONT_EXPAND_SQUOTED).toBe(String.raw`dontexpand\nnewlines`)
  })

  it('should ignore commented lines', () => {
    const parsed = parse('# COMMENTS=work\nFOO=bar')
    expect(parsed.COMMENTS).toBeUndefined()
    expect(parsed.FOO).toBe('bar')
  })

  it('should handle inline comments', () => {
    expect(parse('INLINE_COMMENTS=inline comments # work #very #well').INLINE_COMMENTS).toBe('inline comments')
  })

  it('should respect # inside single quotes', () => {
    expect(parse("INLINE_COMMENTS_SINGLE_QUOTES='inline comments outside of #singlequotes' # work").INLINE_COMMENTS_SINGLE_QUOTES).toBe('inline comments outside of #singlequotes')
  })

  it('should respect # inside double quotes', () => {
    expect(parse('INLINE_COMMENTS_DOUBLE_QUOTES="inline comments outside of #doublequotes" # work').INLINE_COMMENTS_DOUBLE_QUOTES).toBe('inline comments outside of #doublequotes')
  })

  it('should respect # inside backticks', () => {
    expect(parse('INLINE_COMMENTS_BACKTICKS=`inline comments outside of #backticks` # work').INLINE_COMMENTS_BACKTICKS).toBe('inline comments outside of #backticks')
  })

  it('should handle equals signs in values', () => {
    expect(parse('EQUAL_SIGNS=equals==').EQUAL_SIGNS).toBe('equals==')
  })

  it('should retain inner quotes', () => {
    expect(parse('RETAIN_INNER_QUOTES={"foo": "bar"}').RETAIN_INNER_QUOTES).toBe('{"foo": "bar"}')
  })

  it('should trim spaces from unquoted values', () => {
    expect(parse('TRIM_SPACE_FROM_UNQUOTED=    some spaced out string').TRIM_SPACE_FROM_UNQUOTED).toBe('some spaced out string')
  })

  it('should parse email addresses', () => {
    expect(parse('USERNAME=therealnerdybeast@example.tld').USERNAME).toBe('therealnerdybeast@example.tld')
  })

  it('should parse spaced keys', () => {
    expect(parse('    SPACED_KEY = parsed').SPACED_KEY).toBe('parsed')
  })

  it('should handle export prefix', () => {
    expect(parse('export FOO=bar').FOO).toBe('bar')
    expect(parse('export FOO="quoted"').FOO).toBe('quoted')
  })

  it('should handle keys with dots and dashes', () => {
    expect(parse('my.key=value')['my.key']).toBe('value')
    expect(parse('my-key=value')['my-key']).toBe('value')
  })

  it(String.raw`should handle Windows line endings (\r\n)`, () => {
    expect(parse('MIGRATE_MONGO_URI=mongodb://localhost\r\nMIGRATE_MONGO_COLLECTION=migrations\r\nMIGRATE_AUTOSYNC=true')).toEqual({ MIGRATE_MONGO_URI: 'mongodb://localhost', MIGRATE_MONGO_COLLECTION: 'migrations', MIGRATE_AUTOSYNC: 'true' })
  })

  it(String.raw`should handle old Mac line endings (\r)`, () => {
    expect(parse('MIGRATE_MONGO_URI=mongodb://localhost\rMIGRATE_MONGO_COLLECTION=migrations\rMIGRATE_AUTOSYNC=true')).toEqual({ MIGRATE_MONGO_URI: 'mongodb://localhost', MIGRATE_MONGO_COLLECTION: 'migrations', MIGRATE_AUTOSYNC: 'true' })
  })

  it(String.raw`should handle Unix line endings (\n)`, () => {
    expect(parse('MIGRATE_MONGO_URI=mongodb://localhost\nMIGRATE_MONGO_COLLECTION=migrations\nMIGRATE_AUTOSYNC=true')).toEqual({ MIGRATE_MONGO_URI: 'mongodb://localhost', MIGRATE_MONGO_COLLECTION: 'migrations', MIGRATE_AUTOSYNC: 'true' })
  })

  it('last duplicate key should win', () => {
    expect(parse('DUP=one\nDUP=two').DUP).toBe('two')
  })

  it('should handle multiple calls without regex state leaking', () => {
    expect(parse('A=1')).toEqual({ A: '1' })
    expect(parse('B=2')).toEqual({ B: '2' })
    expect(parse('C=3')).toEqual({ C: '3' })
  })

  it(String.raw`should expand \r in double-quoted values`, () => {
    expect(parse(String.raw`FOO="col1\rcol2"`).FOO).toBe('col1\rcol2')
  })
})

describe('config', () => {
  const savedEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    savedEnv.TEST_CONFIG_VAR = process.env.TEST_CONFIG_VAR
    delete process.env.TEST_CONFIG_VAR
  })

  afterEach(() => {
    if (savedEnv.TEST_CONFIG_VAR === undefined) {
      delete process.env.TEST_CONFIG_VAR
    } else {
      process.env.TEST_CONFIG_VAR = savedEnv.TEST_CONFIG_VAR
    }
  })

  it('should return error for non-existent file in quiet mode', () => {
    const result = config({ path: 'nonexistent.env', quiet: true })
    expect(result.error).toBeDefined()
    expect(result.parsed).toEqual({})
  })

  it('should not override existing env vars by default', () => {
    process.env.TEST_CONFIG_VAR = 'original'
    config({ path: '.env.test', quiet: true })
    expect(process.env.TEST_CONFIG_VAR).toBe('original')
  })

  it('should override existing env vars when override is true', () => {
    process.env.TEST_CONFIG_VAR = 'original'
    const src = 'TEST_CONFIG_VAR=overridden'
    const parsed = parse(src)
    expect(parsed.TEST_CONFIG_VAR).toBe('overridden')
  })

  it('should log error for non-existent file when not quiet', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = config({ path: 'nonexistent.env' })
    expect(result.error).toBeDefined()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('should use default .env path when no path is provided', () => {
    const result = config({ quiet: true })
    expect(result).toBeDefined()
  })

  it('should populate env vars from a valid file', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const tmpFile = path.resolve('test-env-populate.tmp')
    fs.writeFileSync(tmpFile, 'TEST_POPULATE_VAR=hello')
    try {
      delete process.env.TEST_POPULATE_VAR
      const result = config({ path: tmpFile, quiet: true })
      expect(result.parsed.TEST_POPULATE_VAR).toBe('hello')
      expect(process.env.TEST_POPULATE_VAR).toBe('hello')
    } finally {
      delete process.env.TEST_POPULATE_VAR
      fs.unlinkSync(tmpFile)
    }
  })

  it('should override env vars when override is true', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const tmpFile = path.resolve('test-env-override.tmp')
    fs.writeFileSync(tmpFile, 'TEST_OVERRIDE_VAR=new_value')
    try {
      process.env.TEST_OVERRIDE_VAR = 'old_value'
      config({ path: tmpFile, quiet: true, override: true })
      expect(process.env.TEST_OVERRIDE_VAR).toBe('new_value')
    } finally {
      delete process.env.TEST_OVERRIDE_VAR
      fs.unlinkSync(tmpFile)
    }
  })

  it('should not override env vars when override is false', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const tmpFile = path.resolve('test-env-no-override.tmp')
    fs.writeFileSync(tmpFile, 'TEST_NO_OVERRIDE_VAR=new_value')
    try {
      process.env.TEST_NO_OVERRIDE_VAR = 'old_value'
      config({ path: tmpFile, quiet: true })
      expect(process.env.TEST_NO_OVERRIDE_VAR).toBe('old_value')
    } finally {
      delete process.env.TEST_NO_OVERRIDE_VAR
      fs.unlinkSync(tmpFile)
    }
  })
})
