# Migrations: the proofs.
#
# The run laws go by induction on the list: at each migration, the step lemma splits only on the flags that decide
# it (whether it is in range, its state), and the tail arrives as the induction hypothesis ih, or is first rewritten
# with it (%e : P marks with _ where e's right side becomes its left side).
#
# The history law is an invariant: the empty list is ordered, and every command keeps a list ordered. The state
# changes keep every createdAt, so they keep the order as it is; remove drops elements of an ordered list; insert
# puts the new migration after every one created at or before it. Those two need three facts about the order of
# Nat: 0 is least, it is transitive, and a > b or a <= b.

import Base
import ./main.bend as Main
import ./SPEC.bend as Spec
import ./LAWS.bend as Laws

# Proof kit
# ---------
# T(b) is the truth of b as a type: Unit when True, Empty when False, so a computed check is a proof by conversion.

def T(b: Bool) -> Data:
  match b:
    case True{}:
      Unit
    case False{}:
      Empty

def sym(-A: Type, -a: A, -b: A, e: {a == b : A}) -> {b == a : A}:
  %e : {_ == a : A}
  {==}

def holds(+b: Bool, w: T(b)) -> {b == True{} : Bool}:
  match b:
    case True{}:
      {==}
    case False{}:
      Empty.absurd({False{} == True{} : Bool}, w)

def true_of(-b: Bool, e: {True{} == b : Bool}) -> T(b):
  %e : T(_)
  Unit{}

def and_split(+a: Bool, -b: Bool, w: T(a && b), -P: Type, f: T(a) -> T(b) -> P) -> P:
  match a:
    case True{}:
      f(Unit{}, w)
    case False{}:
      Empty.absurd(P, w)

def and_intro(+a: Bool, -b: Bool, wa: T(a), wb: T(b)) -> T(a && b):
  match a:
    case True{}:
      wb
    case False{}:
      Empty.absurd(T(False{} && b), wa)

# A proof about Bool.pick(c, a, b), from one for a when c holds and one for b when it does not.
def pick_split(-A: Type, -P: A -> Type, +c: Bool, -a: A, -b: A,
  t: {True{} == c : Bool} -> P(a),
  f: {False{} == c : Bool} -> P(b)) -> P(Bool.pick(A, c, a, b)):
  match c:
    case True{}:
      t({==})
    case False{}:
      f({==})

# Order of Nat
# ------------

def zero_le(+n: Nat) -> T(Nat.is_le(0n, n)):
  match n:
    case 0n:
      Unit{}
    case 1n+p:
      Unit{}

def le_trans(a: Nat, b: Nat, c: Nat, ab: T(Nat.is_le(a, b)), bc: T(Nat.is_le(b, c))) -> T(Nat.is_le(a, c)):
  match a b c:
    case 0n b0 c0:
      zero_le(c0)
    case 1n+ap 0n c0:
      Empty.absurd(T(Nat.is_le(1n+ap, c0)), ab)
    case 1n+ap 1n+bp 0n:
      Empty.absurd(T(Nat.is_le(1n+ap, 0n)), bc)
    case 1n+ap 1n+bp 1n+cp:
      le_trans(ap, bp, cp, ab, bc)

def gt_le(a: Nat, b: Nat, g: T(Nat.is_gt(a, b))) -> T(Nat.is_le(b, a)):
  match a b:
    case 0n 0n:
      Empty.absurd(T(Nat.is_le(0n, 0n)), g)
    case 0n 1n+bp:
      Empty.absurd(T(Nat.is_le(1n+bp, 0n)), g)
    case 1n+ap 0n:
      Unit{}
    case 1n+ap 1n+bp:
      gt_le(ap, bp, g)

def not_gt_le(a: Nat, b: Nat, e: {Nat.is_gt(a, b) == False{} : Bool}) -> T(Nat.is_le(a, b)):
  match a b:
    case 0n 0n:
      Unit{}
    case 0n 1n+bp:
      Unit{}
    case 1n+ap 0n:
      %e : T(_)
      Unit{}
    case 1n+ap 1n+bp:
      not_gt_le(ap, bp, e)

# History
# -------

