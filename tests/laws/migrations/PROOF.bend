# Migrations: the proofs. Inductions over the list; at each migration, its flags decide the step. A step whose
# goal mentions the tail's claim either takes it as ih, or first rewrites the tail with it (%e : P marks with _
# the place the claim's right side is replaced by its left side).

import Base
import ./main.bend as Main
import ./SPEC.bend as Spec
import ./LAWS.bend as Laws

# run('up', name)

def up_reach_step(le: Bool, u: Bool, rest: Bool, ih: {rest == True{} : Bool}) -> {Bool.and(Bool.or(Bool.not(le), Bool.or(u, le)), rest) == True{} : Bool}:
  match le u:
    case True{} True{}:
      ih
    case True{} False{}:
      ih
    case False{} True{}:
      ih
    case False{} False{}:
      ih

def Laws.up_to_reaches(xs, c):
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{id, +t, u}, r}:
      up_reach_step(Nat.is_le(t, c), u, Spec.all_le_up(Main.up_to_state(r, c), c), Laws.up_to_reaches(r, c))

def up_frame_step(le: Bool, u: Bool, rest: Bool, ih: {rest == True{} : Bool}) -> {Bool.and(Bool.or(le, Bool.not(Bool.xor(u, Bool.or(u, le)))), rest) == True{} : Bool}:
  match le u:
    case True{} True{}:
      ih
    case True{} False{}:
      ih
    case False{} True{}:
      ih
    case False{} False{}:
      ih

def Laws.up_to_frame(xs, c):
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{id, +t, +u}, r}:
      up_frame_step(Nat.is_le(t, c), u, Spec.frame_gt(r, Main.up_to_state(r, c), c), Laws.up_to_frame(r, c))

def up_ran_step(le: Bool, u: Bool, +id: Nat, rest: List<&2, Nat>) -> {Spec.keep(Bool.and(Bool.not(u), le), id, rest) == Spec.keep(Bool.xor(u, Bool.or(u, le)), id, rest) : List<&2, Nat>}:
  match le u:
    case True{} True{}:
      {==}
    case True{} False{}:
      {==}
    case False{} True{}:
      {==}
    case False{} False{}:
      {==}

def Laws.up_to_ran_is_change(xs, c):
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{+id, +t, +u}, r}:
      %Laws.up_to_ran_is_change(r, c) : {Spec.keep(Bool.and(Bool.not(u), Nat.is_le(t, c)), id, Main.up_to_ran(r, c)) == Spec.keep(Bool.xor(u, Bool.or(u, Nat.is_le(t, c))), id, _) : List<&2, Nat>}
      up_ran_step(Nat.is_le(t, c), u, id, Main.up_to_ran(r, c))

def Laws.up_to_keeps_ids(xs, c):
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{+id, t, u}, r}:
      %Laws.up_to_keeps_ids(r, c) : {id <> Spec.ids(Main.up_to_state(r, c)) == id <> _ : List<&2, Nat>}
      {==}

def up_idem_step(le: Bool, u: Bool, +id: Nat, rest: List<&2, Nat>, ih: {rest == Nil{} : List<&2, Nat>}) -> {Spec.keep(Bool.and(Bool.not(Bool.or(u, le)), le), id, rest) == Nil{} : List<&2, Nat>}:
  match le u:
    case True{} True{}:
      ih
    case True{} False{}:
      ih
    case False{} True{}:
      ih
    case False{} False{}:
      ih

def Laws.up_to_idempotent(xs, c):
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{+id, +t, u}, r}:
      up_idem_step(Nat.is_le(t, c), u, id, Main.up_to_ran(Main.up_to_state(r, c), c), Laws.up_to_idempotent(r, c))

# run('down', name)

def down_reach_step(ge: Bool, u: Bool, rest: Bool, ih: {rest == True{} : Bool}) -> {Bool.and(Bool.or(Bool.not(ge), Bool.not(Bool.and(u, Bool.not(ge)))), rest) == True{} : Bool}:
  match ge u:
    case True{} True{}:
      ih
    case True{} False{}:
      ih
    case False{} True{}:
      ih
    case False{} False{}:
      ih

