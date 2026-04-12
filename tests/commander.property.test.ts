import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import fc from 'fast-check'
import { getEnv, getEnvBoolean, toCamelCase } from '../src/commander'
import { Env } from '../src/types'

// Arbitrary Env-shaped strings: uppercase letters + underscores, starting
// with a letter. Matches the shape of every value in the Env enum.
const envLikeArb = fc.stringMatching(/^[A-Z][A-Z_]{0,20}$/)

describe('commander.toCamelCase — properties', () => {
  it('output never contains an underscore followed by a lowercase letter', () => {
    fc.assert(
      fc.property(envLikeArb, (s) => {
        expect(toCamelCase(s as Env)).not.toMatch(/_[a-z]/)
      }),
    )
  })

  it('output first character is lowercase (or empty)', () => {
    fc.assert(
      fc.property(envLikeArb, (s) => {
        const out = toCamelCase(s as Env)
        if (out.length > 0) {
          const first = out[0]
          expect(first).toBe(first.toLocaleLowerCase())
        }
      }),
    )
  })

  it('preserves total length minus the underscores that were consumed', () => {
    fc.assert(
      fc.property(envLikeArb, (s) => {
        // Each _<lowercase> pair collapses to 1 char (the uppercased letter),
        // saving 1 char per match. After lowercasing, the regex matches
        // _<any letter>, so every _X collapses.
        const lowered = s.toLocaleLowerCase()
        const underscoresConsumed = (lowered.match(/_[a-z]/g) ?? []).length
        expect(toCamelCase(s as Env)).toHaveLength(s.length - underscoresConsumed)
      }),
    )
  })

  it('reaches a fixed point within a bounded number of applications', () => {
    // Not strictly idempotent (e.g. `A__A` → `a_A` → `aA`), but each
    // application either shrinks the string or converges, so iterating
    // must stabilize. The bound matches the count of underscores in the
    // input — each iteration can consume at most one surviving `_<lower>`
    // pair introduced by the previous pass.
    fc.assert(
      fc.property(envLikeArb, (s) => {
        const bound = s.length + 1
        let current = s as Env
        for (let i = 0; i < bound; i++) {
          const next = toCamelCase(current)
          if (next === current) return
          current = next as Env
        }
        expect(toCamelCase(current)).toBe(current)
      }),
    )
  })

  it('matches known Env enum transformations', () => {
    expect(toCamelCase(Env.MIGRATE_CONFIG_PATH)).toBe('migrateConfigPath')
    expect(toCamelCase(Env.MIGRATE_MONGO_COLLECTION)).toBe('migrateMongoCollection')
    expect(toCamelCase(Env.MIGRATE_MIGRATIONS_PATH)).toBe('migrateMigrationsPath')
    expect(toCamelCase(Env.MIGRATE_AUTOSYNC)).toBe('migrateAutosync')
    expect(toCamelCase(Env.MIGRATE_CLI)).toBe('migrateCli')
    expect(toCamelCase(Env.MIGRATE_MODE)).toBe('migrateMode')
    expect(toCamelCase(Env.MIGRATE_MONGO_URI)).toBe('migrateMongoUri')
    expect(toCamelCase(Env.MIGRATE_TEMPLATE_PATH)).toBe('migrateTemplatePath')
  })
})

describe('commander.getEnv / getEnvBoolean — properties', () => {
  const keyArb = fc.constantFrom(Env.MIGRATE_MODE, Env.MIGRATE_CONFIG_PATH, Env.MIGRATE_MONGO_URI, Env.MIGRATE_AUTOSYNC)
  const valueArb = fc.stringMatching(/^[A-Za-z0-9 _.-]{1,20}$/)

  // Clean the four env-var pairs this suite uses so each property runs
  // against a known-empty process.env slice.
  const cleanup = () => {
    for (const key of [Env.MIGRATE_MODE, Env.MIGRATE_CONFIG_PATH, Env.MIGRATE_MONGO_URI, Env.MIGRATE_AUTOSYNC]) {
      delete process.env[key]
      delete process.env[toCamelCase(key)]
    }
  }

  beforeEach(cleanup)
  afterEach(cleanup)

  it('returns undefined when neither UPPER nor camelCase is set', () => {
    fc.assert(
      fc.property(keyArb, (key) => {
        cleanup()
        expect(getEnv(key)).toBeUndefined()
      }),
    )
  })

  it('UPPER key takes precedence over camelCase alias', () => {
    fc.assert(
      fc.property(keyArb, valueArb, valueArb, (key, upper, camel) => {
        fc.pre(upper !== camel)
        cleanup()
        process.env[key] = upper
        process.env[toCamelCase(key)] = camel
        expect(getEnv(key)).toBe(upper)
      }),
    )
  })

  it('camelCase alias is returned when UPPER is unset', () => {
    fc.assert(
      fc.property(keyArb, valueArb, (key, camel) => {
        cleanup()
        process.env[toCamelCase(key)] = camel
        expect(getEnv(key)).toBe(camel)
      }),
    )
  })

  it('getEnvBoolean returns true only for the literal string "true"', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        cleanup()
        process.env[Env.MIGRATE_AUTOSYNC] = value
        expect(getEnvBoolean(Env.MIGRATE_AUTOSYNC)).toBe(value === 'true' ? true : undefined)
      }),
    )
  })

  it('getEnvBoolean returns undefined when unset', () => {
    cleanup()
    expect(getEnvBoolean(Env.MIGRATE_AUTOSYNC)).toBeUndefined()
  })
})
