# Migration names: the specification LAWS.bend holds main.bend to. Not part of the program under test: keep this
# file and LAWS.bend unchanged when rewriting main.bend or PROOF.bend. main.bend reads the character classes from
# here, since the alphabet is part of the specification.

import Base

def is_code(+c: Char, k: U32) -> Bool:
  U32.is_eq(Char.to_u32(c), k)

def is_dot(+c: Char) -> Bool:
  is_code(c, 46)

# / or \
def is_slash(+c: Char) -> Bool:
  is_code(c, 47) || is_code(c, 92)

# A-Z, a-z, 0-9, ".", "_" and "-"
def whitelisted(+c: Char) -> Bool:
  Char.is_alpha(c) || Char.is_digit(c) || is_code(c, 46) || is_code(c, 95) || is_code(c, 45)

def allowed(+c: Char) -> Bool:
  Bool.not(is_slash(c)) && whitelisted(c)

def all_allowed(s: String) -> Bool:
  match s:
    case SNil{}:
      True{}
    case SCon{+h, t}:
      allowed(h) && all_allowed(t)

# Some dot follows a dot; prev says whether the char before the string was a dot.
def has_double_dot(s: String, prev: Bool) -> Bool:
  match s:
    case SNil{}:
      False{}
    case SCon{+h, t}:
      (is_dot(h) && prev) || has_double_dot(t, is_dot(h))

def has_slash(s: String) -> Bool:
  match s:
    case SNil{}:
      False{}
    case SCon{+h, t}:
      is_slash(h) || has_slash(t)

# A migration name is non-empty, uses only allowed characters, and never has a dot right after a dot.
def valid(+s: String) -> Bool:
  match s:
    case SNil{}:
      False{}
    case SCon{h, t}:
      all_allowed(SCon{h, t}) && Bool.not(has_double_dot(SCon{h, t}, False{}))
