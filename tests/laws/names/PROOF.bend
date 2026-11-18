# Migration names: the proofs. Inductions over the string; at each char, the flags of that char decide the step.

import Base
import ./main.bend as Name
import ./SPEC.bend as Spec
import ./LAWS.bend as Laws

# The spec and the program agree on one char, once the rest of the string is in its spec form (a: all allowed,
# hd: a dot follows a dot).
def spec_step(d: Bool, sl: Bool, w: Bool, prev: Bool, a: Bool, hd: Bool)
  -> {Bool.and(Bool.and(Bool.and(Bool.not(sl), w), a), Bool.not(Bool.or(Bool.and(d, prev), hd))) == Bool.and(Name.char_ok(d, sl, w, prev), Bool.and(a, Bool.not(hd))) : Bool}:
  match d sl w prev a hd:
    case True{} True{} True{} True{} True{} True{}:
      {==}
    case True{} True{} True{} True{} True{} False{}:
      {==}
    case True{} True{} True{} True{} False{} True{}:
      {==}
    case True{} True{} True{} True{} False{} False{}:
      {==}
    case True{} True{} True{} False{} True{} True{}:
      {==}
    case True{} True{} True{} False{} True{} False{}:
      {==}
    case True{} True{} True{} False{} False{} True{}:
      {==}
    case True{} True{} True{} False{} False{} False{}:
      {==}
    case True{} True{} False{} True{} True{} True{}:
      {==}
    case True{} True{} False{} True{} True{} False{}:
      {==}
    case True{} True{} False{} True{} False{} True{}:
      {==}
    case True{} True{} False{} True{} False{} False{}:
      {==}
    case True{} True{} False{} False{} True{} True{}:
      {==}
    case True{} True{} False{} False{} True{} False{}:
      {==}
    case True{} True{} False{} False{} False{} True{}:
      {==}
    case True{} True{} False{} False{} False{} False{}:
      {==}
    case True{} False{} True{} True{} True{} True{}:
      {==}
    case True{} False{} True{} True{} True{} False{}:
      {==}
    case True{} False{} True{} True{} False{} True{}:
      {==}
    case True{} False{} True{} True{} False{} False{}:
      {==}
    case True{} False{} True{} False{} True{} True{}:
      {==}
    case True{} False{} True{} False{} True{} False{}:
      {==}
    case True{} False{} True{} False{} False{} True{}:
      {==}
    case True{} False{} True{} False{} False{} False{}:
      {==}
    case True{} False{} False{} True{} True{} True{}:
      {==}
    case True{} False{} False{} True{} True{} False{}:
      {==}
    case True{} False{} False{} True{} False{} True{}:
      {==}
    case True{} False{} False{} True{} False{} False{}:
      {==}
    case True{} False{} False{} False{} True{} True{}:
      {==}
    case True{} False{} False{} False{} True{} False{}:
      {==}
    case True{} False{} False{} False{} False{} True{}:
      {==}
    case True{} False{} False{} False{} False{} False{}:
      {==}
    case False{} True{} True{} True{} True{} True{}:
      {==}
    case False{} True{} True{} True{} True{} False{}:
      {==}
    case False{} True{} True{} True{} False{} True{}:
      {==}
    case False{} True{} True{} True{} False{} False{}:
      {==}
    case False{} True{} True{} False{} True{} True{}:
      {==}
    case False{} True{} True{} False{} True{} False{}:
      {==}
    case False{} True{} True{} False{} False{} True{}:
      {==}
    case False{} True{} True{} False{} False{} False{}:
      {==}
    case False{} True{} False{} True{} True{} True{}:
      {==}
    case False{} True{} False{} True{} True{} False{}:
      {==}
    case False{} True{} False{} True{} False{} True{}:
      {==}
    case False{} True{} False{} True{} False{} False{}:
      {==}
    case False{} True{} False{} False{} True{} True{}:
      {==}
    case False{} True{} False{} False{} True{} False{}:
      {==}
    case False{} True{} False{} False{} False{} True{}:
      {==}
    case False{} True{} False{} False{} False{} False{}:
      {==}
    case False{} False{} True{} True{} True{} True{}:
      {==}
    case False{} False{} True{} True{} True{} False{}:
      {==}
    case False{} False{} True{} True{} False{} True{}:
      {==}
    case False{} False{} True{} True{} False{} False{}:
      {==}
    case False{} False{} True{} False{} True{} True{}:
      {==}
    case False{} False{} True{} False{} True{} False{}:
      {==}
    case False{} False{} True{} False{} False{} True{}:
      {==}
    case False{} False{} True{} False{} False{} False{}:
      {==}
    case False{} False{} False{} True{} True{} True{}:
      {==}
    case False{} False{} False{} True{} True{} False{}:
      {==}
    case False{} False{} False{} True{} False{} True{}:
      {==}
    case False{} False{} False{} True{} False{} False{}:
      {==}
    case False{} False{} False{} False{} True{} True{}:
      {==}
    case False{} False{} False{} False{} True{} False{}:
      {==}
    case False{} False{} False{} False{} False{} True{}:
      {==}
    case False{} False{} False{} False{} False{} False{}:
      {==}

