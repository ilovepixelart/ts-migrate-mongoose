import { describe, expect, it } from 'vitest'

import fc from 'fast-check'
import { parse } from '../src/env'

// Keys match the /[\w.-]+/ character class the parser accepts. __proto__ is left to its own test: parse() drops it.
const keyArb = fc.stringMatching(/^[A-Za-z_][\w.-]{0,15}$/).filter((key) => key !== '__proto__')

// Safe values: no quotes, no backslashes, no line breaks, no '#' (would be
// treated as a comment). Values are trimmed to match parse() which strips
// leading and trailing whitespace from unquoted values.
const safeValueArb = fc.stringMatching(/^[^\r\n'"`\\#]{0,40}$/).map((s) => s.trim())

const envObjectArb = fc.dictionary(keyArb, safeValueArb, { maxKeys: 8 })

// A .env file the parser has to cope with: assignments in every separator, quote, export and comment form,
// mixed with arbitrary binary noise, joined by one of the three line endings.
const quotedValueArb = fc.oneof(
  safeValueArb,
  safeValueArb.map((value) => `"${value}"`),
  safeValueArb.map((value) => `'${value}'`),
  safeValueArb.map((value) => `\`${value}\``),
)
const assignmentArb = fc.tuple(fc.constantFrom('', 'export '), keyArb, fc.constantFrom('=', ' = ', ': '), quotedValueArb, fc.constantFrom('', ' # note')).map(([prefix, key, separator, value, comment]) => ({ key, line: `${prefix}${key}${separator}${value}${comment}` }))
const eolArb = fc.constantFrom('\n', '\r\n', '\r')
const envSourceArb = fc
  .tuple(
    fc.array(
      fc.oneof(
        assignmentArb.map(({ line }) => line),
        fc.string({ unit: 'binary', maxLength: 30 }),
      ),
      { maxLength: 10 },
    ),
    eolArb,
  )
  .map(([lines, eol]) => lines.join(eol))
const anySourceArb = fc.oneof(envSourceArb, fc.string({ unit: 'binary' }))

const serialize = (obj: Record<string, string>): string =>
  Object.entries(obj)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

describe('env.parse — properties', () => {
  it('never throws on any input', () => {
    fc.assert(
      fc.property(anySourceArb, (src) => {
        expect(() => parse(src)).not.toThrow()
      }),
    )
  })

  it('returns a plain object on any input', () => {
    fc.assert(
      fc.property(anySourceArb, (src) => {
        const result = parse(src)
        expect(typeof result).toBe('object')
        expect(result).not.toBeNull()
        expect(Array.isArray(result)).toBe(false)
      }),
    )
  })

  it('every parsed key matches the /[\\w.-]+/ character class', () => {
    fc.assert(
      fc.property(envSourceArb, (src) => {
        expect(Object.keys(parse(src)).filter((key) => !/^[\w.-]+$/.test(key))).toEqual([])
      }),
    )
  })

  it('every parsed value is a string', () => {
    fc.assert(
      fc.property(envSourceArb, (src) => {
        expect(Object.values(parse(src)).filter((value) => typeof value !== 'string')).toEqual([])
      }),
    )
  })

  it('parses the key of every assignment line, whatever its separator, quotes, export prefix, comment or line ending', () => {
    fc.assert(
      fc.property(fc.array(assignmentArb, { minLength: 1, maxLength: 10 }), eolArb, (assignments, eol) => {
        const src = assignments.map(({ line }) => line).join(eol)
        expect(Object.keys(parse(src)).sort()).toEqual([...new Set(assignments.map(({ key }) => key))].sort())
      }),
    )
  })

  // Known defect, pinned as it is: parse() assigns into a plain object, so a __proto__ key sets the prototype
  // instead of a value. A fix fails this test; replace it with one that expects { __proto__: 'a' } kept as a key.
  it('known defect: drops a __proto__ key', () => {
    expect(Object.keys(parse('__proto__=a\nconstructor=b'))).toEqual(['constructor'])
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
})
