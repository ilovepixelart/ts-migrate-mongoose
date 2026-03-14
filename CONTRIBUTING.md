# Contributing Guidelines

We welcome contributions from the community. Please follow these guidelines to ensure a smooth process.

## Development Setup

```bash
npm install
```

### Commands

```bash
npm run build          # Build with pkgroll
npm test               # Run tests with vitest + coverage
npm run type:check     # TypeScript type checking
npm run biome          # Lint check
npm run biome:fix      # Lint + auto-fix
```

### Git Hooks

The project uses `simple-git-hooks`:

- **pre-commit**: runs `npm run type:check`
- **pre-push**: runs `npm run biome:fix`

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
