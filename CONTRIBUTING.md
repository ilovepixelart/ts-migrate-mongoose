# Contributing Guidelines

We welcome contributions from the community. Please follow these guidelines to ensure a smooth process.

## Development Setup

```bash
npm install
npx simple-git-hooks  # one-time: install the git hooks defined in package.json
```

### Commands

```bash
npm run build              # Build with pkgroll
npm test                   # Run tests with vitest + coverage
npm run test:e2e           # Pack, install into a fresh consumer, run the e2e suite
npm run type:check         # TypeScript type checking (src)
npm run type:check:tests   # TypeScript type checking (tests)
npm run biome              # Lint check
npm run biome:fix          # Lint + auto-fix
```

### Git Hooks

The project uses `simple-git-hooks`. Contributors run `npx simple-git-hooks`
once after `npm install` to register the hooks locally:

- **pre-commit**: runs `npm run type:check`
- **pre-push**: runs `npm run biome`

## Before Submitting a PR

1. Run the full check: `npm run type:check && npm run type:check:tests && npm run biome && npm test && npm run build`
2. Ensure no test regressions
3. Follow the existing code style (Biome handles formatting)
4. Keep changes focused: one feature or fix per PR

## End-to-end tests

`npm run test:e2e` builds and packs the package, installs the tarball into a fresh consumer project
in the system temp directory, and runs every scenario in `tests/e2e/scenarios/` against a real
MongoDB: the `migrate` binary, its interactive prompt in a pseudo-terminal, the API through
`require` and `import`, the NestJS module, and a consumer type check. The same scenarios run
against the published version named in `tests/e2e/allowlist.json`, and the suite fails on any
difference that is not listed there. The prompt scenarios drive the terminal with `python3`'s
`pty` module, so the suite needs Python 3 on macOS or Linux.

- `tests/e2e/contract/` pins the expected output, exit codes, files and database state, one file
  per area. Empty collections are left out of database snapshots: whether mongoose has created
  one when a process exits is a race.
- `tests/e2e/contract/inventory.e2e.ts` fails when a command or option in the README help, or a
  key of the exported `Env` enum, has no scenario exercising it.
- `tests/e2e/laws.ts` states the laws of the public surface. `tests/e2e/contract/laws.e2e.ts` fails
  when a command, option, `Env` key, export or public class member (read from the published
  declarations) is in no law, or when a law has no contract test titled `law <id>: ...`. A new
  public feature therefore needs a law and a test before the suite passes.
- A known defect is pinned by a test titled `known defect: ...` that asserts today's exact
  behaviour, so fixing it fails that test, which is then replaced by one asserting the law.

## Laws in Bend

`tests/laws/` holds two Bend (https://bend-lang.com) projects laid out as Bend's demos are:
`names/` (what `Migrator.create` accepts) and `migrations/` (a model of what `run`, `sync` and
`prune` do). In each, `main.bend` is the program, `SPEC.bend` the specification it is held to,
`LAWS.bend` the laws relating the two and `PROOF.bend` their proofs. Change `SPEC.bend` and
`LAWS.bend` only to change what the program must do. `main.bend` compiles to `main.mjs`, the
oracle the tests in `tests/laws/` and the e2e `laws` scenario compare the real code with; the
`.mjs` is committed so the tests run without Bend.

`npm run test:laws` checks every proof, recompiles both `main.mjs` and fails if a committed one
is out of date. It needs Bend 2.0.40 (`curl -fsSL https://bend-lang.com/install.sh | sh`).
- A pull request that changes user-visible behaviour adds one entry per changed observation path
  to `changes` in `tests/e2e/allowlist.json`, with its PR number and reason.
- After a release, set `baseline` to the released version and empty `changes`.
- `E2E_MONGOOSE=<version>` picks the mongoose version installed in the consumer (default: the
  lockfile's). `E2E_CANDIDATE` and `E2E_BASELINE` take any npm install spec (a tarball path or
  `name@version`) in place of the packed build and the baseline.

## Mutation testing

Mutation testing changes `src/` one small edit at a time and checks that a test fails for each.

- `npm run test:mutation` runs it against the unit and integration suite (`stryker.config.mjs`).
- `npm run test:mutation:e2e` runs it against the end-to-end suite on the packed package
  (`stryker.e2e.config.mjs`, `tests/e2e/mutant.ts`). A mutant counts as killed when any scenario's
  observation differs from the unmutated build. A full run takes hours, so scope it while working on
  one area: `npm run test:mutation:e2e -- --mutate src/prompts.ts` or `--mutate src/index.ts:150-185`.
  The observation that killed each mutant is saved in `reports/mutation/e2e-kills/`.
- Reports are written to `reports/mutation/`. A surviving mutant needs a test, or, when nothing
  observable through the package tells it apart from the original, an entry with the reason in
  `tests/mutation/equivalent-e2e.json`. `npm run test:mutation:survivors -- e2e` checks the last e2e
  report: it fails on a survivor that is not listed and on a listed mutant that was killed.
  `npm run test:mutation:survivors -- all` checks the last unit and e2e reports together: a mutant
  counts as surviving only when both suites miss it, since either one failing catches the change.

## How to Contribute

1. **Start an Issue**: Before you start working on a feature or bug fix, please create an issue to discuss the best approach.
2. **Fork the Repository**: Create a fork of the repository to work on your changes.
3. **Create a Branch**: Create a new branch for your work. Use a descriptive name for the branch.
4. **Make Changes**: Make your changes in the new branch. Ensure your code follows the project's coding standards.
5. **Write Tests**: If applicable, write tests for your changes using vitest.
6. **Commit Changes**: Commit your changes with a clear and concise commit message.
7. **Push Changes**: Push your changes to your forked repository.
8. **Create a Pull Request**: Create a pull request from your branch to the main repository. Provide a detailed description of your changes.

## Code Style

- ESM (`"type": "module"`)
- Strict TypeScript
- Biome formatting: no semicolons, single quotes, 2-space indent
- Use arrow functions for standalone functions, `function` keyword only for class methods or `this` binding
- No unnecessary comments or docstrings

## Testing

- Framework: vitest with `vi.mock`, `vi.spyOn`
- Database: mongodb-memory-server
- Run `npm test` before submitting a PR

## Reporting Bugs

If you find a bug, please create an issue with the following information:

- A clear and concise description of the bug.
- Steps to reproduce the bug.
- Expected behavior.
- Screenshots or code snippets (if applicable).
- Any other relevant information.

## Suggesting Features

If you have a feature request, please create an issue with the following information:

- A clear and concise description of the feature.
- The problem the feature solves.
- Any relevant examples or use cases.
- Any other relevant information.

## Code of Conduct

Please note that this project is governed by a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to adhere to it.