def Laws.down_to_reaches(xs, c):
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{id, +t, u}, r}:
      down_reach_step(Nat.is_ge(t, c), u, Spec.all_ge_down(Main.down_to_state(r, c), c), Laws.down_to_reaches(r, c))

def down_frame_step(ge: Bool, u: Bool, rest: Bool, ih: {rest == True{} : Bool}) -> {Bool.and(Bool.or(ge, Bool.not(Bool.xor(u, Bool.and(u, Bool.not(ge))))), rest) == True{} : Bool}:
  match ge u:
    case True{} True{}:
      ih
    case True{} False{}:
      ih
    case False{} True{}:
      ih
    case False{} False{}:
      ih

def Laws.down_to_frame(xs, c):
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{id, +t, +u}, r}:
      down_frame_step(Nat.is_ge(t, c), u, Spec.frame_lt(r, Main.down_to_state(r, c), c), Laws.down_to_frame(r, c))

def down_ran_step(ge: Bool, u: Bool, +id: Nat, +acc: List<&2, Nat>) -> {Spec.keep(Bool.and(u, ge), id, acc) == Spec.keep(Bool.xor(u, Bool.and(u, Bool.not(ge))), id, acc) : List<&2, Nat>}:
  match ge u:
    case True{} True{}:
      {==}
    case True{} False{}:
      {==}
    case False{} True{}:
      {==}
    case False{} False{}:
      {==}

def Laws.down_to_ran_is_change(xs, c, acc):
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{+id, +t, +u}, r}:
      %down_ran_step(Nat.is_ge(t, c), u, id, acc) : {Main.down_to_ran(r, c, Spec.keep(Bool.and(u, Nat.is_ge(t, c)), id, acc)) == Spec.changed_latest_first(r, Main.down_to_state(r, c), _) : List<&2, Nat>}
      Laws.down_to_ran_is_change(r, c, Spec.keep(Bool.and(u, Nat.is_ge(t, c)), id, acc))

def Laws.down_to_keeps_ids(xs, c):
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{+id, t, u}, r}:
      %Laws.down_to_keeps_ids(r, c) : {id <> Spec.ids(Main.down_to_state(r, c)) == id <> _ : List<&2, Nat>}
      {==}

def down_idem_step(ge: Bool, u: Bool, +id: Nat, +r: List<&2, Spec.Mig>, +c: Nat, acc: List<&2, Nat>, ih: {Main.down_to_ran(r, c, acc) == acc : List<&2, Nat>}) -> {Main.down_to_ran(r, c, Spec.keep(Bool.and(Bool.and(u, Bool.not(ge)), ge), id, acc)) == acc : List<&2, Nat>}:
  match ge u:
    case True{} True{}:
      ih
    case True{} False{}:
      ih
    case False{} True{}:
      ih
    case False{} False{}:
      ih

def Laws.down_to_idempotent(xs, c, acc):
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{+id, +t, u}, r}:
      down_idem_step(Nat.is_ge(t, c), u, id, Main.down_to_state(r, c), c, acc, Laws.down_to_idempotent(r, c, acc))

# run('up') and run('down') without a name

def Laws.up_all_reaches(xs):
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{id, t, u}, r}:
      Laws.up_all_reaches(r)

def up_all_ran_step(u: Bool, +id: Nat, rest: List<&2, Nat>) -> {Spec.keep(Bool.not(u), id, rest) == Spec.keep(Bool.xor(u, True{}), id, rest) : List<&2, Nat>}:
  match u:
    case True{}:
      {==}
    case False{}:
      {==}

def Laws.up_all_ran_is_change(xs):
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{+id, t, +u}, r}:
      %Laws.up_all_ran_is_change(r) : {Spec.keep(Bool.not(u), id, Main.up_all_ran(r)) == Spec.keep(Bool.xor(u, True{}), id, _) : List<&2, Nat>}
      up_all_ran_step(u, id, Main.up_all_ran(r))

def Laws.up_all_keeps_ids(xs):
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{+id, t, u}, r}:
      %Laws.up_all_keeps_ids(r) : {id <> Spec.ids(Main.up_all_state(r)) == id <> _ : List<&2, Nat>}
      {==}

