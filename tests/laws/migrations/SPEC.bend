# Migrations: the specification LAWS.bend states main.bend against. Not part of the model under test; keep it and
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
    case Con{M{id, t, u}, r}:
      id <> ids(r)

# The ids whose state differs between two lists of the same migrations, in list order.
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

# Every migration with createdAt <= c is up.
def all_le_up(xs: List<&2, Mig>, +c: Nat) -> Bool:
  match xs:
    case Nil{}:
      True{}
    case Con{M{id, +t, u}, r}:
      Bool.and(Bool.or(Bool.not(Nat.is_le(t, c)), u), all_le_up(r, c))

# Every migration with createdAt >= c is down.
def all_ge_down(xs: List<&2, Mig>, +c: Nat) -> Bool:
  match xs:
    case Nil{}:
      True{}
    case Con{M{id, +t, u}, r}:
      Bool.and(Bool.or(Bool.not(Nat.is_ge(t, c)), Bool.not(u)), all_ge_down(r, c))

def all_up(xs: List<&2, Mig>) -> Bool:
  match xs:
    case Nil{}:
      True{}
    case Con{M{id, t, u}, r}:
      Bool.and(u, all_up(r))

def all_down(xs: List<&2, Mig>) -> Bool:
  match xs:
    case Nil{}:
      True{}
    case Con{M{id, t, u}, r}:
      Bool.and(Bool.not(u), all_down(r))

# Migrations created after c keep their state from xs to ys (the lists must hold the same migrations).
def frame_gt(xs: List<&2, Mig>, ys: List<&2, Mig>, +c: Nat) -> Bool:
  match xs ys:
    case Con{M{id, +t, +u}, r} Con{M{j, s, +v}, q}:
      Bool.and(Bool.or(Nat.is_le(t, c), Bool.not(Bool.xor(u, v))), frame_gt(r, q, c))
    case Nil{} Nil{}:
      True{}
    case _ _:
      False{}

# Migrations created before c keep their state from xs to ys (the lists must hold the same migrations).
def frame_lt(xs: List<&2, Mig>, ys: List<&2, Mig>, +c: Nat) -> Bool:
  match xs ys:
    case Con{M{id, +t, +u}, r} Con{M{j, s, +v}, q}:
      Bool.and(Bool.or(Nat.is_ge(t, c), Bool.not(Bool.xor(u, v))), frame_lt(r, q, c))
    case Nil{} Nil{}:
      True{}
    case _ _:
      False{}

# Whether a migration with this id is present.
def has_id(xs: List<&2, Mig>, +id: Nat) -> Bool:
  match xs:
    case Nil{}:
      False{}
    case Con{M{+i, t, u}, r}:
      Bool.or(Nat.is_eq(i, id), has_id(r, id))

# Every migration with this id is in state v.
def all_with_id(xs: List<&2, Mig>, +id: Nat, +v: Bool) -> Bool:
  match xs:
    case Nil{}:
      True{}
    case Con{M{+i, t, +u}, r}:
      Bool.and(Bool.or(Bool.not(Nat.is_eq(i, id)), Bool.not(Bool.xor(u, v))), all_with_id(r, id, v))

# Every migration with another id keeps its state from xs to ys (the lists must hold the same migrations).
def frame_id(xs: List<&2, Mig>, ys: List<&2, Mig>, +id: Nat) -> Bool:
  match xs ys:
    case Con{M{+i, t, +u}, r} Con{M{j, s, +v}, q}:
      Bool.and(Bool.or(Nat.is_eq(i, id), Bool.not(Bool.xor(u, v))), frame_id(r, q, id))
    case Nil{} Nil{}:
      True{}
    case _ _:
      False{}
