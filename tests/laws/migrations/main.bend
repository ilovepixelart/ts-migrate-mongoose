import Base
import ./SPEC.bend as Spec

# Migrations: a reference model of the state Migrator.run, sync and prune change. LAWS.bend states what it must do
# against SPEC.bend; PROOF.bend proves it. Compiled to main.mjs, it is the oracle tests/laws/model.mjs runs the real
# Migrator against, from vitest and from the e2e laws scenario.
# The list is in the order the migrations collection sorts by: createdAt, then _id (insertion order).
# A migration is its id (stands for its name), its createdAt t, and whether it is up.

# a when b, else c
def pick(b: Bool, a: List<&2, Spec.Mig>, c: List<&2, Spec.Mig>) -> List<&2, Spec.Mig>:
  match b:
    case True{}:
      a
    case False{}:
      c

def pick_id(b: Bool, +a: Nat, +c: Nat) -> Nat:
  match b:
    case True{}:
      a
    case False{}:
      c

def after(+x: Spec.Mig, +m: Spec.Mig) -> Bool:
  match x m:
    case Spec.M{i, t, u} Spec.M{j, s, v}:
      Nat.is_gt(t, s)

# run('up', name): every pending migration with createdAt <= c (the named one's) goes up, in list order.
def up_to_state(xs: List<&2, Spec.Mig>, +c: Nat) -> List<&2, Spec.Mig>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{Spec.M{id, +t, u}, r}:
      Spec.M{id, t, Bool.or(u, Nat.is_le(t, c))} <> up_to_state(r, c)

def up_to_ran(xs: List<&2, Spec.Mig>, +c: Nat) -> List<&2, Nat>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{Spec.M{id, +t, u}, r}:
      Spec.keep(Bool.and(Bool.not(u), Nat.is_le(t, c)), id, up_to_ran(r, c))

# run('up'): every pending migration goes up, in list order.
def up_all_state(xs: List<&2, Spec.Mig>) -> List<&2, Spec.Mig>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{Spec.M{id, t, u}, r}:
      Spec.M{id, t, True{}} <> up_all_state(r)

def up_all_ran(xs: List<&2, Spec.Mig>) -> List<&2, Nat>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{Spec.M{id, t, u}, r}:
      Spec.keep(Bool.not(u), id, up_all_ran(r))

# run('down', name): every applied migration with createdAt >= c goes down, in reverse list order.
def down_to_state(xs: List<&2, Spec.Mig>, +c: Nat) -> List<&2, Spec.Mig>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{Spec.M{id, +t, u}, r}:
      Spec.M{id, t, Bool.and(u, Bool.not(Nat.is_ge(t, c)))} <> down_to_state(r, c)

def down_to_ran(xs: List<&2, Spec.Mig>, +c: Nat, acc: List<&2, Nat>) -> List<&2, Nat>:
  match xs:
    case Nil{}:
      acc
    case Con{Spec.M{id, +t, u}, r}:
      down_to_ran(r, c, Spec.keep(Bool.and(u, Nat.is_ge(t, c)), id, acc))

# run('down'): every applied migration goes down, in reverse list order.
def down_all_state(xs: List<&2, Spec.Mig>) -> List<&2, Spec.Mig>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{Spec.M{id, t, u}, r}:
      Spec.M{id, t, False{}} <> down_all_state(r)

def down_all_ran(xs: List<&2, Spec.Mig>, acc: List<&2, Nat>) -> List<&2, Nat>:
  match xs:
    case Nil{}:
      acc
    case Con{Spec.M{id, t, u}, r}:
      down_all_ran(r, Spec.keep(u, id, acc))

# Whether a migration with this id is present.
def contains(xs: List<&2, Spec.Mig>, +id: Nat) -> Bool:
  match xs:
    case Nil{}:
      False{}
    case Con{Spec.M{+i, t, u}, r}:
      Bool.or(Nat.is_eq(i, id), contains(r, id))

# The state of the migration with this id (False when there is none).
def state_of(xs: List<&2, Spec.Mig>, +id: Nat) -> Bool:
  match xs:
    case Nil{}:
      False{}
    case Con{Spec.M{+i, t, u}, r}:
      Bool.or(Bool.and(Nat.is_eq(i, id), u), state_of(r, id))

# Set the state of the migration with this id.
def set_state(xs: List<&2, Spec.Mig>, +id: Nat, +v: Bool) -> List<&2, Spec.Mig>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{Spec.M{+i, t, +u}, r}:
      Spec.M{i, t, Bool.or(Bool.and(Nat.is_eq(i, id), v), Bool.and(Bool.not(Nat.is_eq(i, id)), u))} <> set_state(r, id, v)

# run(direction, name, true), as specified: the named migration moves to v, and is reported only when it is present
# and was in the other state. Like the Migrator's updateMany by name, every migration with the id moves.
def single_state(xs: List<&2, Spec.Mig>, +id: Nat, +v: Bool) -> List<&2, Spec.Mig>:
  set_state(xs, id, v)

def single_ran(+xs: List<&2, Spec.Mig>, +id: Nat, +v: Bool) -> List<&2, Nat>:
  Spec.keep(Bool.and(contains(xs, id), Bool.xor(state_of(xs, id), v)), id, Nil{})

# The first pending migration (run('up', undefined, true)) and the last applied one (run('down', undefined, true)).
def first_down(xs: List<&2, Spec.Mig>, +none: Nat) -> Nat:
  match xs:
    case Nil{}:
      none
    case Con{Spec.M{id, t, u}, r}:
      match u:
        case True{}:
          first_down(r, none)
        case False{}:
          id

def last_up(xs: List<&2, Spec.Mig>, +acc: Nat) -> Nat:
  match xs:
    case Nil{}:
      acc
    case Con{Spec.M{+id, t, u}, r}:
      last_up(r, pick_id(u, id, acc))

# sync: a new migration goes after every migration with createdAt <= its own (ties keep insertion order).
def insert(xs: List<&2, Spec.Mig>, +m: Spec.Mig) -> List<&2, Spec.Mig>:
  match xs:
    case Nil{}:
      m <> Nil{}
    case Con{+x, +r}:
      pick(after(x, m), m <> (x <> r), x <> insert(r, m))

# prune: the migration with this id is gone.
def remove(xs: List<&2, Spec.Mig>, +id: Nat) -> List<&2, Spec.Mig>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{Spec.M{+i, t, u}, r}:
      +rest = remove(r, id)
      pick(Nat.is_eq(i, id), rest, Spec.M{i, t, u} <> rest)