# A list ordered from t is ordered from any lo <= t.
def ordered_weaken(xs: List<&2, Spec.Mig>, +lo: Nat, +t: Nat, w: T(Nat.is_le(lo, t)), o: T(Spec.ordered_from(xs, t)))
  -> T(Spec.ordered_from(xs, lo)):
  match xs:
    case Nil{}:
      Unit{}
    case Spec.M{id, +t2, u} <> r:
      and_split(Nat.is_le(t, t2), Spec.ordered_from(r, t2), o, T(Nat.is_le(lo, t2) && Spec.ordered_from(r, t2)),
        l => rest => and_intro(Nat.is_le(lo, t2), Spec.ordered_from(r, t2), le_trans(lo, t, t2, w, l), rest))

# The state changes keep every createdAt, so they keep the order as it is.

def up_to_order(+xs: List<&2, Spec.Mig>, +c: Nat, +lo: Nat) -> {Spec.ordered_from(xs, lo) == Spec.ordered_from(Main.up_to_state(xs, c), lo) : Bool}:
  match xs:
    case Nil{}:
      {==}
    case Spec.M{id, +t, u} <> r:
      %up_to_order(r, c, t) : {Nat.is_le(lo, t) && Spec.ordered_from(r, t) == Nat.is_le(lo, t) && _ : Bool}
      {==}

def down_to_order(+xs: List<&2, Spec.Mig>, +c: Nat, +lo: Nat) -> {Spec.ordered_from(xs, lo) == Spec.ordered_from(Main.down_to_state(xs, c), lo) : Bool}:
  match xs:
    case Nil{}:
      {==}
    case Spec.M{id, +t, u} <> r:
      %down_to_order(r, c, t) : {Nat.is_le(lo, t) && Spec.ordered_from(r, t) == Nat.is_le(lo, t) && _ : Bool}
      {==}

def up_all_order(+xs: List<&2, Spec.Mig>, +lo: Nat) -> {Spec.ordered_from(xs, lo) == Spec.ordered_from(Main.up_all_state(xs), lo) : Bool}:
  match xs:
    case Nil{}:
      {==}
    case Spec.M{id, +t, u} <> r:
      %up_all_order(r, t) : {Nat.is_le(lo, t) && Spec.ordered_from(r, t) == Nat.is_le(lo, t) && _ : Bool}
      {==}

def down_all_order(+xs: List<&2, Spec.Mig>, +lo: Nat) -> {Spec.ordered_from(xs, lo) == Spec.ordered_from(Main.down_all_state(xs), lo) : Bool}:
  match xs:
    case Nil{}:
      {==}
    case Spec.M{id, +t, u} <> r:
      %down_all_order(r, t) : {Nat.is_le(lo, t) && Spec.ordered_from(r, t) == Nat.is_le(lo, t) && _ : Bool}
      {==}

def set_order(+xs: List<&2, Spec.Mig>, +id: Nat, +v: Bool, +lo: Nat) -> {Spec.ordered_from(xs, lo) == Spec.ordered_from(Main.set_state(xs, id, v), lo) : Bool}:
  match xs:
    case Nil{}:
      {==}
    case Spec.M{i, +t, u} <> r:
      %set_order(r, id, v, t) : {Nat.is_le(lo, t) && Spec.ordered_from(r, t) == Nat.is_le(lo, t) && _ : Bool}
      {==}

def found_order(+xs: List<&2, Spec.Mig>, found: Maybe<&2, Nat>, +v: Bool, +lo: Nat, +o: T(Spec.ordered_from(xs, lo)))
  -> T(Spec.ordered_from(Main.single_found_state(xs, found, v), lo)):
  match found:
    case None{}:
      o
    case Some{id}:
      %set_order(xs, id, v, lo) : T(_)
      o

