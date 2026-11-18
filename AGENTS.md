# AGENTS

When using Bend (`tests/laws/`):

- run `bend guide` to learn it
- use `LAWS.bend` to keep important rules: change a project's `SPEC.bend` and `LAWS.bend` only to change what its program must do
- run `npm run test:laws` before committing: it checks every `PROOF.bend` and that each committed `main.mjs` is what its `main.bend` compiles to
