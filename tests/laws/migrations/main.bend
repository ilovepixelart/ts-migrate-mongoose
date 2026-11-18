# Migrations: a model of the state Migrator.sync, prune and run change, driven by the commands the tests send the
# real Migrator. LAWS.bend states what each command must do and what every history keeps; PROOF.bend proves it.
# Compiled to main.mjs, step is the oracle tests/laws/model.mjs compares the real Migrator with, command by command.
#
# The state is the list of migrations in the order the collection sorts them: createdAt, then insertion order.

import Base
import ./SPEC.bend as Spec

type Cmd is Data:
  Add{id: Nat, t: Nat}          # a new migration file created at t, synced
  Remove{id: Nat}               # its file deleted, pruned
  UpTo{c: Nat}                  # run('up', name): name created at c
  DownTo{c: Nat}                # run('down', name): name created at c
  UpAll{}                       # run('up')
  DownAll{}                     # run('down')
  Single{id: Nat, up: Bool}     # run(up ? 'up' : 'down', name, true)
  NextUp{}                      # run('up', undefined, true): the first pending migration
  LastDown{}                    # run('down', undefined, true): the last applied migration

# run('up', name)
# ---------------
# Every pending migration created at or before c goes up, in list order.

def up_to_state(xs: List<&2, Spec.Mig>, +c: Nat) -> List<&2, Spec.Mig>:
  match xs:
    case Nil{}:
      Nil{}
    case Spec.M{id, +t, u} <> r:
      Spec.M{id, t, u || Nat.is_le(t, c)} <> up_to_state(r, c)

def up_to_ran(xs: List<&2, Spec.Mig>, +c: Nat) -> List<&2, Nat>:
  match xs:
    case Nil{}:
      Nil{}
    case Spec.M{id, +t, u} <> r:
      Spec.keep(Bool.not(u) && Nat.is_le(t, c), id, up_to_ran(r, c))

# run('down', name)
# -----------------
# Every applied migration created at or after c goes down, latest first.

def down_to_state(xs: List<&2, Spec.Mig>, +c: Nat) -> List<&2, Spec.Mig>:
  match xs:
    case Nil{}:
      Nil{}
    case Spec.M{id, +t, u} <> r:
      Spec.M{id, t, u && Bool.not(Nat.is_ge(t, c))} <> down_to_state(r, c)

def down_to_ran(xs: List<&2, Spec.Mig>, +c: Nat, acc: List<&2, Nat>) -> List<&2, Nat>:
  match xs:
    case Nil{}:
      acc
    case Spec.M{id, +t, u} <> r:
      down_to_ran(r, c, Spec.keep(u && Nat.is_ge(t, c), id, acc))

# run('up') and run('down')
# -------------------------

def up_all_state(xs: List<&2, Spec.Mig>) -> List<&2, Spec.Mig>:
  match xs:
    case Nil{}:
      Nil{}
    case Spec.M{id, t, u} <> r:
      Spec.M{id, t, True{}} <> up_all_state(r)

def up_all_ran(xs: List<&2, Spec.Mig>) -> List<&2, Nat>:
  match xs:
    case Nil{}:
      Nil{}
    case Spec.M{id, t, u} <> r:
      Spec.keep(Bool.not(u), id, up_all_ran(r))

def down_all_state(xs: List<&2, Spec.Mig>) -> List<&2, Spec.Mig>:
  match xs:
    case Nil{}:
      Nil{}
    case Spec.M{id, t, u} <> r:
      Spec.M{id, t, False{}} <> down_all_state(r)

def down_all_ran(xs: List<&2, Spec.Mig>, acc: List<&2, Nat>) -> List<&2, Nat>:
  match xs:
    case Nil{}:
      acc
    case Spec.M{id, t, u} <> r:
      down_all_ran(r, Spec.keep(u, id, acc))

# run(direction, name, true)
# --------------------------
# Every migration with the id moves to v (the Migrator updates by name); the id is reported only when it is present
# and was in the other state.

def contains(xs: List<&2, Spec.Mig>, +id: Nat) -> Bool:
  match xs:
    case Nil{}:
      False{}
    case Spec.M{+i, t, u} <> r:
      Nat.is_eq(i, id) || contains(r, id)

# Whether a migration with the id is up.
def state_of(xs: List<&2, Spec.Mig>, +id: Nat) -> Bool:
  match xs:
    case Nil{}:
      False{}
    case Spec.M{+i, t, u} <> r:
      (Nat.is_eq(i, id) && u) || state_of(r, id)

