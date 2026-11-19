import { describe, expect, it } from 'vitest'

import { scenario } from './observations'

describe('NestJS integration', () => {
  const nest = scenario('nest-esm')
  const result = (nest.result ?? {}) as Record<string, unknown>

  it('law module-formats: behaves identically through require and import', () => {
    expect(scenario('nest-cjs')).toEqual(nest)
  })

  it('law module-formats: exports the module, the service and the options token', () => {
    expect(result.nestExports).toEqual(['MIGRATION_OPTIONS', 'MigrationModule', 'MigrationService'])
    expect(result.optionsToken).toBe('symbol')
  })

  it('law nest-lifecycle: runs pending migrations on bootstrap, honours onBootstrap and closes on shutdown', () => {
    expect(nest).toMatchObject({ exitCode: 0, timedOut: false, stdout: '', stderr: '' })
    expect(result.instanceIsMigrator).toBe(true)
    expect(result.afterFirstBoot).toEqual([{ name: 'nest-first', state: 'up', filename: '<timestamp>-nest-first' }])
    expect(result.readyStateAfterClose).toBe(0)
    expect((result.onBootstrapDown as { name: string }[]).map((doc) => doc.name)).toEqual(['nest-first'])
    expect(result.afterUseClassBoot).toEqual([{ name: 'nest-first', state: 'up', filename: '<timestamp>-nest-first' }])
    expect(result.serviceLogs).toEqual([
      'log: Connected to migration database',
      'log: up: <timestamp>-nest-first',
      'log: Applied 1 migration(s)',
      'log: Connected to migration database',
      'log: All migrations are up to date (1 total)',
      'log: Connected to migration database',
      'log: Connected to migration database',
      'log: up: <timestamp>-nest-first',
      'log: Applied 1 migration(s)',
      'log: Connected to migration database',
      'log: No migrations found',
      ...['injected factory', 'useExisting', 'global', 'async global'].flatMap(() => ['log: Connected to migration database', 'log: up: <timestamp>-nest-first', 'log: Applied 1 migration(s)']),
    ])
  })

  it('law nest-di: resolves forRootAsync options through imports with an injected factory and through useExisting', () => {
    expect(result.afterInjectedFactoryBoot).toEqual([{ name: 'nest-first', state: 'up', filename: '<timestamp>-nest-first' }])
    expect(result.afterUseExistingBoot).toEqual([{ name: 'nest-first', state: 'up', filename: '<timestamp>-nest-first' }])
    expect(Object.keys(nest.db as object)).toEqual(expect.arrayContaining(['inject_migrations', 'existing_migrations']))
  })

  it('law nest-di: makes MigrationService injectable in other modules only when isGlobal is set, for forRoot and forRootAsync', () => {
    expect(result.globalServiceInjectedElsewhere).toBe(true)
    expect(result.asyncGlobalServiceInjectedElsewhere).toBe(true)
    // isGlobal: false and isGlobal left out both keep the service to the module that imports MigrationModule.
    for (const key of ['nonGlobalServiceInjectedElsewhere', 'defaultServiceInjectedElsewhere']) {
      const refused = (result[key] as { rejected?: { name: string; message: string } }).rejected
      expect(refused?.message).toMatch(/^Nest can't resolve dependencies of the PROBE \(\?\)\. Please make sure that the argument MigrationService at index \[0\] is available in the FeatureModule module\./)
    }
  })

  it('law nest-di: fails bootstrap when forRootAsync is given no way to build the options', () => {
    const refused = (result.asyncWithoutFactory as { rejected?: { message: string } }).rejected
    expect(refused?.message).toMatch(/^Nest can't resolve dependencies of the MigrationService \(\?\)\. Please make sure that the argument Symbol\(MIGRATION_OPTIONS\) at index \[0\] is available in the MigrationModule module\./)
  })

  it('law nest-lifecycle: shuts down cleanly when lazily loaded, where Nest runs no bootstrap hook', () => {
    expect(result.lazyInstance).toBe('undefined')
    expect(result.lazyClose).toEqual({})
  })

  it('law nest-lifecycle: fails bootstrap with the connection error when MongoDB is unreachable', () => {
    expect(result.bootRefused).toEqual({ rejected: { name: 'MongooseServerSelectionError', message: 'connect ECONNREFUSED 127.0.0.1:<closed-port>' } })
  })
})
