import { describe, expect, it } from 'vitest'

import fc from 'fast-check'
import { MIGRATION_NAME_REGEX } from '../../src/constants'
import Name from './names/main.mjs'

// names/main.bend is proven (names/PROOF.bend) to accept exactly the names names/SPEC.bend describes, none of them
// containing "..", "/" or "\". The regex Migrator.create uses must accept exactly the names it accepts.

// The allowed alphabet plus the characters that matter for path safety, in runs, and arbitrary strings.
const nameArb = fc.oneof(
  fc.array(fc.constantFrom('a', 'Z', '0', '_', '-', '.', '..', '/', '\\', ' ', 'é', '\u0000'), { maxLength: 12 }).map((parts) => parts.join('')),
  fc.string({ unit: 'binary', maxLength: 20 }),
)

describe('MIGRATION_NAME_REGEX against the proven validator', () => {
  it('accepts exactly the names the proven validator accepts', () => {
    fc.assert(
      fc.property(nameArb, (name) => {
        expect(MIGRATION_NAME_REGEX.test(name)).toBe(Name.valid(name))
      }),
      { numRuns: 2000 },
    )
  })

  it.each(['add-users', 'v1.2.3-release', '__private', '.', 'a.'])('both accept %j', (name) => {
    expect([MIGRATION_NAME_REGEX.test(name), Name.valid(name)]).toEqual([true, true])
  })

  it.each(['', '..', 'foo..bar', '../evil', 'a/b', 'a\\b', 'with space', 'émigré'])('both reject %j', (name) => {
    expect([MIGRATION_NAME_REGEX.test(name), Name.valid(name)]).toEqual([false, false])
  })
})