def Laws.down_all_reaches(xs):
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{id, t, u}, r}:
      Laws.down_all_reaches(r)

def down_all_ran_step(u: Bool, +id: Nat, +acc: List<&2, Nat>) -> {Spec.keep(u, id, acc) == Spec.keep(Bool.xor(u, False{}), id, acc) : List<&2, Nat>}:
  match u:
    case True{}:
      {==}
    case False{}:
      {==}

def Laws.down_all_ran_is_change(xs, acc):
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{+id, t, +u}, r}:
      %down_all_ran_step(u, id, acc) : {Main.down_all_ran(r, Spec.keep(u, id, acc)) == Spec.changed_latest_first(r, Main.down_all_state(r), _) : List<&2, Nat>}
      Laws.down_all_ran_is_change(r, Spec.keep(u, id, acc))

def Laws.down_all_keeps_ids(xs):
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{+id, t, u}, r}:
      %Laws.down_all_keeps_ids(r) : {id <> Spec.ids(Main.down_all_state(r)) == id <> _ : List<&2, Nat>}
      {==}

# run(direction, name, true)

def single_reach_step(eq: Bool, u: Bool, v: Bool, rest: Bool, ih: {rest == True{} : Bool}) -> {Bool.and(Bool.or(Bool.not(eq), Bool.not(Bool.xor(Bool.or(Bool.and(eq, v), Bool.and(Bool.not(eq), u)), v))), rest) == True{} : Bool}:
  match eq u v:
    case True{} True{} True{}:
      ih
    case True{} True{} False{}:
      ih
    case True{} False{} True{}:
      ih
    case True{} False{} False{}:
      ih
    case False{} True{} True{}:
      ih
    case False{} True{} False{}:
      ih
    case False{} False{} True{}:
      ih
    case False{} False{} False{}:
      ih

def Laws.single_reaches(xs, id, v):
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{+i, t, +u}, r}:
      single_reach_step(Nat.is_eq(i, id), u, v, Spec.all_with_id(Main.single_state(r, id, v), id, v), Laws.single_reaches(r, id, v))

def single_frame_step(eq: Bool, u: Bool, v: Bool, rest: Bool, ih: {rest == True{} : Bool}) -> {Bool.and(Bool.or(eq, Bool.not(Bool.xor(u, Bool.or(Bool.and(eq, v), Bool.and(Bool.not(eq), u))))), rest) == True{} : Bool}:
  match eq u v:
    case True{} True{} True{}:
      ih
    case True{} True{} False{}:
      ih
    case True{} False{} True{}:
      ih
    case True{} False{} False{}:
      ih
    case False{} True{} True{}:
      ih
    case False{} True{} False{}:
      ih
    case False{} False{} True{}:
      ih
    case False{} False{} False{}:
      ih

def Laws.single_frame(xs, id, v):
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{+i, t, +u}, r}:
      single_frame_step(Nat.is_eq(i, id), u, v, Spec.frame_id(r, Main.single_state(r, id, v), id), Laws.single_frame(r, id, v))

def Laws.single_keeps_ids(xs, id, v):
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{+i, t, u}, r}:
      %Laws.single_keeps_ids(r, id, v) : {i <> Spec.ids(Main.single_state(r, id, v)) == i <> _ : List<&2, Nat>}
      {==}

# Setting a state keeps which ids are present.
def contains_set(+xs: List<&2, Spec.Mig>, +id: Nat, +v: Bool) -> {Main.contains(xs, id) == Main.contains(Main.set_state(xs, id, v), id) : Bool}:
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{+i, t, u}, r}:
      %contains_set(r, id, v) : {Bool.or(Nat.is_eq(i, id), Main.contains(r, id)) == Bool.or(Nat.is_eq(i, id), _) : Bool}
      {==}