# remove keeps the rest in order: a dropped migration's lower bound passes to the next one.
def remove_order(xs: List<&2, Spec.Mig>, +id: Nat, +lo: Nat, +o: T(Spec.ordered_from(xs, lo)))
  -> T(Spec.ordered_from(Main.remove(xs, id), lo)):
  match xs:
    case Nil{}:
      Unit{}
    case Spec.M{+i, +t, +u} <> +r:
      pick_split(List<&2, Spec.Mig>, ys => T(Spec.ordered_from(ys, lo)), Nat.is_eq(i, id), Main.remove(r, id), Spec.M{i, t, u} <> Main.remove(r, id),
        e => and_split(Nat.is_le(lo, t), Spec.ordered_from(r, t), o, T(Spec.ordered_from(Main.remove(r, id), lo)),
          l => rest => ordered_weaken(Main.remove(r, id), lo, t, l, remove_order(r, id, t, rest))),
        e => and_split(Nat.is_le(lo, t), Spec.ordered_from(r, t), o, T(Nat.is_le(lo, t) && Spec.ordered_from(Main.remove(r, id), t)),
          l => rest => and_intro(Nat.is_le(lo, t), Spec.ordered_from(Main.remove(r, id), t), l, remove_order(r, id, t, rest))))

# insert puts the new migration (created at s) before the first one created after it.
def insert_order(xs: List<&2, Spec.Mig>, +id: Nat, +s: Nat, +lo: Nat, +ls: T(Nat.is_le(lo, s)), +o: T(Spec.ordered_from(xs, lo)))
  -> T(Spec.ordered_from(Main.insert(xs, Spec.M{id, s, False{}}), lo)):
  match xs:
    case Nil{}:
      and_intro(Nat.is_le(lo, s), True{}, ls, Unit{})
    case Spec.M{+i, +t, +u} <> +r:
      pick_split(List<&2, Spec.Mig>, ys => T(Spec.ordered_from(ys, lo)), Nat.is_gt(t, s),
        Spec.M{id, s, False{}} <> Spec.M{i, t, u} <> r, Spec.M{i, t, u} <> Main.insert(r, Spec.M{id, s, False{}}),
        e => and_split(Nat.is_le(lo, t), Spec.ordered_from(r, t), o, T(Nat.is_le(lo, s) && (Nat.is_le(s, t) && Spec.ordered_from(r, t))),
          l => rest => and_intro(Nat.is_le(lo, s), Nat.is_le(s, t) && Spec.ordered_from(r, t), ls,
            and_intro(Nat.is_le(s, t), Spec.ordered_from(r, t), gt_le(t, s, true_of(Nat.is_gt(t, s), e)), rest))),
        e => and_split(Nat.is_le(lo, t), Spec.ordered_from(r, t), o, T(Nat.is_le(lo, t) && Spec.ordered_from(Main.insert(r, Spec.M{id, s, False{}}), t)),
          l => rest => and_intro(Nat.is_le(lo, t), Spec.ordered_from(Main.insert(r, Spec.M{id, s, False{}}), t), l,
            insert_order(r, id, s, t, not_gt_le(t, s, sym(Bool, False{}, Nat.is_gt(t, s), e)), rest))))

def step_order(+xs: List<&2, Spec.Mig>, cmd: Main.Cmd, +o: T(Spec.ordered(xs))) -> T(Spec.ordered(Main.step_state(xs, cmd))):
  match cmd:
    case Main.Add{id, +t}:
      insert_order(xs, id, t, 0n, zero_le(t), o)
    case Main.Remove{id}:
      remove_order(xs, id, 0n, o)
    case Main.UpTo{c}:
      %up_to_order(xs, c, 0n) : T(_)
      o
    case Main.DownTo{c}:
      %down_to_order(xs, c, 0n) : T(_)
      o
    case Main.UpAll{}:
      %up_all_order(xs, 0n) : T(_)
      o
    case Main.DownAll{}:
      %down_all_order(xs, 0n) : T(_)
      o
    case Main.Single{id, up}:
      %set_order(xs, id, up, 0n) : T(_)
      o
    case Main.NextUp{}:
      found_order(xs, Main.first_down(xs), True{}, 0n, o)
    case Main.LastDown{}:
      found_order(xs, Main.last_up(xs, None{}), False{}, 0n, o)

def replay_order(cmds: List<&2, Main.Cmd>, +xs: List<&2, Spec.Mig>, +o: T(Spec.ordered(xs))) -> T(Spec.ordered(Main.replay(cmds, xs))):
  match cmds:
    case Nil{}:
      o
    case +cmd <> rest:
      replay_order(rest, Main.step_state(xs, cmd), step_order(xs, cmd, o))

