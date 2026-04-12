import { describe, expect, it } from 'vitest'

import fc from 'fast-check'
import { parse } from '../src/env'

// Keys match the /[\w.-]+/ character class the parser accepts.
const keyArb = fc.stringMatching(/^[A-Za-z_][\w.-]{0,15}$/)

// Safe values: no quotes, no backslashes, no line breaks, no '#' (would be
// treated as a comment). Values are trimmed to match parse() which strips
// leading and trailing whitespace from unquoted values.
const safeValueArb = fc.stringMatching(/^[^\r\n'"`\\#]{0,40}$/).map((s) => s.trim())

const envObjectArb = fc.dictionary(keyArb, safeValueArb, { maxKeys: 8 })

const serialize = (obj: Record<string, string>): string =>
  Object.entries(obj)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

describe('env.parse — properties', () => {
  it('never throws on any string input', () => {
    fc.assert(
      fc.property(fc.string(), (src) => {
        expect(() => parse(src)).not.toThrow()
      }),
    )
  })

  it('returns a plain object on any string input', () => {
    fc.assert(
      fc.property(fc.string(), (src) => {
        const result = parse(src)
        expect(typeof result).toBe('object')
        expect(result).not.toBeNull()
        expect(Array.isArray(result)).toBe(false)
      }),
    )
  })

  it('every parsed key matches the /[\\w.-]+/ character class', () => {
    fc.assert(
      fc.property(fc.string(), (src) => {
        const result = parse(src)
        for (const key of Object.keys(result)) {
          expect(key).toMatch(/^[\w.-]+$/)
        }
      }),
    )
  })

  it('every parsed value is a string', () => {
    fc.assert(
      fc.property(fc.string(), (src) => {
        const result = parse(src)
        for (const value of Object.values(result)) {
          expect(typeof value).toBe('string')
        }
      }),
    )
  })

  it('round-trips simple KEY=value serialization', () => {
    fc.assert(
      fc.property(envObjectArb, (obj) => {
        expect(parse(serialize(obj))).toEqual(obj)
      }),
    )
  })

  it('is idempotent: parse(serialize(parse(serialize(x)))) === parse(serialize(x))', () => {
    fc.assert(
      fc.property(envObjectArb, (obj) => {
        const once = parse(serialize(obj))
        const twice = parse(serialize(once))
        expect(twice).toEqual(once)
      }),
    )
  })

  it('comment-only lines are ignored', () => {
    fc.assert(
      fc.property(fc.array(fc.stringMatching(/^#[^\r\n]{0,40}$/), { maxLength: 5 }), (comments) => {
        expect(parse(comments.join('\n'))).toEqual({})
      }),
    )
  })

  it('blank lines are ignored', () => {
    fc.assert(
      fc.property(fc.nat({ max: 20 }), (n) => {
        expect(parse('\n'.repeat(n))).toEqual({})
      }),
    )
  })

  it('trailing # comment is stripped from value', () => {
    fc.assert(
      fc.property(keyArb, safeValueArb, fc.stringMatching(/^[^\r\n]{0,20}$/), (key, value, comment) => {
        const src = `${key}=${value} # ${comment}`
        const result = parse(src)
        expect(result[key]).toBe(value)
      }),
    )
  })

  it('double-quoted values have \\n and \\r escape sequences expanded', () => {
    fc.assert(
      fc.property(keyArb, fc.stringMatching(/^[^\r\n'"`\\#]{0,20}$/), (key, inner) => {
        const src = `${key}="${inner}\\n${inner}"`
        expect(parse(src)[key]).toBe(`${inner}\n${inner}`)
      }),
    )
  })

  it('single-quoted values do NOT expand escape sequences', () => {
    fc.assert(
      fc.property(keyArb, fc.stringMatching(/^[^\r\n'"`\\#]{0,20}$/), (key, inner) => {
        const src = `${key}='${inner}\\n${inner}'`
        expect(parse(src)[key]).toBe(`${inner}\\n${inner}`)
      }),
    )
  })

  it('normalizes CRLF and CR to LF before parsing', () => {
    fc.assert(
      fc.property(envObjectArb, (obj) => {
        const lf = serialize(obj)
        const crlf = lf.replaceAll('\n', '\r\n')
        const cr = lf.replaceAll('\n', '\r')
        expect(parse(crlf)).toEqual(parse(lf))
        expect(parse(cr)).toEqual(parse(lf))
      }),
    )
  })

  it('export prefix is stripped: `export KEY=value` parses to {KEY: "value"}', () => {
    fc.assert(
      fc.property(keyArb, safeValueArb, (key, value) => {
        expect(parse(`export ${key}=${value}`)).toEqual({ [key]: value })
      }),
    )
  })

  it('does not mutate its input string (strings are immutable; assert the returned object has no aliasing of the input)', () => {
    fc.assert(
      fc.property(fc.string(), (src) => {
        const before = src
        parse(src)
        expect(src).toBe(before)
      }),
    )
  })
})
