---
name: Bug report
about: Report a bug in ts-migrate-mongoose
title: ''
labels: bug
assignees: ''

---

**Describe the bug**
A clear and concise description of what the bug is.

**Versions**
Describe your setup

- `ts-migrate-mongoose`:
- `mongoose`:
- Node.js:
- OS:

**Mode**
How are you running the migration?

- [ ] CLI (`npx migrate …`)
- [ ] Programmatic (`Migrator.connect(...)`)
- [ ] NestJS (`MigrationModule`)

**Configuration**
Relevant bits of `migrate.json` / `migrate.ts` / `.env` / env vars (redact secrets).

```json
// config
```

**Minimal reproduction**
Migration file contents and the command or call that triggers the bug.

```typescript
// migration file up/down
```

```bash
# CLI command or programmatic call
```

**Expected behavior**
What you expected to happen (e.g. migration marked as applied, document shape, collection state).

**Actual behavior**
What happened instead. Include error messages and stack traces.

**Additional context**
Anything else that might help — related issues, schema peculiarities, multi-connection setup, etc.