def Laws.replay_ordered(cmds):
  holds(Spec.ordered(Main.replay(cmds, Nil{})), replay_order(cmds, Nil{}, Unit{}))

# run('up', name)
# ---------------
# le: the migration was created at or before c; u: it was up.

def up_reach_step(le: Bool, u: Bool, -rest: Bool, ih: {rest == True{} : Bool})
  -> {(Bool.not(le) || (u || le)) && rest == True{} : Bool}:
  match le u:
    case True{} True{}:
      ih
    case True{} False{}:
      ih
    case False{} _:
      ih

def Laws.up_to_reaches(xs, c):
  match xs:
    case Nil{}:
      {==}
    case Spec.M{id, +t, u} <> r:
      up_reach_step(Nat.is_le(t, c), u, Spec.all_le_up(Main.up_to_state(r, c), c), Laws.up_to_reaches(r, c))

def up_frame_step(le: Bool, u: Bool, -rest: Bool, ih: {rest == True{} : Bool})
  -> {(le || Bool.not(Bool.xor(u, u || le))) && rest == True{} : Bool}:
  match le u:
    case True{} _:
      ih
    case False{} True{}:
      ih
    case False{} False{}:
      ih

def Laws.up_to_frame(xs, c):
  match xs:
    case Nil{}:
      {==}
    case Spec.M{id, +t, +u} <> r:
      up_frame_step(Nat.is_le(t, c), u, Spec.frame_gt(r, Main.up_to_state(r, c), c), Laws.up_to_frame(r, c))

def up_ran_step(u: Bool, -le: Bool, +id: Nat, -rest: List<&2, Nat>)
  -> {Spec.keep(Bool.not(u) && le, id, rest) == Spec.keep(Bool.xor(u, u || le), id, rest) : List<&2, Nat>}:
  match u:
    case True{}:
      {==}
    case False{}:
      {==}

def Laws.up_to_ran_is_change(xs, c):
  match xs:
    case Nil{}:
      {==}
    case Spec.M{+id, +t, +u} <> r:
      %Laws.up_to_ran_is_change(r, c) : {Spec.keep(Bool.not(u) && Nat.is_le(t, c), id, Main.up_to_ran(r, c)) == Spec.keep(Bool.xor(u, u || Nat.is_le(t, c)), id, _) : List<&2, Nat>}
      up_ran_step(u, Nat.is_le(t, c), id, Main.up_to_ran(r, c))

def Laws.up_to_keeps_ids(xs, c):
  match xs:
    case Nil{}:
      {==}
    case Spec.M{+id, t, u} <> r:
      %Laws.up_to_keeps_ids(r, c) : {id <> Spec.ids(Main.up_to_state(r, c)) == id <> _ : List<&2, Nat>}
      {==}

def up_idem_step(u: Bool, le: Bool, +id: Nat, -rest: List<&2, Nat>, ih: {rest == Nil{} : List<&2, Nat>})
  -> {Spec.keep(Bool.not(u || le) && le, id, rest) == Nil{} : List<&2, Nat>}:
  match u le:
    case True{} _:
      ih
    case False{} True{}:
      ih
    case False{} False{}:
      ih

def Laws.up_to_idempotent(xs, c):
  match xs:
    case Nil{}:
      {==}
    case Spec.M{+id, +t, u} <> r:
      up_idem_step(u, Nat.is_le(t, c), id, Main.up_to_ran(Main.up_to_state(r, c), c), Laws.up_to_idempotent(r, c))

# run('down', name)
# -----------------
# ge: the migration was created at or after c; u: it was up.

def down_reach_step(ge: Bool, u: Bool, -rest: Bool, ih: {rest == True{} : Bool})
  -> {(Bool.not(ge) || Bool.not(u && Bool.not(ge))) && rest == True{} : Bool}:
  match ge u:
    case True{} True{}:
      ih
    case True{} False{}:
      ih
    case False{} _:
      ih