# On every suffix, with any previous char, the spec's verdict is the program's.
def rest_spec(+s: String, +prev: Bool) -> {Bool.and(Spec.all_allowed(s), Bool.not(Spec.has_double_dot(s, prev))) == Name.rest_ok(s, prev) : Bool}:
  match s:
    case SNil{}:
      {==}
    case SCon{+h, +t}:
      %rest_spec(t, Spec.is_dot(h)) : {Bool.and(Spec.all_allowed(SCon{h, t}), Bool.not(Spec.has_double_dot(SCon{h, t}, prev))) == Bool.and(Name.char_ok(Spec.is_dot(h), Spec.is_slash(h), Spec.whitelisted(h), prev), _) : Bool}
      spec_step(Spec.is_dot(h), Spec.is_slash(h), Spec.whitelisted(h), prev, Spec.all_allowed(t), Spec.has_double_dot(t, Spec.is_dot(h)))

def Laws.valid_is_spec(s):
  match s:
    case SNil{}:
      {==}
    case SCon{+h, +t}:
      rest_spec(SCon{h, t}, False{})

# One char of rest_ok against one char of has_double_dot, given the claim for the tail.
def dd_step(d: Bool, sl: Bool, w: Bool, prev: Bool, +t: String, ih: {Bool.and(Name.rest_ok(t, d), Spec.has_double_dot(t, d)) == False{} : Bool}) -> {Bool.and(Bool.and(Name.char_ok(d, sl, w, prev), Name.rest_ok(t, d)), Bool.or(Bool.and(d, prev), Spec.has_double_dot(t, d))) == False{} : Bool}:
  match d sl w prev:
    case True{} True{} True{} True{}:
      {==}
    case True{} True{} True{} False{}:
      {==}
    case True{} True{} False{} True{}:
      {==}
    case True{} True{} False{} False{}:
      {==}
    case True{} False{} True{} True{}:
      {==}
    case True{} False{} True{} False{}:
      ih
    case True{} False{} False{} True{}:
      {==}
    case True{} False{} False{} False{}:
      {==}
    case False{} True{} True{} True{}:
      {==}
    case False{} True{} True{} False{}:
      {==}
    case False{} True{} False{} True{}:
      {==}
    case False{} True{} False{} False{}:
      {==}
    case False{} False{} True{} True{}:
      ih
    case False{} False{} True{} False{}:
      ih
    case False{} False{} False{} True{}:
      {==}
    case False{} False{} False{} False{}:
      {==}

def rest_no_double_dot(+s: String, prev: Bool) -> {Bool.and(Name.rest_ok(s, prev), Spec.has_double_dot(s, prev)) == False{} : Bool}:
  match s:
    case SNil{}:
      {==}
    case SCon{+h, t}:
      dd_step(Spec.is_dot(h), Spec.is_slash(h), Spec.whitelisted(h), prev, t, rest_no_double_dot(t, Spec.is_dot(h)))

def Laws.valid_has_no_double_dot(s):
  match s:
    case SNil{}:
      {==}
    case SCon{+h, t}:
      rest_no_double_dot(SCon{h, t}, False{})

# One char of rest_ok against one char of has_slash, given the claim for the tail.
def slash_step(d: Bool, sl: Bool, w: Bool, prev: Bool, +t: String, ih: {Bool.and(Name.rest_ok(t, d), Spec.has_slash(t)) == False{} : Bool}) -> {Bool.and(Bool.and(Name.char_ok(d, sl, w, prev), Name.rest_ok(t, d)), Bool.or(sl, Spec.has_slash(t))) == False{} : Bool}:
  match d sl w prev:
    case True{} True{} True{} True{}:
      {==}
    case True{} True{} True{} False{}:
      {==}
    case True{} True{} False{} True{}:
      {==}
    case True{} True{} False{} False{}:
      {==}
    case True{} False{} True{} True{}:
      {==}
    case True{} False{} True{} False{}:
      ih
    case True{} False{} False{} True{}:
      {==}
    case True{} False{} False{} False{}:
      {==}
    case False{} True{} True{} True{}:
      {==}
    case False{} True{} True{} False{}:
      {==}
    case False{} True{} False{} True{}:
      {==}
    case False{} True{} False{} False{}:
      {==}
    case False{} False{} True{} True{}:
      ih
    case False{} False{} True{} False{}:
      ih
    case False{} False{} False{} True{}:
      {==}
    case False{} False{} False{} False{}:
      {==}

def rest_no_slash(+s: String, prev: Bool) -> {Bool.and(Name.rest_ok(s, prev), Spec.has_slash(s)) == False{} : Bool}:
  match s:
    case SNil{}:
      {==}
    case SCon{+h, t}:
      slash_step(Spec.is_dot(h), Spec.is_slash(h), Spec.whitelisted(h), prev, t, rest_no_slash(t, Spec.is_dot(h)))

def Laws.valid_has_no_slash(s):
  match s:
    case SNil{}:
      {==}
    case SCon{+h, t}:
      rest_no_slash(SCon{h, t}, False{})

def Laws.valid_witness():
  ("a", {==})
