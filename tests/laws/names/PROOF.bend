# Migration names: the proofs.
#
# The argument: main.bend reads the name left to right, remembering whether the previous char was a dot; SPEC.bend
# says the same thing as two separate facts (every char allowed, no dot after a dot). rest_spec shows, by induction
# on the string, that they agree on every suffix and every previous char. The security laws then follow from the
# specification alone: SPEC.bend's allowed chars include no slash, and its valid excludes a dot after a dot.

import Base
import ./main.bend as Name
import ./SPEC.bend as Spec
import ./LAWS.bend as Laws

# Agreement
# ---------
# One char: with the rest of the string already in its spec form (all: every later char allowed, dd: a dot follows
# a dot later), the spec's verdict is the program's. sl and w decide whether the char is allowed; d and prev whether
# it is a dot after a dot; all is read only when the char is allowed and is a dot after a dot.

def spec_step(sl: Bool, w: Bool, d: Bool, prev: Bool, all: Bool, -dd: Bool)
  -> {((Bool.not(sl) && w) && all) && Bool.not((d && prev) || dd) == Name.char_ok(d, sl, w, prev) && (all && Bool.not(dd)) : Bool}:
  match sl w:
    case True{} _:
      match d prev:
        case True{} True{}:
          {==}
        case True{} False{}:
          {==}
        case False{} _:
          {==}
    case False{} False{}:
      match d prev:
        case True{} True{}:
          {==}
        case True{} False{}:
          {==}
        case False{} _:
          {==}
    case False{} True{}:
      match d prev:
        case True{} True{}:
          match all:
            case True{}:
              {==}
            case False{}:
              {==}
        case True{} False{}:
          {==}
        case False{} _:
          {==}

# Every suffix: the tail's claim turns its rest_ok into its spec form, and spec_step closes the char.
def rest_spec(+s: String, +prev: Bool) -> {Spec.all_allowed(s) && Bool.not(Spec.has_double_dot(s, prev)) == Name.rest_ok(s, prev) : Bool}:
  match s:
    case SNil{}:
      {==}
    case SCon{+h, +t}:
      %rest_spec(t, Spec.is_dot(h)) : {Spec.all_allowed(SCon{h, t}) && Bool.not(Spec.has_double_dot(SCon{h, t}, prev)) == Name.char_ok(Spec.is_dot(h), Spec.is_slash(h), Spec.whitelisted(h), prev) && _ : Bool}
      spec_step(Spec.is_slash(h), Spec.whitelisted(h), Spec.is_dot(h), prev, Spec.all_allowed(t), Spec.has_double_dot(t, Spec.is_dot(h)))

def Laws.valid_is_spec(s):
  match s:
    case SNil{}:
      {==}
    case SCon{+h, +t}:
      rest_spec(SCon{h, t}, False{})

# Security
# --------
# An allowed string contains no slash: a slash is not allowed, and the tail is covered by induction.

def no_slash_step(sl: Bool, w: Bool, all: Bool, -slash: Bool, ih: {all && slash == False{} : Bool})
  -> {((Bool.not(sl) && w) && all) && (sl || slash) == False{} : Bool}:
  match sl w:
    case True{} _:
      {==}
    case False{} False{}:
      {==}
    case False{} True{}:
      ih

def allowed_no_slash(+s: String) -> {Spec.all_allowed(s) && Spec.has_slash(s) == False{} : Bool}:
  match s:
    case SNil{}:
      {==}
    case SCon{+h, t}:
      no_slash_step(Spec.is_slash(h), Spec.whitelisted(h), Spec.all_allowed(t), Spec.has_slash(t), allowed_no_slash(t))

# valid is (all allowed and no dot after a dot): it excludes whatever either half excludes.
def valid_excludes_dd(all: Bool, dd: Bool) -> {(all && Bool.not(dd)) && dd == False{} : Bool}:
  match all dd:
    case True{} True{}:
      {==}
    case True{} False{}:
      {==}
    case False{} _:
      {==}

def valid_excludes(all: Bool, dd: Bool, -slash: Bool, e: {all && slash == False{} : Bool})
  -> {(all && Bool.not(dd)) && slash == False{} : Bool}:
  match all dd:
    case True{} True{}:
      {==}
    case True{} False{}:
      e
    case False{} _:
      {==}

# The program's valid is the spec's, so each security law is a fact about the spec.

def Laws.valid_has_no_double_dot(s):
  match s:
    case SNil{}:
      {==}
    case SCon{+h, +t}:
      %Laws.valid_is_spec(SCon{h, t}) : {_ && Spec.has_double_dot(SCon{h, t}, False{}) == False{} : Bool}
      valid_excludes_dd(Spec.all_allowed(SCon{h, t}), Spec.has_double_dot(SCon{h, t}, False{}))

def Laws.valid_has_no_slash(s):
  match s:
    case SNil{}:
      {==}
    case SCon{+h, +t}:
      %Laws.valid_is_spec(SCon{h, t}) : {_ && Spec.has_slash(SCon{h, t}) == False{} : Bool}
      valid_excludes(Spec.all_allowed(SCon{h, t}), Spec.has_double_dot(SCon{h, t}, False{}), Spec.has_slash(SCon{h, t}), allowed_no_slash(SCon{h, t}))

# Witness
# -------

def Laws.valid_witness():
  ("a", {==})