def Laws.down_to_reaches(xs, c):
  match xs:
    case Nil{}:
      {==}
    case Spec.M{id, +t, u} <> r:
      down_reach_step(Nat.is_ge(t, c), u, Spec.all_ge_down(Main.down_to_state(r, c), c), Laws.down_to_reaches(r, c))

def down_frame_step(ge: Bool, u: Bool, -rest: Bool, ih: {rest == True{} : Bool})
  -> {(ge || Bool.not(Bool.xor(u, u && Bool.not(ge)))) && rest == True{} : Bool}:
  match ge u:
    case True{} _:
      ih
    case False{} True{}:
      ih
    case False{} False{}:
      ih

def Laws.down_to_frame(xs, c):
  match xs:
    case Nil{}:
      {==}
    case Spec.M{id, +t, +u} <> r:
      down_frame_step(Nat.is_ge(t, c), u, Spec.frame_lt(r, Main.down_to_state(r, c), c), Laws.down_to_frame(r, c))

def down_ran_step(u: Bool, ge: Bool, +id: Nat, +acc: List<&2, Nat>)
  -> {Spec.keep(u && ge, id, acc) == Spec.keep(Bool.xor(u, u && Bool.not(ge)), id, acc) : List<&2, Nat>}:
  match u ge:
    case True{} True{}:
      {==}
    case True{} False{}:
      {==}
    case False{} _:
      {==}

def Laws.down_to_ran_is_change(xs, c, acc):
  match xs:
    case Nil{}:
      {==}
    case Spec.M{+id, +t, +u} <> r:
      %down_ran_step(u, Nat.is_ge(t, c), id, acc) : {Main.down_to_ran(r, c, Spec.keep(u && Nat.is_ge(t, c), id, acc)) == Spec.changed_latest_first(r, Main.down_to_state(r, c), _) : List<&2, Nat>}
      Laws.down_to_ran_is_change(r, c, Spec.keep(u && Nat.is_ge(t, c), id, acc))

def Laws.down_to_keeps_ids(xs, c):
  match xs:
    case Nil{}:
      {==}
    case Spec.M{+id, t, u} <> r:
      %Laws.down_to_keeps_ids(r, c) : {id <> Spec.ids(Main.down_to_state(r, c)) == id <> _ : List<&2, Nat>}
      {==}

def down_idem_step(u: Bool, ge: Bool, +id: Nat, +r: List<&2, Spec.Mig>, +c: Nat, acc: List<&2, Nat>,
  ih: {Main.down_to_ran(r, c, acc) == acc : List<&2, Nat>})
  -> {Main.down_to_ran(r, c, Spec.keep((u && Bool.not(ge)) && ge, id, acc)) == acc : List<&2, Nat>}:
  match u ge:
    case True{} True{}:
      ih
    case True{} False{}:
      ih
    case False{} _:
      ih

def Laws.down_to_idempotent(xs, c, acc):
  match xs:
    case Nil{}:
      {==}
    case Spec.M{+id, +t, u} <> r:
      down_idem_step(u, Nat.is_ge(t, c), id, Main.down_to_state(r, c), c, acc, Laws.down_to_idempotent(r, c, acc))

# run('up') and run('down')
# -------------------------

def Laws.up_all_reaches(xs):
  match xs:
    case Nil{}:
      {==}
    case Spec.M{id, t, u} <> r:
      Laws.up_all_reaches(r)

def up_all_ran_step(u: Bool, +id: Nat, -rest: List<&2, Nat>)
  -> {Spec.keep(Bool.not(u), id, rest) == Spec.keep(Bool.xor(u, True{}), id, rest) : List<&2, Nat>}:
  match u:
    case True{}:
      {==}
    case False{}:
      {==}

def Laws.up_all_ran_is_change(xs):
  match xs:
    case Nil{}:
      {==}
    case Spec.M{+id, t, +u} <> r:
      %Laws.up_all_ran_is_change(r) : {Spec.keep(Bool.not(u), id, Main.up_all_ran(r)) == Spec.keep(Bool.xor(u, True{}), id, _) : List<&2, Nat>}
      up_all_ran_step(u, id, Main.up_all_ran(r))

