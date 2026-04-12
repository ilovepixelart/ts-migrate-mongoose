import { describe, expect, it } from 'vitest'

import { MIGRATION_FILE_EXTENSIONS, MIGRATION_FILE_REGEX, MIGRATION_NAME_REGEX } from '../src/constants'

describe('MIGRATION_FILE_EXTENSIONS', () => {
  it('lists ts, js, mjs, cjs', () => {
    expect(MIGRATION_FILE_EXTENSIONS).toEqual(['ts', 'js', 'mjs', 'cjs'])
  })
})

describe('MIGRATION_FILE_REGEX', () => {
  it('matches supported source files', () => {
    expect(MIGRATION_FILE_REGEX.test('1234567890123-add-users.ts')).toBe(true)
    expect(MIGRATION_FILE_REGEX.test('1234567890123-add-users.js')).toBe(true)
    expect(MIGRATION_FILE_REGEX.test('1234567890123-add-users.mjs')).toBe(true)
    expect(MIGRATION_FILE_REGEX.test('1234567890123-add-users.cjs')).toBe(true)
  })

  it('rejects .d.ts declaration files', () => {
    expect(MIGRATION_FILE_REGEX.test('1234567890123-add-users.d.ts')).toBe(false)
  })

  it('rejects unrelated extensions', () => {
    expect(MIGRATION_FILE_REGEX.test('1234567890123-add-users.json')).toBe(false)
    expect(MIGRATION_FILE_REGEX.test('1234567890123-add-users.txt')).toBe(false)
    expect(MIGRATION_FILE_REGEX.test('1234567890123-add-users')).toBe(false)
  })
})

describe('MIGRATION_NAME_REGEX', () => {
  describe('accepts', () => {
    const valid = [
      'add-users',
      'test-migration',
      'test-migration1',
      'extension-test',
      'single',
      'A',
      '1',
      'my.migration',
      'v1.2.3-release',
      'snake_case_name',
      'kebab-case-name',
      'Mixed-Case_Name.1',
      '__private',
      'a'.repeat(100),
    ]

    for (const name of valid) {
      it(`allows '${name}'`, () => {
        expect(MIGRATION_NAME_REGEX.test(name)).toBe(true)
      })
    }
  })

  describe('rejects', () => {
    const invalid: Array<[string, string]> = [
      ['', 'empty string'],
      ['..', 'exactly two dots (parent directory traversal)'],
      ['...', 'three dots (still contains ..)'],
      ['../evil', 'starts with ../ traversal'],
      ['foo/../bar', 'contains ../ anywhere'],
      ['foo..bar', 'contains consecutive dots'],
      ['foo/bar', 'contains forward slash'],
      ['foo\\bar', 'contains backslash'],
      ['with space', 'contains whitespace'],
      ['with\ttab', 'contains tab'],
      ['with\nnewline', 'contains newline'],
      ['tilde~home', 'contains tilde'],
      ['name!', 'contains exclamation'],
      ['name?', 'contains question mark'],
      ['name*glob', 'contains glob star'],
      ['name$var', 'contains dollar'],
      ['name;rm', 'contains semicolon'],
      ['name|pipe', 'contains pipe'],
      ['name&bg', 'contains ampersand'],
      ['name`cmd`', 'contains backtick'],
      ['name"quote', 'contains double quote'],
      ["name'quote", 'contains single quote'],
      ['name(paren)', 'contains parentheses'],
      ['name{brace}', 'contains braces'],
      ['name#hash', 'contains hash'],
      ['name@at', 'contains at sign'],
      ['émigré', 'contains non-ASCII letters'],
      ['💥', 'contains emoji'],
      ['\x00null', 'contains NUL byte'],
    ]

    for (const [name, reason] of invalid) {
      it(`rejects ${reason} (${JSON.stringify(name)})`, () => {
        expect(MIGRATION_NAME_REGEX.test(name)).toBe(false)
      })
    }
  })

  it('has no backtracking surprise: long safe input evaluates quickly', () => {
    const start = Date.now()
    const longInput = `${'a'.repeat(10_000)}.${'b'.repeat(10_000)}`
    MIGRATION_NAME_REGEX.test(longInput)
    const elapsed = Date.now() - start
    // Sanity ceiling: catastrophic backtracking would take seconds.
    // A safe regex should handle this in under 100ms on any modern CPU.
    expect(elapsed).toBeLessThan(100)
  })
})
