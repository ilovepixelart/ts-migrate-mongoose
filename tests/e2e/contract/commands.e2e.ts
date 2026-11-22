import { describe, expect, it } from 'vitest'

import { adding, created, DOC_KEYS, db, fail, migrationDoc, names, ok, readmeHelp, scenario, states, steps, TEMPLATE, URI_REQUIRED, work } from './observations'

describe('CLI binary', () => {
  it('law cli-help: prints the README help text for no command, -h, --help and a command with --help', () => {
    const help = `${readmeHelp()}\n`
    expect(steps('help')).toEqual([ok('migrate', help), ok('migrate -h', help), ok('migrate --help', help), ok('migrate up --help', help)])
  })

  it('law cli-help: prints the installed package version for -v and --version without a database', () => {
    expect(steps('version')).toEqual([ok('migrate -v', '<version>\n'), ok('migrate --version', '<version>\n')])
  })

  it('law cli-args: reports argument errors in red on stderr with exit code 1', () => {
    const [noUri, single, unknownOption, unknownNoUri, unknownCommand, createNoName, downNoName] = steps('argument-errors')
    expect(noUri).toEqual(fail('migrate list', URI_REQUIRED))
    expect(single).toEqual(fail('migrate list -s -d <mongo>/argument_errors', "Option --single is only valid for 'up' and 'down' commands\n"))
    expect(unknownOption?.exitCode).toBe(1)
    expect(unknownOption?.stderr).toMatch(/^Unknown option '--nope'\./)
    expect(unknownNoUri).toEqual(fail('migrate frobnicate', URI_REQUIRED))
    expect(unknownCommand).toEqual(fail('migrate frobnicate -d <mongo>/argument_errors', `${readmeHelp()}\nUnknown command: frobnicate\n`))
    expect(createNoName).toEqual(fail('migrate create -d <mongo>/argument_errors', 'Migration name is required for create command\n'))
    expect(downNoName).toEqual(fail('migrate down -d <mongo>/argument_errors', 'Migration name is required for down command\n'))
    expect(scenario('argument-errors').steps?.[0]?.stderr.startsWith('\u001b[31m')).toBe(true)
  })

  it('starts cold against an empty database, creating the migrations folder and no records', () => {
    expect(steps('cold-start')).toEqual([ok('migrate up -d <mongo>/cold_start', 'There are no pending migrations\nCurrent migrations status:\nThere are no migrations to list\n'), ok('migrate list -d <mongo>/cold_start', 'Listing migrations\nThere are no migrations to list\n')])
    expect(scenario('cold-start').tree).toEqual({ 'migrations/': null })
    expect(db('cold-start')).toEqual({})
  })

  it('law create: creates a timestamped .ts file from the default template and a down record', () => {
    const invalid = (name: string) => `Invalid migration name '${name}'. Allowed characters: letters, digits, underscore, hyphen, and non-consecutive dots.\n`
    expect(steps('create')).toEqual([
      ok('migrate create first-migration -d <mongo>/create', created('first-migration', `${work('create')}/migrations`)),
      fail('migrate create first-migration -d <mongo>/create', "There is already a migration with name 'first-migration' in the database\n"),
      fail('migrate create a/../../escaped -d <mongo>/create', invalid('a/../../escaped')),
      fail('migrate create ../escaped -d <mongo>/create', invalid('../escaped')),
      ok('migrate create my.migration_v2 -d <mongo>/create', created('my.migration_v2', `${work('create')}/migrations`)),
      ok('migrate list -d <mongo>/create', 'Listing migrations\ndown: <timestamp>-first-migration\ndown: <timestamp>-my.migration_v2\n'),
    ])
    expect(scenario('create').tree).toEqual({ 'migrations/': null, 'migrations/<timestamp>-first-migration.ts': TEMPLATE, 'migrations/<timestamp>-my.migration_v2.ts': TEMPLATE })
    expect(db('create')).toEqual({ migrations: [migrationDoc('first-migration', 'down'), migrationDoc('my.migration_v2', 'down')] })
  })

  it('law run-model: syncs new files and runs every pending migration in timestamp order, importing TypeScript models', () => {
    const dir = `${work('up-all')}/migrations`
    expect(steps('up-all')).toEqual([
      ok('migrate up -d <mongo>/up_all', `${adding(`${dir}/<timestamp>-add-alice`)}${adding(`${dir}/<timestamp>-add-bob`)}${adding(`${dir}/<timestamp>-add-carol`)}up: <timestamp>-add-alice\nup: <timestamp>-add-bob\nup: <timestamp>-add-carol\nAll migrations finished successfully\n`),
      ok('migrate up -d <mongo>/up_all', 'There are no pending migrations\nCurrent migrations status:\nup: <timestamp>-add-alice\nup: <timestamp>-add-bob\nup: <timestamp>-add-carol\n'),
    ])
    expect(states(db('up-all').migrations)).toEqual({ 'add-alice': 'up', 'add-bob': 'up', 'add-carol': 'up' })
    expect(names(db('up-all').people)).toEqual(['alice', 'bob', 'carol'])
    expect(Object.keys(db('up-all').migrations?.[0] ?? {})).toEqual(DOC_KEYS)
  })

  it('law run-model: runs up to and down to a named migration, inclusive', () => {
    const [up, ...rest] = steps('up-down-to-name')
    expect(up?.stdout).toMatch(/State is down\nup: <timestamp>-add-alice\nup: <timestamp>-add-bob\nAll migrations finished successfully\n$/)
    expect(rest).toEqual([
      ok('migrate list -d <mongo>/up_down_to_name', 'Listing migrations\nup: <timestamp>-add-alice\nup: <timestamp>-add-bob\ndown: <timestamp>-add-carol\n'),
      ok('migrate up -d <mongo>/up_down_to_name', 'up: <timestamp>-add-carol\nAll migrations finished successfully\n'),
      ok('migrate down add-bob -d <mongo>/up_down_to_name', 'down: <timestamp>-add-carol\ndown: <timestamp>-add-bob\nAll migrations finished successfully\n'),
      ok('migrate list -d <mongo>/up_down_to_name', 'Listing migrations\nup: <timestamp>-add-alice\ndown: <timestamp>-add-bob\ndown: <timestamp>-add-carol\n'),
      ok('migrate down add-alice -d <mongo>/up_down_to_name', 'down: <timestamp>-add-alice\nAll migrations finished successfully\n'),
    ])
    expect(states(db('up-down-to-name').migrations)).toEqual({ 'add-alice': 'down', 'add-bob': 'down', 'add-carol': 'down' })
    expect(db('up-down-to-name').people ?? []).toEqual([])
  })

  it('law single: runs exactly one migration with -s / --single', () => {
    const [upBob, ...rest] = steps('single')
    expect(upBob?.stdout).toMatch(/State is down\nup: <timestamp>-add-bob\nAll migrations finished successfully\n$/)
    expect(rest).toEqual([
      ok('migrate down add-bob --single -d <mongo>/single', 'down: <timestamp>-add-bob\nAll migrations finished successfully\n'),
      ok('migrate up -s -d <mongo>/single', 'up: <timestamp>-add-alice\nAll migrations finished successfully\n'),
      fail('migrate down -s -d <mongo>/single', 'Migration name is required for down command\n'),
      ok('migrate list -d <mongo>/single', 'Listing migrations\nup: <timestamp>-add-alice\ndown: <timestamp>-add-bob\ndown: <timestamp>-add-carol\n'),
    ])
    expect(names(db('single').people)).toEqual(['alice'])
  })

  it('law file-resolution: fails with the migration name when a named migration or its file is missing', () => {
    const [upMissing, downMissing, , upGone] = steps('missing-migration')
    expect(upMissing).toEqual(fail('migrate up nope -d <mongo>/missing_migration', "Could not find migration with name 'nope' in the database\n"))
    expect(downMissing).toEqual(fail('migrate down nope -d <mongo>/missing_migration', "Could not find migration with name 'nope' in the database\n"))
    expect(upGone?.exitCode).toBe(1)
    expect(upGone?.stderr).toContain(`Cannot find module '${work('missing-migration')}/migrations/<timestamp>-gone'`)
    expect(db('missing-migration')).toEqual({ migrations: [migrationDoc('gone', 'down')] })
  })

  it('law failure-stops: stops at a failing migration, exits 1 and keeps earlier migrations applied', () => {
    const dir = `${work('failing-migration')}/migrations`
    expect(steps('failing-migration')).toEqual([
      fail('migrate up -d <mongo>/failing_migration', "Failed to run migration with name 'explode' due to an error\n", `${adding(`${dir}/<timestamp>-add-alice`)}${adding(`${dir}/<timestamp>-explode`)}${adding(`${dir}/<timestamp>-add-carol`)}up: <timestamp>-add-alice\n`),
      ok('migrate list -d <mongo>/failing_migration', 'Listing migrations\nup: <timestamp>-add-alice\ndown: <timestamp>-explode\ndown: <timestamp>-add-carol\n'),
    ])
    expect(states(db('failing-migration').migrations)).toEqual({ 'add-alice': 'up', explode: 'down', 'add-carol': 'down' })
    expect(names(db('failing-migration').people)).toEqual(['alice'])
  })

  it('law file-resolution: names the missing export when a migration has no down function', () => {
    const [, down] = steps('missing-export')
    expect(down).toEqual(fail('migrate down only-up -d <mongo>/missing_export', "The 'down' export is not defined in <timestamp>-only-up.\n"))
    expect(states(db('missing-export').migrations)).toEqual({ 'only-up': 'up' })
  })

  it('law file-resolution: runs .js, .mjs and .cjs migrations with named and default exports and ignores .d.ts files', () => {
    const [up, down] = steps('js-migrations')
    expect(up?.stdout).toMatch(/up: <timestamp>-esm-named\nup: <timestamp>-esm-default\nup: <timestamp>-commonjs\nAll migrations finished successfully\n$/)
    expect(down).toEqual(ok('migrate down esm-named -d <mongo>/js_migrations', 'down: <timestamp>-commonjs\ndown: <timestamp>-esm-default\ndown: <timestamp>-esm-named\nAll migrations finished successfully\n'))
    expect(states(db('js-migrations', 'afterUp').migrations)).toEqual({ commonjs: 'up', 'esm-default': 'up', 'esm-named': 'up' })
    expect(names(db('js-migrations', 'afterUp').people)).toEqual(['commonjs', 'esm-default', 'esm-named'])
    expect(db('js-migrations', 'afterDown').people ?? []).toEqual([])
  })

  it('law run-model: prunes database records whose files were deleted', () => {
    expect(steps('prune').slice(2)).toEqual([ok('migrate prune -d <mongo>/prune', 'Removing migration(s) from database:\ndrop\n'), ok('migrate prune -d <mongo>/prune', ''), ok('migrate list -d <mongo>/prune', 'Listing migrations\ndown: <timestamp>-keep\n')])
    expect(db('prune')).toEqual({ migrations: [migrationDoc('keep', 'down')] })
  })

  it('law autosync: imports migration files without a prompt when stdin is not a TTY, ignoring non-migration files', () => {
    const dir = `${work('sync')}/migrations`
    expect(steps('sync')).toEqual([
      ok('migrate list -a true -d <mongo>/sync', `Listing migrations\n${adding(`${dir}/<timestamp>-seeded`)}down: <timestamp>-seeded\n`),
      ok('migrate list --autosync false -d <mongo>/sync', `Listing migrations\n${adding(`${dir}/<timestamp>-later`)}down: <timestamp>-seeded\ndown: <timestamp>-later\n`),
    ])
    expect(states(db('sync').migrations)).toEqual({ later: 'down', seeded: 'down' })
  })

  it('law file-resolution: falls back to a .js file when the .ts file it was created as is gone', () => {
    expect(steps('renamed-to-js').slice(1)).toEqual([ok('migrate up compiled -d <mongo>/renamed_to_js', 'up: <timestamp>-compiled\nAll migrations finished successfully\n'), ok('migrate down compiled -d <mongo>/renamed_to_js', 'down: <timestamp>-compiled\nAll migrations finished successfully\n')])
    expect(states(db('renamed-to-js', 'afterUp').migrations)).toEqual({ compiled: 'up' })
    expect(names(db('renamed-to-js', 'afterUp').people)).toEqual(['compiled'])
    expect(db('renamed-to-js', 'afterDown').people ?? []).toEqual([])
  })

  it('law run-model: orders migrations with the same timestamp the same way in list, up and down', () => {
    expect(scenario('timestamp-collision').seeded).toBe(0)
    const imported = ['beta', 'alpha', 'gamma']
    const lines = (prefix: string) => imported.map((name) => `${prefix}: <timestamp>-${name}\n`).join('')
    expect(steps('timestamp-collision')).toEqual([
      ok('migrate list -d <mongo>/timestamp_collision', `Listing migrations\n${lines('down')}`),
      ok('migrate up -d <mongo>/timestamp_collision', `${lines('up')}All migrations finished successfully\n`),
      ok('migrate list -d <mongo>/timestamp_collision', `Listing migrations\n${lines('up')}`),
      ok(
        'migrate down alpha -d <mongo>/timestamp_collision',
        `${[...imported]
          .reverse()
          .map((name) => `down: <timestamp>-${name}\n`)
          .join('')}All migrations finished successfully\n`,
      ),
    ])
  })

  it('law path-guard: refuses to import a migration whose stored name resolves outside the migrations folder', () => {
    const name = '../../../../../../../../../../tmp/e2e-poisoned'
    expect(scenario('poisoned-record').seeded).toBe(0)
    expect(steps('poisoned-record')).toEqual([fail('migrate up -d <mongo>/poisoned_record', `Refusing to import migration '<timestamp>-${name}' — resolved path escapes the migrations directory.\n`)])
    expect(states(db('poisoned-record').migrations)).toEqual({ [name]: 'down' })
  })

  it('law name-safe: accepts letters, digits, underscores, hyphens and single dots in migration names and rejects anything else', () => {
    const rejected = ['with space', 'name;rm', 'name$var', 'name|pipe', 'name`cmd`', "name'quote", 'foo..bar', '..', 'foo\\bar', 'tilde~home', 'émigré']
    const accepted = ['v1.2.3-release', '__private', 'a'.repeat(100)]
    const invalid = (name: string) => `Invalid migration name '${name}'. Allowed characters: letters, digits, underscore, hyphen, and non-consecutive dots.\n`
    expect(steps('name-validation')).toEqual([...rejected.map((name) => fail(`migrate create ${name} -d <mongo>/name_validation`, invalid(name))), ...accepted.map((name) => ok(`migrate create ${name} -d <mongo>/name_validation`, created(name, `${work('name-validation')}/migrations`)))])
    expect(Object.keys(scenario('name-validation').tree as object).sort()).toEqual(['migrations/', ...accepted.map((name) => `migrations/<timestamp>-${name}.ts`)].sort())
    expect(names(db('name-validation').migrations).sort()).toEqual([...accepted].sort())
  })

  it('law run-model: reports nothing pending when everything up to, or down from, the named migration is already there', () => {
    const status = 'Current migrations status:\nup: <timestamp>-add-alice\nup: <timestamp>-add-bob\ndown: <timestamp>-add-carol\n'
    const [, again, downCarol] = steps('nothing-pending-up-to-name')
    expect(again).toEqual(ok('migrate up add-bob -d <mongo>/nothing_pending_up_to_name', `There are no pending migrations\n${status}`))
    expect(downCarol).toEqual(ok('migrate down add-carol -d <mongo>/nothing_pending_up_to_name', `There are no pending migrations\n${status}`))
    expect(states(db('nothing-pending-up-to-name').migrations)).toEqual({ 'add-alice': 'up', 'add-bob': 'up', 'add-carol': 'down' })
  })

  it('wraps a migrations path that is not a folder in a sync or prune error', () => {
    const sync = 'Could not synchronize migrations in the migrations folder up to the database\n'
    expect(steps('migrations-path-is-file')).toEqual([
      fail('migrate list -d <mongo>/migrations_path_is_file -m ./not-a-folder', sync, 'Listing migrations\n'),
      fail('migrate prune -d <mongo>/migrations_path_is_file -m ./not-a-folder', 'Could not prune extraneous migrations from database\n'),
      fail('migrate up -d <mongo>/migrations_path_is_file -m ./not-a-folder', sync),
    ])
    expect(db('migrations-path-is-file')).toEqual({})
  })

  // Known defect, pinned as it is: getMigrations matches files to records by createdAt.getTime(), so a timestamp
  // with a leading zero never matches: every list and up imports the file again, and up looks for it without the
  // zero. A fix fails this test.
  it('law sync-idempotent: known defect: re-imports a migration whose timestamp has a leading zero on every sync', () => {
    const [, , up] = steps('leading-zero-timestamp')
    expect(up?.exitCode).toBe(1)
    expect(up?.stderr).toContain(`Cannot find module '${work('leading-zero-timestamp')}/migrations/<timestamp>-zero'`)
    expect(names(db('leading-zero-timestamp').migrations)).toEqual(['zero', 'zero', 'zero'])
  })
})