def Laws.up_all_keeps_ids(xs):
  match xs:
    case Nil{}:
      {==}
    case Spec.M{+id, t, u} <> r:
      %Laws.up_all_keeps_ids(r) : {id <> Spec.ids(Main.up_all_state(r)) == id <> _ : List<&2, Nat>}
      {==}

def Laws.down_all_reaches(xs):
  match xs:
    case Nil{}:
      {==}
    case Spec.M{id, t, u} <> r:
      Laws.down_all_reaches(r)

def down_all_ran_step(u: Bool, +id: Nat, +acc: List<&2, Nat>)
  -> {Spec.keep(u, id, acc) == Spec.keep(Bool.xor(u, False{}), id, acc) : List<&2, Nat>}:
  match u:
    case True{}:
      {==}
    case False{}:
      {==}

def Laws.down_all_ran_is_change(xs, acc):
  match xs:
    case Nil{}:
      {==}
    case Spec.M{+id, t, +u} <> r:
      %down_all_ran_step(u, id, acc) : {Main.down_all_ran(r, Spec.keep(u, id, acc)) == Spec.changed_latest_first(r, Main.down_all_state(r), _) : List<&2, Nat>}
      Laws.down_all_ran_is_change(r, Spec.keep(u, id, acc))

def Laws.down_all_keeps_ids(xs):
  match xs:
    case Nil{}:
      {==}
    case Spec.M{+id, t, u} <> r:
      %Laws.down_all_keeps_ids(r) : {id <> Spec.ids(Main.down_all_state(r)) == id <> _ : List<&2, Nat>}
      {==}

# run(direction, name, true)
# --------------------------
# eq: the migration has the id; u: it was up; v: the target state.

def single_reach_step(eq: Bool, v: Bool, -u: Bool, -rest: Bool, ih: {rest == True{} : Bool})
  -> {(Bool.not(eq) || Bool.not(Bool.xor((eq && v) || (Bool.not(eq) && u), v))) && rest == True{} : Bool}:
  match eq v:
    case True{} True{}:
      ih
    case True{} False{}:
      ih
    case False{} _:
      ih

def Laws.single_reaches(xs, id, v):
  match xs:
    case Nil{}:
      {==}
    case Spec.M{+i, t, +u} <> r:
      single_reach_step(Nat.is_eq(i, id), v, u, Spec.all_with_id(Main.set_state(r, id, v), id, v), Laws.single_reaches(r, id, v))

def single_frame_step(eq: Bool, u: Bool, -v: Bool, -rest: Bool, ih: {rest == True{} : Bool})
  -> {(eq || Bool.not(Bool.xor(u, (eq && v) || (Bool.not(eq) && u)))) && rest == True{} : Bool}:
  match eq u:
    case True{} _:
      ih
    case False{} True{}:
      ih
    case False{} False{}:
      ih

def Laws.single_frame(xs, id, v):
  match xs:
    case Nil{}:
      {==}
    case Spec.M{+i, t, +u} <> r:
      single_frame_step(Nat.is_eq(i, id), u, v, Spec.frame_id(r, Main.set_state(r, id, v), id), Laws.single_frame(r, id, v))

def Laws.single_keeps_ids(xs, id, v):
  match xs:
    case Nil{}:
      {==}
    case Spec.M{+i, t, u} <> r:
      %Laws.single_keeps_ids(r, id, v) : {i <> Spec.ids(Main.set_state(r, id, v)) == i <> _ : List<&2, Nat>}
      {==}

# Setting a state keeps which ids are present.
def contains_set(+xs: List<&2, Spec.Mig>, +id: Nat, +v: Bool) -> {Main.contains(xs, id) == Main.contains(Main.set_state(xs, id, v), id) : Bool}:
  match xs:
    case Nil{}:
      {==}
    case Spec.M{+i, t, u} <> r:
      %contains_set(r, id, v) : {Nat.is_eq(i, id) || Main.contains(r, id) == Nat.is_eq(i, id) || _ : Bool}
      {==}

# present: some migration with the id comes later.
def state_set_step(eq: Bool, v: Bool, present: Bool, -u: Bool)
  -> {(eq || present) && v == (eq && ((eq && v) || (Bool.not(eq) && u))) || (present && v) : Bool}:
  match eq:
    case True{}:
      match v present:
        case True{} _:
          {==}
        case False{} True{}:
          {==}
        case False{} False{}:
          {==}
    case False{}:
      {==}

