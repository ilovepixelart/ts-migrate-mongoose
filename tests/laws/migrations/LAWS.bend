# Migrations: the laws. The human states them; PROOF.bend must prove them. For each run variant they pin the
# result completely: the target is reached, nothing outside the range moves, the reported ids are exactly the
# migrations whose state changed (in the order they ran), the migrations themselves stay the same, and a second run
# runs nothing.

import Base
import ./main.bend as Main
import ./SPEC.bend as Spec

# run('up', name), the named migration created at c.

# LAW: every migration created at or before c is up afterwards
law up_to_reaches:
  for +xs: List<&2, Spec.Mig>
  for +c: Nat
  {Spec.all_le_up(Main.up_to_state(xs, c), c) == True{} : Bool}

# LAW: every migration created after c keeps its state
law up_to_frame:
  for +xs: List<&2, Spec.Mig>
  for +c: Nat
  {Spec.frame_gt(xs, Main.up_to_state(xs, c), c) == True{} : Bool}

# LAW: it reports exactly the migrations whose state changed, in list order
law up_to_ran_is_change:
  for +xs: List<&2, Spec.Mig>
  for +c: Nat
  {Main.up_to_ran(xs, c) == Spec.changed(xs, Main.up_to_state(xs, c)) : List<&2, Nat>}

# LAW: the same migrations remain, in the same order
law up_to_keeps_ids:
  for +xs: List<&2, Spec.Mig>
  for +c: Nat
  {Spec.ids(Main.up_to_state(xs, c)) == Spec.ids(xs) : List<&2, Nat>}

# LAW: running it again runs nothing
law up_to_idempotent:
  for +xs: List<&2, Spec.Mig>
  for +c: Nat
  {Main.up_to_ran(Main.up_to_state(xs, c), c) == Nil{} : List<&2, Nat>}

# run('down', name), the named migration created at c.

# LAW: every migration created at or after c is down afterwards
law down_to_reaches:
  for +xs: List<&2, Spec.Mig>
  for +c: Nat
  {Spec.all_ge_down(Main.down_to_state(xs, c), c) == True{} : Bool}

# LAW: every migration created before c keeps its state
law down_to_frame:
  for +xs: List<&2, Spec.Mig>
  for +c: Nat
  {Spec.frame_lt(xs, Main.down_to_state(xs, c), c) == True{} : Bool}

# LAW: it reports exactly the migrations whose state changed, latest first
law down_to_ran_is_change:
  for +xs: List<&2, Spec.Mig>
  for +c: Nat
  for +acc: List<&2, Nat>
  {Main.down_to_ran(xs, c, acc) == Spec.changed_latest_first(xs, Main.down_to_state(xs, c), acc) : List<&2, Nat>}

# LAW: the same migrations remain, in the same order
law down_to_keeps_ids:
  for +xs: List<&2, Spec.Mig>
  for +c: Nat
  {Spec.ids(Main.down_to_state(xs, c)) == Spec.ids(xs) : List<&2, Nat>}

# LAW: running it again runs nothing
law down_to_idempotent:
  for +xs: List<&2, Spec.Mig>
  for +c: Nat
  for +acc: List<&2, Nat>
  {Main.down_to_ran(Main.down_to_state(xs, c), c, acc) == acc : List<&2, Nat>}

# run('up') and run('down') without a name.

# LAW: after run('up'), every migration is up
law up_all_reaches:
  for +xs: List<&2, Spec.Mig>
  {Spec.all_up(Main.up_all_state(xs)) == True{} : Bool}

# LAW: run('up') reports exactly the migrations whose state changed, in list order
law up_all_ran_is_change:
  for +xs: List<&2, Spec.Mig>
  {Main.up_all_ran(xs) == Spec.changed(xs, Main.up_all_state(xs)) : List<&2, Nat>}

# LAW: run('up') keeps the same migrations, in the same order
law up_all_keeps_ids:
  for +xs: List<&2, Spec.Mig>
  {Spec.ids(Main.up_all_state(xs)) == Spec.ids(xs) : List<&2, Nat>}

# LAW: after run('down'), every migration is down
law down_all_reaches:
  for +xs: List<&2, Spec.Mig>
  {Spec.all_down(Main.down_all_state(xs)) == True{} : Bool}

# LAW: run('down') reports exactly the migrations whose state changed, latest first
law down_all_ran_is_change:
  for +xs: List<&2, Spec.Mig>
  for +acc: List<&2, Nat>
  {Main.down_all_ran(xs, acc) == Spec.changed_latest_first(xs, Main.down_all_state(xs), acc) : List<&2, Nat>}

# LAW: run('down') keeps the same migrations, in the same order
law down_all_keeps_ids:
  for +xs: List<&2, Spec.Mig>
  {Spec.ids(Main.down_all_state(xs)) == Spec.ids(xs) : List<&2, Nat>}

# run(direction, name, true), the named migration's id, to state v.

# LAW: every migration with the id ends in state v
law single_reaches:
  for +xs: List<&2, Spec.Mig>
  for +id: Nat
  for +v: Bool
  {Spec.all_with_id(Main.single_state(xs, id, v), id, v) == True{} : Bool}

# LAW: every other migration keeps its state
law single_frame:
  for +xs: List<&2, Spec.Mig>
  for +id: Nat
  for +v: Bool
  {Spec.frame_id(xs, Main.single_state(xs, id, v), id) == True{} : Bool}

# LAW: the same migrations remain, in the same order
law single_keeps_ids:
  for +xs: List<&2, Spec.Mig>
  for +id: Nat
  for +v: Bool
  {Spec.ids(Main.single_state(xs, id, v)) == Spec.ids(xs) : List<&2, Nat>}

# LAW: running it again runs nothing, whether or not the id is present
law single_idempotent:
  for +xs: List<&2, Spec.Mig>
  for +id: Nat
  for +v: Bool
  {Main.single_ran(Main.single_state(xs, id, v), id, v) == Nil{} : List<&2, Nat>}

# LAW: when no migration has the id, it reports nothing
law single_absent_runs_nothing:
  for +xs: List<&2, Spec.Mig>
  for +id: Nat
  for +v: Bool
  {False{} == Spec.has_id(xs, id) : Bool} -> {Main.single_ran(xs, id, v) == Nil{} : List<&2, Nat>}

# prune

# LAW: after remove, no migration with the id is left
law remove_gone:
  for +xs: List<&2, Spec.Mig>
  for +id: Nat
  {Spec.has_id(Main.remove(xs, id), id) == False{} : Bool}
