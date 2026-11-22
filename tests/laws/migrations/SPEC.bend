# Migrations: the specification LAWS.bend holds main.bend to. Not part of the model under test: keep this file and
# LAWS.bend unchanged when rewriting main.bend or PROOF.bend. main.bend uses the Mig type and keep from here.

import Base

# A migration: its id (stands for its name), its createdAt t, and whether it is up. A list of them is in the order
# the migrations collection sorts by: createdAt, then _id (insertion order).
type Mig is Data:
  M{id: Nat, t: Nat, up: Bool}

# x <> rest when b, else rest
def keep(b: Bool, +x: Nat, rest: List<&2, Nat>) -> List<&2, Nat>:
  match b:
    case True{}:
      x <> rest
    case False{}:
      rest

def ids(xs: List<&2, Mig>) -> List<&2, Nat>:
  match xs:
    case Nil{}:
      Nil{}
    case M{id, t, u} <> r:
      id <> ids(r)

# Whether a migration with this id is present.
def has_id(xs: List<&2, Mig>, +id: Nat) -> Bool:
  match xs:
    case Nil{}:
      False{}
    case M{+i, t, u} <> r:
      Nat.is_eq(i, id) || has_id(r, id)

# Order
# -----

# Every createdAt is at least lo, and each is at least the one before it.
def ordered_from(xs: List<&2, Mig>, +lo: Nat) -> Bool:
  match xs:
    case Nil{}:
      True{}
    case M{id, +t, u} <> r:
      Nat.is_le(lo, t) && ordered_from(r, t)

# In createdAt order, as the collection sorts.
def ordered(xs: List<&2, Mig>) -> Bool:
  ordered_from(xs, 0n)

# State
# -----

# Every migration with createdAt <= c is up.
def all_le_up(xs: List<&2, Mig>, +c: Nat) -> Bool:
  match xs:
    case Nil{}:
      True{}
    case M{id, +t, u} <> r:
      (Bool.not(Nat.is_le(t, c)) || u) && all_le_up(r, c)

# Every migration with createdAt >= c is down.
def all_ge_down(xs: List<&2, Mig>, +c: Nat) -> Bool:
  match xs:
    case Nil{}:
      True{}
    case M{id, +t, u} <> r:
      (Bool.not(Nat.is_ge(t, c)) || Bool.not(u)) && all_ge_down(r, c)

def all_up(xs: List<&2, Mig>) -> Bool:
  match xs:
    case Nil{}:
      True{}
    case M{id, t, u} <> r:
      u && all_up(r)

def all_down(xs: List<&2, Mig>) -> Bool:
  match xs:
    case Nil{}:
      True{}
    case M{id, t, u} <> r:
      Bool.not(u) && all_down(r)

# Every migration with this id is in state v.
def all_with_id(xs: List<&2, Mig>, +id: Nat, +v: Bool) -> Bool:
  match xs:
    case Nil{}:
      True{}
    case M{+i, t, +u} <> r:
      (Bool.not(Nat.is_eq(i, id)) || Bool.not(Bool.xor(u, v))) && all_with_id(r, id, v)

# Change
# ------
# The two lists must hold the same migrations, in the same order (the keeps_ids laws).

# The ids whose state differs, in list order.
def changed(xs: List<&2, Mig>, ys: List<&2, Mig>) -> List<&2, Nat>:
  match xs ys:
    case Con{M{id, t, u}, r} Con{M{j, s, v}, q}:
      keep(Bool.xor(u, v), id, changed(r, q))
    case _ _:
      Nil{}

# The same, latest first, in front of acc: the order run('down') reverts in.
def changed_latest_first(xs: List<&2, Mig>, ys: List<&2, Mig>, acc: List<&2, Nat>) -> List<&2, Nat>:
  match xs ys:
    case Con{M{id, t, u}, r} Con{M{j, s, v}, q}:
      changed_latest_first(r, q, keep(Bool.xor(u, v), id, acc))
    case _ _:
      acc

# Migrations created after c keep their state.
def frame_gt(xs: List<&2, Mig>, ys: List<&2, Mig>, +c: Nat) -> Bool:
  match xs ys:
    case Con{M{id, +t, +u}, r} Con{M{j, s, +v}, q}:
      (Nat.is_le(t, c) || Bool.not(Bool.xor(u, v))) && frame_gt(r, q, c)
    case Nil{} Nil{}:
      True{}
    case _ _:
      False{}

# Migrations created before c keep their state.
def frame_lt(xs: List<&2, Mig>, ys: List<&2, Mig>, +c: Nat) -> Bool:
  match xs ys:
    case Con{M{id, +t, +u}, r} Con{M{j, s, +v}, q}:
      (Nat.is_ge(t, c) || Bool.not(Bool.xor(u, v))) && frame_lt(r, q, c)
    case Nil{} Nil{}:
      True{}
    case _ _:
      False{}

# Migrations with another id keep their state.
def frame_id(xs: List<&2, Mig>, ys: List<&2, Mig>, +id: Nat) -> Bool:
  match xs ys:
    case Con{M{+i, t, +u}, r} Con{M{j, s, +v}, q}:
      (Nat.is_eq(i, id) || Bool.not(Bool.xor(u, v))) && frame_id(r, q, id)
    case Nil{} Nil{}:
      True{}
    case _ _:
      False{}

# Placement
# ---------

# The next migration, if any, was created after s.
def next_after(xs: List<&2, Mig>, +s: Nat) -> Bool:
  match xs:
    case Nil{}:
      True{}
    case M{id, t, u} <> r:
      Nat.is_gt(t, s)

# Every migration before the one with the id was created at or before s, and the one right after it after s: where
# the collection puts a migration created at s, after the ones with the same createdAt (they have smaller _ids).
def placed(xs: List<&2, Mig>, +id: Nat, +s: Nat) -> Bool:
  match xs:
    case Nil{}:
      False{}
    case M{+i, t, u} <> +r:
      (Nat.is_eq(i, id) && next_after(r, s)) || (Bool.not(Nat.is_eq(i, id)) && (Nat.is_le(t, s) && placed(r, id, s)))