def set_state(xs: List<&2, Spec.Mig>, +id: Nat, +v: Bool) -> List<&2, Spec.Mig>:
  match xs:
    case Nil{}:
      Nil{}
    case Spec.M{+i, t, +u} <> r:
      Spec.M{i, t, (Nat.is_eq(i, id) && v) || (Bool.not(Nat.is_eq(i, id)) && u)} <> set_state(r, id, v)

def single_ran(+xs: List<&2, Spec.Mig>, +id: Nat, +v: Bool) -> List<&2, Nat>:
  Spec.keep(contains(xs, id) && Bool.xor(state_of(xs, id), v), id, Nil{})

def first_down(xs: List<&2, Spec.Mig>) -> Maybe<&2, Nat>:
  match xs:
    case Nil{}:
      None{}
    case Spec.M{id, t, u} <> r:
      match u:
        case True{}:
          first_down(r)
        case False{}:
          Some{id}

def last_up(xs: List<&2, Spec.Mig>, last: Maybe<&2, Nat>) -> Maybe<&2, Nat>:
  match xs:
    case Nil{}:
      last
    case Spec.M{+id, t, u} <> r:
      last_up(r, Bool.pick(Maybe<&2, Nat>, u, Some{id}, last))

# The single step on the found migration, if any.
def single_found_state(+xs: List<&2, Spec.Mig>, found: Maybe<&2, Nat>, +v: Bool) -> List<&2, Spec.Mig>:
  match found:
    case None{}:
      xs
    case Some{id}:
      set_state(xs, id, v)

def single_found_ran(+xs: List<&2, Spec.Mig>, found: Maybe<&2, Nat>, +v: Bool) -> List<&2, Nat>:
  match found:
    case None{}:
      Nil{}
    case Some{id}:
      single_ran(xs, id, v)

# sync and prune
# --------------

# x was created after m.
def after(+x: Spec.Mig, +m: Spec.Mig) -> Bool:
  match x m:
    case Spec.M{i, t, u} Spec.M{j, s, v}:
      Nat.is_gt(t, s)

# A new migration goes after every migration created at or before it.
def insert(xs: List<&2, Spec.Mig>, +m: Spec.Mig) -> List<&2, Spec.Mig>:
  match xs:
    case Nil{}:
      m <> Nil{}
    case +x <> +r:
      Bool.pick(List<&2, Spec.Mig>, after(x, m), m <> x <> r, x <> insert(r, m))

def remove(xs: List<&2, Spec.Mig>, +id: Nat) -> List<&2, Spec.Mig>:
  match xs:
    case Nil{}:
      Nil{}
    case Spec.M{+i, t, u} <> r:
      +rest = remove(r, id)
      Bool.pick(List<&2, Spec.Mig>, Nat.is_eq(i, id), rest, Spec.M{i, t, u} <> rest)

# Commands
# --------

def step_state(+xs: List<&2, Spec.Mig>, cmd: Cmd) -> List<&2, Spec.Mig>:
  match cmd:
    case Add{id, t}:
      insert(xs, Spec.M{id, t, False{}})
    case Remove{id}:
      remove(xs, id)
    case UpTo{c}:
      up_to_state(xs, c)
    case DownTo{c}:
      down_to_state(xs, c)
    case UpAll{}:
      up_all_state(xs)
    case DownAll{}:
      down_all_state(xs)
    case Single{id, up}:
      set_state(xs, id, up)
    case NextUp{}:
      single_found_state(xs, first_down(xs), True{})
    case LastDown{}:
      single_found_state(xs, last_up(xs, None{}), False{})

# The ids the command runs, in the order it runs them.
def step_ran(+xs: List<&2, Spec.Mig>, cmd: Cmd) -> List<&2, Nat>:
  match cmd:
    case Add{id, t}:
      Nil{}
    case Remove{id}:
      Nil{}
    case UpTo{c}:
      up_to_ran(xs, c)
    case DownTo{c}:
      down_to_ran(xs, c, Nil{})
    case UpAll{}:
      up_all_ran(xs)
    case DownAll{}:
      down_all_ran(xs, Nil{})
    case Single{id, up}:
      single_ran(xs, id, up)
    case NextUp{}:
      single_found_ran(xs, first_down(xs), True{})
    case LastDown{}:
      single_found_ran(xs, last_up(xs, None{}), False{})

# The state after the command, and the ids it ran.
def step(+xs: List<&2, Spec.Mig>, +cmd: Cmd) -> List<&2, Spec.Mig> & List<&2, Nat>:
  (step_state(xs, cmd), step_ran(xs, cmd))

# The state after the commands, run in order from xs.
def replay(cmds: List<&2, Cmd>, xs: List<&2, Spec.Mig>) -> List<&2, Spec.Mig>:
  match cmds:
    case Nil{}:
      xs
    case cmd <> rest:
      replay(rest, step_state(xs, cmd))
