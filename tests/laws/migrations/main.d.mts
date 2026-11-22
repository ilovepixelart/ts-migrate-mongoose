// Types for main.mjs, which `bend main.bend -o main.mjs` generates (npm run test:laws checks it is current). A Bend
// list crosses as nested Con/Nil objects, a constructor as {$: name, ...fields}, a Nat as a number and a pair as a
// Tuple.

export type BendList<T> = { $: 'Nil' } | { $: 'Con'; head: T; tail: BendList<T> }

export interface Mig {
  $: 'M'
  id: number
  t: number
  up: boolean
}

export type Cmd =
  | { $: 'Add'; id: number; t: number }
  | { $: 'Remove'; id: number }
  | { $: 'UpTo'; c: number }
  | { $: 'DownTo'; c: number }
  | { $: 'UpAll' }
  | { $: 'DownAll' }
  | { $: 'Single'; id: number; up: boolean }
  | { $: 'NextUp' }
  | { $: 'LastDown' }

declare const model: {
  // The state after cmd, and the ids it ran in the order it ran them.
  step(migrations: BendList<Mig>, cmd: Cmd): { $: 'Tuple'; fst: BendList<Mig>; snd: BendList<number> }
}

export default model
