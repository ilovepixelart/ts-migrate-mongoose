import { describe, expect, it } from 'vitest'

import { adding, created, db, fail, migrationDoc, names, ok, scenario, states, steps, TEMPLATE, URI_REQUIRED, work } from './observations'

describe('CLI configuration', () => {
  it.each([
    ['config-ts', 'from-ts', 'ts-migrations', 'ts_config'],
    ['config-js-esm', 'from-esm', 'js-migrations', 'esm_config'],
    ['config-js-cjs', 'from-cjs', 'cjs-migrations', 'cjs_config'],
    ['config-json', 'from-json', 'json-migrations', 'json_config'],
  ])('law config-file: reads uri, collection and migrationsPath from the default config file (%s)', (name, migration, folder, collection) => {
    expect(steps(name)[0]).toEqual(ok(`migrate create ${migration}`, created(migration, `${work(name)}/${folder}`)))
    expect(db(name)).toEqual({ [collection]: [migrationDoc(migration, 'down')] })
  })

  it('law config-file: uses templatePath from migrate.json', () => {
    expect(scenario('config-json').tree).toMatchObject({ 'json-migrations/<timestamp>-from-json.ts': '// json config template\n' })
  })

  it('law config-file: finds the config file through -f, --config-path without extension and MIGRATE_CONFIG_PATH', () => {
    const dir = `${work('config-path')}/custom-migrations`
    expect(steps('config-path')).toEqual([ok('migrate create by-flag -f ./conf/custom.json', created('by-flag', dir)), ok('migrate create by-long-flag --config-path ./conf/custom', created('by-long-flag', dir)), ok('migrate create by-env', created('by-env', dir))])
    expect(states(db('config-path').custom_config)).toEqual({ 'by-env': 'down', 'by-flag': 'down', 'by-long-flag': 'down' })
  })

  it('law config-file: reports an unusable explicit config file and then the missing URI', () => {
    const [yaml, missing, broken, brokenDefault] = steps('config-errors')
    expect(yaml).toEqual(fail('migrate list -f ./migrate.yaml', `Config file must have an extension of .ts, .js, .json\n${URI_REQUIRED}`))
    expect(missing?.exitCode).toBe(1)
    expect(missing?.stderr).toMatch(new RegExp(`^Cannot find module '${work('config-errors')}/missing.json'[^\\n]*\\n${URI_REQUIRED.replaceAll('.', '\\.')}$`))
    expect(broken?.exitCode).toBe(1)
    expect(broken?.stderr).toContain(`${work('config-errors')}/broken.json`)
    expect(broken?.stderr.endsWith(URI_REQUIRED)).toBe(true)
    expect(brokenDefault).toEqual(fail('migrate list', URI_REQUIRED))
  })

  it('law env-files: loads .env, .env.local, .env.[mode] and .env.[mode].local in override order', () => {
    expect(db('env-files').env_base?.map((doc) => doc.name)).toEqual(['from-env'])
    expect(names(db('env-files').env_local)).toContain('local-beats-process')
    expect(names(db('env-files').env_staging)).toContain('from-mode-flag')
    expect(names(db('env-files').env_staging_local)).toEqual(expect.arrayContaining(['from-mode-local', 'from-mode-env']))
    expect(Object.keys(db('env-files')).sort()).toEqual(['env_base', 'env_local', 'env_staging', 'env_staging_local'])
    for (const step of steps('env-files')) expect(step.exitCode).toBe(0)
  })

  it('law option-precedence: reads MIGRATE_* variables and their camelCase forms from the process environment', () => {
    const [viaEnv, viaCamel, autosync] = steps('env-vars')
    expect(viaEnv).toEqual(ok('migrate create via-env', created('via-env', `${work('env-vars')}/env-migrations`)))
    expect(viaCamel).toEqual(ok('migrate create via-camel-case', created('via-camel-case', `${work('env-vars')}/camel-migrations`)))
    expect(autosync).toEqual(ok('migrate up', `${adding(`${work('env-vars')}/seed/<timestamp>-seeded`)}up: <timestamp>-seeded\nAll migrations finished successfully\n`))
    expect(scenario('env-vars').tree).toMatchObject({ 'env-migrations/<timestamp>-via-env.ts': '// template from MIGRATE_TEMPLATE_PATH\n', 'camel-migrations/<timestamp>-via-camel-case.ts': TEMPLATE })
    expect(Object.keys(db('env-vars')).sort()).toEqual(['camel_collection', 'env_collection', 'migrations', 'people'])
  })

  it('law option-precedence: applies command line > environment > config file', () => {
    const dir = work('precedence')
    expect(steps('precedence').map((step) => step.stdout.split('\n').at(-3))).toEqual([`Created migration file-wins in ${dir}/file-migrations`, `Created migration env-wins in ${dir}/env-migrations`, `Created migration cli-wins in ${dir}/cli-migrations`, `Created migration cli-uri-wins in ${dir}/file-migrations`])
    expect(names(db('precedence').from_file)).toEqual(['file-wins'])
    expect(names(db('precedence').from_env)).toEqual(['env-wins'])
    expect(names(db('precedence').from_cli)).toEqual(['cli-wins'])
    expect(names(db('precedence').from_cli_uri)).toEqual(['cli-uri-wins', 'file-wins'])
  })

  it('law option-precedence: honours -t, -m and -c (short and long) and falls back to the default template for a missing template file', () => {
    const custom = '// custom template\nexport async function up(): Promise<void> {}\n'
    expect(steps('flags').map((step) => step.exitCode)).toEqual([0, 0, 0])
    expect(scenario('flags').tree).toMatchObject({ 'nested/deep/migrations/<timestamp>-templated.ts': custom, 'nested/deep/migrations/<timestamp>-templated-long.ts': custom, 'migrations/<timestamp>-missing-template.ts': TEMPLATE })
    expect(states(db('flags').custom_collection)).toEqual({ templated: 'down', 'templated-long': 'down' })
  })

  it('law env-files: parses .env syntax: CRLF, comments, export, spaced keys, quotes and backticks, without overriding the process environment', () => {
    const dir = `${work('env-syntax')}/spaced migrations`
    expect(steps('env-syntax')).toEqual([ok('migrate create from-dotenv-syntax', created('from-dotenv-syntax', dir)), ok('migrate create process-beats-dotenv', `${adding(`${dir}/<timestamp>-from-dotenv-syntax`)}${created('process-beats-dotenv', dir)}`)])
    expect(scenario('env-syntax').tree).toMatchObject({ 'spaced migrations/<timestamp>-from-dotenv-syntax.ts': '// template named in a backtick-quoted value\n' })
    expect(names(db('env-syntax')['quoted#collection'])).toEqual(['from-dotenv-syntax'])
    expect(names(db('env-syntax').from_process).sort()).toEqual(['from-dotenv-syntax', 'process-beats-dotenv'])
  })

  it('law strict-query: lets migrations filter on fields missing from the schema (strictQuery off)', () => {
    expect(steps('strict-query').map((step) => step.exitCode)).toEqual([0, 0])
    expect(names(db('strict-query', 'afterUp').examples).sort()).toEqual(['one', 'three', 'two'])
    expect(names(db('strict-query', 'afterDown').examples)).toEqual(['three'])
  })

  it('law connect: fails within the configured server selection timeout when MongoDB is unreachable', () => {
    expect(steps('connection-refused')).toEqual([fail('migrate list', 'connect ECONNREFUSED 127.0.0.1:<closed-port>\n')])
    expect(scenario('connection-refused').within20s).toBe(true)
  })

  it('law env-files: takes an empty .env value as set: it overrides the config file and an empty collection name is rejected', () => {
    expect(steps('env-edge-cases')).toEqual([fail('migrate create empty-env-value', 'Collection name cannot be empty\n')])
    expect(db('env-edge-cases')).toEqual({})
  })

  it('law env-files: ignores a .env file it cannot read', () => {
    expect(steps('env-unreadable')).toEqual([ok('migrate create env-file-is-a-directory -d <mongo>/env_unreadable', created('env-file-is-a-directory', `${work('env-unreadable')}/migrations`))])
    expect(names(db('env-unreadable').migrations)).toEqual(['env-file-is-a-directory'])
  })

  it('law env-files: reads .env values with dotenv quoting, spacing and line endings', () => {
    expect(steps('env-quoting').map((step) => [step.command, step.exitCode, step.stderr])).toEqual(
      ['cr-only', 'export-spaces', 'equals-spaces', 'colon-spaces', 'single-after-spaces', 'double-after-spaces', 'double-escapes', 'single-escapes', 'backtick-escapes', 'quote-at-start', 'quote-at-end'].map((name) => [`migrate create ${name} -d <mongo>/env_quoting`, 0, '']),
    )
    // The collection each case's value names: CR-only line endings, extra spaces after export, around = and after a
    // colon, quotes after spaces (# inside them is not a comment), and quotes that do not wrap the whole value.
    expect(Object.fromEntries(Object.entries(db('env-quoting')).map(([collection, docs]) => [collection, names(docs).sort()]))).toEqual({
      cr_only: ['cr-only'],
      exported: ['export-spaces'],
      equals_spaced: ['equals-spaces'],
      colon_spaced: ['colon-spaces'],
      'single # kept': ['single-after-spaces'],
      'double # kept': ['double-after-spaces'],
      '"mid"post': ['quote-at-start'],
      migrations: ['backtick-escapes', 'double-escapes', 'quote-at-end', 'single-escapes'],
    })
    // The migrations folder each case's value names: only double quotes turn \n and \r into line breaks.
    const files = Object.keys(scenario('env-quoting').tree as object).filter((file) => file.endsWith('.ts'))
    expect(files.sort()).toEqual(
      [
        'cr-only/cr-path/<timestamp>-cr-only.ts',
        'export-spaces/migrations/<timestamp>-export-spaces.ts',
        'equals-spaces/migrations/<timestamp>-equals-spaces.ts',
        'colon-spaces/migrations/<timestamp>-colon-spaces.ts',
        'single-after-spaces/migrations/<timestamp>-single-after-spaces.ts',
        'double-after-spaces/migrations/<timestamp>-double-after-spaces.ts',
        'double-escapes/dq\nline\rend/<timestamp>-double-escapes.ts',
        'single-escapes/sq\\nline/<timestamp>-single-escapes.ts',
        'backtick-escapes/bt\\nline/<timestamp>-backtick-escapes.ts',
        'quote-at-start/migrations/<timestamp>-quote-at-start.ts',
        'quote-at-end/pre"mid"/<timestamp>-quote-at-end.ts',
      ].sort(),
    )
  })

  it('law config-file: reads named exports and the default export tsc emits for CommonJS', () => {
    const [named, tsc] = steps('config-shapes')
    expect(named).toEqual(ok('migrate create named-exports', created('named-exports', `${work('config-shapes')}/named-exports/migrations`)))
    expect(tsc).toEqual(ok('migrate create tsc-commonjs', created('tsc-commonjs', `${work('config-shapes')}/tsc-commonjs/migrations`)))
    expect(names(db('config-shapes').named_exports)).toEqual(['named-exports'])
    expect(names(db('config-shapes').tsc_commonjs)).toEqual(['tsc-commonjs'])
  })

  it('law config-file: reports only the missing URI when the config file throws something that is not an Error', () => {
    expect(steps('config-shapes')[2]).toEqual(fail('migrate list -f ./migrate.ts', URI_REQUIRED))
  })

  it('law env-files: says nothing when --mode names a .env file that does not exist', () => {
    expect(steps('config-shapes')[3]).toEqual(ok('migrate create missing-mode-file -d <mongo>/config_shapes --mode absent', created('missing-mode-file', `${work('config-shapes')}/migrations`)))
  })
})