# After the state of an id is set to v, the id is in state v when it is present, else not up.
def state_set(+xs: List<&2, Spec.Mig>, +id: Nat, +v: Bool) -> {Main.contains(xs, id) && v == Main.state_of(Main.set_state(xs, id, v), id) : Bool}:
  match xs:
    case Nil{}:
      {==}
    case Spec.M{+i, t, +u} <> r:
      %state_set(r, id, v) : {(Nat.is_eq(i, id) || Main.contains(r, id)) && v == (Nat.is_eq(i, id) && ((Nat.is_eq(i, id) && v) || (Bool.not(Nat.is_eq(i, id)) && u))) || _ : Bool}
      state_set_step(Nat.is_eq(i, id), v, Main.contains(r, id), u)

def single_idem_step(present: Bool, v: Bool, +id: Nat)
  -> {Spec.keep(present && Bool.xor(present && v, v), id, Nil{}) == Nil{} : List<&2, Nat>}:
  match present v:
    case True{} True{}:
      {==}
    case True{} False{}:
      {==}
    case False{} _:
      {==}

def Laws.single_idempotent(xs, id, v):
  %contains_set(xs, id, v) : {Spec.keep(_ && Bool.xor(Main.state_of(Main.set_state(xs, id, v), id), v), id, Nil{}) == Nil{} : List<&2, Nat>}
  %state_set(xs, id, v) : {Spec.keep(Main.contains(xs, id) && Bool.xor(_, v), id, Nil{}) == Nil{} : List<&2, Nat>}
  single_idem_step(Main.contains(xs, id), v, id)

# The model's contains is the spec's has_id.
def has_is_contains(+xs: List<&2, Spec.Mig>, +id: Nat) -> {Spec.has_id(xs, id) == Main.contains(xs, id) : Bool}:
  match xs:
    case Nil{}:
      {==}
    case Spec.M{+i, t, u} <> r:
      %has_is_contains(r, id) : {Nat.is_eq(i, id) || Spec.has_id(r, id) == Nat.is_eq(i, id) || _ : Bool}
      {==}

def single_absent(+xs: List<&2, Spec.Mig>, +id: Nat, +v: Bool, h: {False{} == Spec.has_id(xs, id) : Bool})
  -> {Main.single_ran(xs, id, v) == Nil{} : List<&2, Nat>}:
  %has_is_contains(xs, id) : {Spec.keep(_ && Bool.xor(Main.state_of(xs, id), v), id, Nil{}) == Nil{} : List<&2, Nat>}
  %h : {Spec.keep(_ && Bool.xor(Main.state_of(xs, id), v), id, Nil{}) == Nil{} : List<&2, Nat>}
  {==}

def Laws.single_absent_runs_nothing(xs, id, v):
  h => single_absent(xs, id, v, h)

# prune
# -----

def Laws.remove_gone(xs, id):
  match xs:
    case Nil{}:
      {==}
    case Spec.M{+i, +t, +u} <> r:
      pick_split(List<&2, Spec.Mig>, ys => {Spec.has_id(ys, id) == False{} : Bool}, Nat.is_eq(i, id), Main.remove(r, id), Spec.M{i, t, u} <> Main.remove(r, id),
        e => Laws.remove_gone(r, id),
        e => %e : {_ || Spec.has_id(Main.remove(r, id), id) == False{} : Bool}
             Laws.remove_gone(r, id))

# sync
# ----
# The new migration m = M{id, s, False} goes before the first migration created after s. Its id is new, so every
# migration it passes has another id.

def eq_refl(+n: Nat) -> {True{} == Nat.is_eq(n, n) : Bool}:
  match n:
    case 0n:
      {==}
    case 1n+p:
      eq_refl(p)

def refute(e: {False{} == True{} : Bool}) -> Empty:
  %sym(Bool, False{}, True{}, e) : T(_)
  Unit{}

