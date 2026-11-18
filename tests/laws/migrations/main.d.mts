// Types for main.mjs, which `bend main.bend -o main.mjs` generates (npm run test:laws checks it is current).
// A Bend list crosses as nested Con/Nil objects, a constructor as {$: name, ...fields}, and a Nat as a number.

export type BendList<T> = { $: 'Nil' } | { $: 'Con'; head: T; tail: BendList<T> }

export interface Mig {
  $: 'M'
  id: number
  t: number
  up: boolean
}

declare const model: {
  up_to_state(xs: BendList<Mig>, c: number): BendList<Mig>
  up_to_ran(xs: BendList<Mig>, c: number): BendList<number>
  up_all_state(xs: BendList<Mig>): BendList<Mig>
  up_all_ran(xs: BendList<Mig>): BendList<number>
  down_to_state(xs: BendList<Mig>, c: number): BendList<Mig>
  down_to_ran(xs: BendList<Mig>, c: number, acc: BendList<number>): BendList<number>
  down_all_state(xs: BendList<Mig>): BendList<Mig>
  down_all_ran(xs: BendList<Mig>, acc: BendList<number>): BendList<number>
  single_state(xs: BendList<Mig>, id: number, up: boolean): BendList<Mig>
  single_ran(xs: BendList<Mig>, id: number, up: boolean): BendList<number>
  first_down(xs: BendList<Mig>, none: number): number
  last_up(xs: BendList<Mig>, none: number): number
  insert(xs: BendList<Mig>, m: Mig): BendList<Mig>
  remove(xs: BendList<Mig>, id: number): BendList<Mig>
}

export default model