def state_set_step(eq: Bool, u: Bool, v: Bool, present: Bool) -> {Bool.and(Bool.or(eq, present), v) == Bool.or(Bool.and(eq, Bool.or(Bool.and(eq, v), Bool.and(Bool.not(eq), u))), Bool.and(present, v)) : Bool}:
  match eq u v present:
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
      {==}
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
      {==}
    case False{} False{} True{} False{}:
      {==}
    case False{} False{} False{} True{}:
      {==}
    case False{} False{} False{} False{}:
      {==}

# After the state of an id is set to v, the state of the id is v when it is present, else False.
def state_set(+xs: List<&2, Spec.Mig>, +id: Nat, +v: Bool) -> {Bool.and(Main.contains(xs, id), v) == Main.state_of(Main.set_state(xs, id, v), id) : Bool}:
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{+i, t, +u}, r}:
      %state_set(r, id, v) : {Bool.and(Bool.or(Nat.is_eq(i, id), Main.contains(r, id)), v) == Bool.or(Bool.and(Nat.is_eq(i, id), Bool.or(Bool.and(Nat.is_eq(i, id), v), Bool.and(Bool.not(Nat.is_eq(i, id)), u))), _) : Bool}
      state_set_step(Nat.is_eq(i, id), u, v, Main.contains(r, id))

def single_idem_step(present: Bool, v: Bool, +id: Nat) -> {Spec.keep(Bool.and(present, Bool.xor(Bool.and(present, v), v)), id, Nil{}) == Nil{} : List<&2, Nat>}:
  match present v:
    case True{} True{}:
      {==}
    case True{} False{}:
      {==}
    case False{} True{}:
      {==}
    case False{} False{}:
      {==}

def Laws.single_idempotent(xs, id, v):
  %contains_set(xs, id, v) : {Spec.keep(Bool.and(_, Bool.xor(Main.state_of(Main.set_state(xs, id, v), id), v)), id, Nil{}) == Nil{} : List<&2, Nat>}
  %state_set(xs, id, v) : {Spec.keep(Bool.and(Main.contains(xs, id), Bool.xor(_, v)), id, Nil{}) == Nil{} : List<&2, Nat>}
  single_idem_step(Main.contains(xs, id), v, id)

# contains in the model is has_id in the spec.
def has_is_contains(+xs: List<&2, Spec.Mig>, +id: Nat) -> {Spec.has_id(xs, id) == Main.contains(xs, id) : Bool}:
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{+i, t, u}, r}:
      %has_is_contains(r, id) : {Bool.or(Nat.is_eq(i, id), Spec.has_id(r, id)) == Bool.or(Nat.is_eq(i, id), _) : Bool}
      {==}

def single_absent(+xs: List<&2, Spec.Mig>, +id: Nat, +v: Bool, h: {False{} == Spec.has_id(xs, id) : Bool}) -> {Main.single_ran(xs, id, v) == Nil{} : List<&2, Nat>}:
  %has_is_contains(xs, id) : {Spec.keep(Bool.and(_, Bool.xor(Main.state_of(xs, id), v)), id, Nil{}) == Nil{} : List<&2, Nat>}
  %h : {Spec.keep(Bool.and(_, Bool.xor(Main.state_of(xs, id), v)), id, Nil{}) == Nil{} : List<&2, Nat>}
  {==}

def Laws.single_absent_runs_nothing(xs, id, v):
  h => single_absent(xs, id, v, h)

# prune

# One migration of remove, where eq is whether its id is the removed one.
def remove_step(eq: Bool, +i: Nat, +t: Nat, +u: Bool, +id: Nat, +rest: List<&2, Spec.Mig>, e: {eq == Nat.is_eq(i, id) : Bool}, ih: {Spec.has_id(rest, id) == False{} : Bool}) -> {Spec.has_id(Main.pick(eq, rest, Spec.M{i, t, u} <> rest), id) == False{} : Bool}:
  match eq:
    case True{}:
      ih
    case False{}:
      %e : {Bool.or(_, Spec.has_id(rest, id)) == False{} : Bool}
      ih

def Laws.remove_gone(xs, id):
  match xs:
    case Nil{}:
      {==}
    case Con{Spec.M{+i, +t, +u}, r}:
      remove_step(Nat.is_eq(i, id), i, t, u, id, Main.remove(r, id), {==}, Laws.remove_gone(r, id))