def true_eq(+b: Bool, w: T(b)) -> {True{} == b : Bool}:
  match b:
    case True{}:
      {==}
    case False{}:
      Empty.absurd({True{} == False{} : Bool}, w)

# A false disjunction has false halves.
def or_false_left(+a: Bool, -b: Bool, e: {False{} == a || b : Bool}) -> {False{} == a : Bool}:
  match a:
    case True{}:
      e
    case False{}:
      {==}

def or_false_right(+a: Bool, -b: Bool, e: {False{} == a || b : Bool}) -> {False{} == b : Bool}:
  match a:
    case True{}:
      Empty.absurd({False{} == b : Bool}, refute(e))
    case False{}:
      e

# The head was created after s: m goes first, and the head right after it.
def placed_first(+i: Nat, +t: Nat, +u: Bool, +r: List<&2, Spec.Mig>, +id: Nat, +s: Nat, e: {True{} == Nat.is_gt(t, s) : Bool})
  -> {Spec.placed(Spec.M{id, s, False{}} <> Spec.M{i, t, u} <> r, id, s) == True{} : Bool}:
  %eq_refl(id) : {(_ && Nat.is_gt(t, s)) || (Bool.not(_) && (Nat.is_le(s, s) && Spec.placed(Spec.M{i, t, u} <> r, id, s))) == True{} : Bool}
  %e : {(True{} && _) || (Bool.not(True{}) && (Nat.is_le(s, s) && Spec.placed(Spec.M{i, t, u} <> r, id, s))) == True{} : Bool}
  {==}

# The head was created at or before s and has another id: it stays first, and m is placed in the rest.
def placed_later(+i: Nat, +t: Nat, +u: Bool, +r: List<&2, Spec.Mig>, +id: Nat, +s: Nat,
  hi: {False{} == Nat.is_eq(i, id) : Bool}, le: {True{} == Nat.is_le(t, s) : Bool},
  ih: {Spec.placed(Main.insert(r, Spec.M{id, s, False{}}), id, s) == True{} : Bool})
  -> {Spec.placed(Spec.M{i, t, u} <> Main.insert(r, Spec.M{id, s, False{}}), id, s) == True{} : Bool}:
  %hi : {(_ && Spec.next_after(Main.insert(r, Spec.M{id, s, False{}}), s)) || (Bool.not(_) && (Nat.is_le(t, s) && Spec.placed(Main.insert(r, Spec.M{id, s, False{}}), id, s))) == True{} : Bool}
  %le : {(False{} && Spec.next_after(Main.insert(r, Spec.M{id, s, False{}}), s)) || (Bool.not(False{}) && (_ && Spec.placed(Main.insert(r, Spec.M{id, s, False{}}), id, s))) == True{} : Bool}
  ih

def insert_placed(xs: List<&2, Spec.Mig>, +id: Nat, +s: Nat, +h: {False{} == Spec.has_id(xs, id) : Bool})
  -> {Spec.placed(Main.insert(xs, Spec.M{id, s, False{}}), id, s) == True{} : Bool}:
  match xs:
    case Nil{}:
      %eq_refl(id) : {(_ && True{}) || (Bool.not(_) && (Nat.is_le(s, s) && Spec.placed(Nil{}, id, s))) == True{} : Bool}
      {==}
    case Spec.M{+i, +t, +u} <> +r:
      pick_split(List<&2, Spec.Mig>, ys => {Spec.placed(ys, id, s) == True{} : Bool}, Nat.is_gt(t, s),
        Spec.M{id, s, False{}} <> Spec.M{i, t, u} <> r, Spec.M{i, t, u} <> Main.insert(r, Spec.M{id, s, False{}}),
        e => placed_first(i, t, u, r, id, s, e),
        e => placed_later(i, t, u, r, id, s,
          or_false_left(Nat.is_eq(i, id), Spec.has_id(r, id), h),
          true_eq(Nat.is_le(t, s), not_gt_le(t, s, sym(Bool, False{}, Nat.is_gt(t, s), e))),
          insert_placed(r, id, s, or_false_right(Nat.is_eq(i, id), Spec.has_id(r, id), h))))

def Laws.insert_placed(xs, id, s):
  h => insert_placed(xs, id, s, h)
