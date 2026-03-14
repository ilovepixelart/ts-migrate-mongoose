# Contributing

## Getting Started

```bash
git clone https://github.com/ilovepixelart/ts-migrate-mongoose.git
cd ts-migrate-mongoose
npm install
```

## Development

```bash
npm run type:check     # type check
npm run biome          # lint check
npm run biome:fix      # lint + auto-fix
npm test               # run tests with coverage
npm run build          # build with pkgroll
```

## Before Submitting a PR

1. Run the full check: `npm run type:check && npm run biome && npm test && npm run build`
2. Ensure no test regressions
3. Follow the existing code style (Biome handles formatting)
4. Keep changes focused — one feature or fix per PR

## Code Style

- ESM (`"type": "module"`)
- Strict TypeScript
- Biome formatting: no semicolons, single quotes, 2-space indent
- Arrow functions for standalone functions (no `this`)
- No unnecessary comments or docstrings

## Testing

- Framework: vitest
- Database: mongodb-memory-server
- Write tests for new features and bug fixes
- Test behavior, not implementation details
