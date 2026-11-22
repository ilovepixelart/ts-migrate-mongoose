# Migration names: what Migrator.create accepts (MIGRATION_NAME_REGEX in src/constants.ts), as one left-to-right
# pass that remembers whether the previous char was a dot. LAWS.bend states that it agrees with SPEC.bend on every
# string; PROOF.bend proves it. Compiled to main.mjs, it is the oracle tests/laws/migration-name.test.ts and the e2e
# laws scenario compare the regex and Migrator.create with.

import Base
import ./SPEC.bend as Spec

# The char (a dot: d, a slash: sl, whitelisted: w) is allowed, and is not a dot right after a dot.
def char_ok(d: Bool, sl: Bool, w: Bool, prev: Bool) -> Bool:
  match d:
    case True{}:
      match prev:
        case True{}:
          False{}
        case False{}:
          Bool.not(sl) && w
    case False{}:
      Bool.not(sl) && w

# Every char is ok; prev says whether the char before the string was a dot.
def rest_ok(s: String, prev: Bool) -> Bool:
  match s:
    case SNil{}:
      True{}
    case SCon{+h, t}:
      char_ok(Spec.is_dot(h), Spec.is_slash(h), Spec.whitelisted(h), prev) && rest_ok(t, Spec.is_dot(h))

def valid(s: String) -> Bool:
  match s:
    case SNil{}:
      False{}
    case SCon{h, t}:
      rest_ok(SCon{h, t}, False{})
