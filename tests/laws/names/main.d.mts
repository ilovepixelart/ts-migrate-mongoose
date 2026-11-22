// Types for main.mjs, which `bend main.bend -o main.mjs` generates (npm run test:laws checks it is current).

declare const name: {
  valid(name: string): boolean
}

export default name
