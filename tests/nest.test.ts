import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MigrationModule } from '../src/nest/migration.module'
import { MIGRATION_OPTIONS, MigrationService } from '../src/nest/migration.service'

import type { FactoryProvider, Provider } from '@nestjs/common'

const findFactoryProvider = (providers: Provider[], token: unknown): FactoryProvider => {
  const hit = (providers as FactoryProvider[]).find((p) => typeof p === 'object' && p !== null && 'provide' in p && p.provide === token && 'useFactory' in p)
  if (!hit) throw new Error(`factory provider for ${String(token)} not found`)
  return hit
}

// Every line a Logger logs, prefixed with its context.
const logs = vi.hoisted(() => [] as string[])

vi.mock('@nestjs/common', () => {
  const LoggerMock = class {
    constructor(private readonly context: string) {}
    log = (message: string) => logs.push(`${this.context}: ${message}`)
  }
  return {
    Module: () => () => {},
    Logger: LoggerMock,
  }
})

vi.mock('../src/index', () => ({
  Migrator: {
    connect: vi.fn().mockResolvedValue({
      run: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockResolvedValue([]),
      close: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
      prune: vi.fn(),
    }),
  },
}))

const defaultOptions = { uri: 'mongodb://localhost:27017/test' }

describe('MigrationModule', () => {
  describe('forRoot', () => {
    it('should return a dynamic module with providers', () => {
      const result = MigrationModule.forRoot(defaultOptions)
      expect(result.module).toBe(MigrationModule)
      expect(result.providers).toBeDefined()
      expect(result.exports).toContain(MigrationService)
    })

    it('should set global to false by default', () => {
      const result = MigrationModule.forRoot(defaultOptions)
      expect(result.global).toBe(false)
    })

    it('should set global when isGlobal is true', () => {
      const result = MigrationModule.forRoot({ ...defaultOptions, isGlobal: true })
      expect(result.global).toBe(true)
    })

    it('should provide MIGRATION_OPTIONS with useValue', () => {
      const result = MigrationModule.forRoot(defaultOptions)
      const optionsProvider = (result.providers as { provide: symbol; useValue: unknown }[]).find((p) => p.provide === MIGRATION_OPTIONS)
      expect(optionsProvider).toBeDefined()
      expect(optionsProvider?.useValue).toEqual(defaultOptions)
    })

    it('MigrationService factory constructs a MigrationService from MIGRATION_OPTIONS', () => {
      const result = MigrationModule.forRoot(defaultOptions)
      const svcProvider = findFactoryProvider(result.providers as Provider[], MigrationService)
      expect(svcProvider.inject).toEqual([MIGRATION_OPTIONS])
      const svc = (svcProvider.useFactory as (opts: typeof defaultOptions) => MigrationService)(defaultOptions)
      expect(svc).toBeInstanceOf(MigrationService)
    })
  })

  describe('forRootAsync', () => {
    it('should return a dynamic module with useFactory', () => {
      const result = MigrationModule.forRootAsync({
        useFactory: () => defaultOptions,
      })
      expect(result.module).toBe(MigrationModule)
      expect(result.providers).toBeDefined()
      expect(result.exports).toContain(MigrationService)
    })

    it('should support useClass', () => {
      class TestFactory {
        createMigrationOptions() {
          return defaultOptions
        }
      }
      const result = MigrationModule.forRootAsync({ useClass: TestFactory })
      expect(result.providers).toBeDefined()
      expect(result.providers?.length).toBeGreaterThan(1)
    })

    it('should support useExisting', () => {
      class TestFactory {
        createMigrationOptions() {
          return defaultOptions
        }
      }
      const result = MigrationModule.forRootAsync({ useExisting: TestFactory })
      expect(result.providers).toBeDefined()
    })

    it('should return empty providers when no factory method', () => {
      const result = MigrationModule.forRootAsync({})
      const providers = result.providers as unknown[]
      const serviceProvider = providers.find((p) => typeof p === 'object' && p !== null && 'provide' in p && (p as { provide: unknown }).provide === MigrationService)
      expect(serviceProvider).toBeDefined()
    })

    it('should pass imports through', () => {
      const result = MigrationModule.forRootAsync({
        imports: [],
        useFactory: () => defaultOptions,
      })
      expect(result.imports).toEqual([])
    })

    it('should set global when isGlobal is true', () => {
      const result = MigrationModule.forRootAsync({
        isGlobal: true,
        useFactory: () => defaultOptions,
      })
      expect(result.global).toBe(true)
    })

    it('MigrationService factory constructs a MigrationService from MIGRATION_OPTIONS', () => {
      const result = MigrationModule.forRootAsync({ useFactory: () => defaultOptions })
      const svcProvider = findFactoryProvider(result.providers as Provider[], MigrationService)
      expect(svcProvider.inject).toEqual([MIGRATION_OPTIONS])
      const svc = (svcProvider.useFactory as (opts: typeof defaultOptions) => MigrationService)(defaultOptions)
      expect(svc).toBeInstanceOf(MigrationService)
    })

    it('useClass provider factory calls createMigrationOptions on the injected factory instance', () => {
      class TestFactory {
        createMigrationOptions() {
          return defaultOptions
        }
      }
      const result = MigrationModule.forRootAsync({ useClass: TestFactory })
      const optionsProvider = findFactoryProvider(result.providers as Provider[], MIGRATION_OPTIONS)
      expect(optionsProvider.inject).toEqual([TestFactory])
      const factory = new TestFactory()
      const createSpy = vi.spyOn(factory, 'createMigrationOptions')
      const opts = (optionsProvider.useFactory as (f: TestFactory) => unknown)(factory)
      expect(createSpy).toHaveBeenCalledTimes(1)
      expect(opts).toEqual(defaultOptions)
    })

    it('useExisting provider factory calls createMigrationOptions on the injected factory instance', () => {
      class TestFactory {
        createMigrationOptions() {
          return defaultOptions
        }
      }
      const result = MigrationModule.forRootAsync({ useExisting: TestFactory })
      const optionsProvider = findFactoryProvider(result.providers as Provider[], MIGRATION_OPTIONS)
      expect(optionsProvider.inject).toEqual([TestFactory])
      const factory = new TestFactory()
      const createSpy = vi.spyOn(factory, 'createMigrationOptions')
      const opts = (optionsProvider.useFactory as (f: TestFactory) => unknown)(factory)
      expect(createSpy).toHaveBeenCalledTimes(1)
      expect(opts).toEqual(defaultOptions)
    })
  })
})

// A connected Migrator whose list and run resolve to the given records.
const connectTo = async (existing: { filename: string }[], applied: { filename: string }[]) => {
  const { Migrator } = await import('../src/index')
  const migrator = { list: vi.fn().mockResolvedValue(existing), run: vi.fn().mockResolvedValue(applied), close: vi.fn().mockResolvedValue(undefined) }
  vi.mocked(Migrator.connect).mockResolvedValueOnce(migrator as never)
  return { connect: vi.mocked(Migrator.connect), migrator }
}

describe('MigrationService', () => {
  beforeEach(() => {
    logs.length = 0
  })

  it('connects with its options, runs every pending migration up and logs each one and the count', async () => {
    const { connect, migrator } = await connectTo([], [{ filename: '1-first' }, { filename: '2-second' }])
    const service = new MigrationService(defaultOptions)
    await service.onApplicationBootstrap()
    expect(connect).toHaveBeenLastCalledWith(defaultOptions)
    expect(migrator.run).toHaveBeenCalledExactlyOnceWith('up')
    expect(service.instance).toBe(migrator)
    expect(logs).toEqual(['MigrationService: Connected to migration database', 'MigrationService: up: 1-first', 'MigrationService: up: 2-second', 'MigrationService: Applied 2 migration(s)'])
  })

  it('logs what it applied even when some migrations were already recorded', async () => {
    await connectTo([{ filename: '1-first' }], [{ filename: '2-second' }])
    await new MigrationService(defaultOptions).onApplicationBootstrap()
    expect(logs).toEqual(['MigrationService: Connected to migration database', 'MigrationService: up: 2-second', 'MigrationService: Applied 1 migration(s)'])
  })

  it('logs the total when every recorded migration is already up', async () => {
    await connectTo([{ filename: '1-first' }, { filename: '2-second' }], [])
    await new MigrationService(defaultOptions).onApplicationBootstrap()
    expect(logs).toEqual(['MigrationService: Connected to migration database', 'MigrationService: All migrations are up to date (2 total)'])
  })

  it('logs that there are no migrations when none are recorded or pending', async () => {
    await connectTo([], [])
    await new MigrationService(defaultOptions).onApplicationBootstrap()
    expect(logs).toEqual(['MigrationService: Connected to migration database', 'MigrationService: No migrations found'])
  })

  it('hands the connected Migrator to onBootstrap instead of running migrations', async () => {
    const { migrator } = await connectTo([], [{ filename: '1-first' }])
    const onBootstrap = vi.fn()
    await new MigrationService({ ...defaultOptions, onBootstrap }).onApplicationBootstrap()
    expect(onBootstrap).toHaveBeenCalledExactlyOnceWith(migrator)
    expect(migrator.list).not.toHaveBeenCalled()
    expect(migrator.run).not.toHaveBeenCalled()
    expect(logs).toEqual(['MigrationService: Connected to migration database'])
  })

  it('closes the Migrator on shutdown', async () => {
    const { migrator } = await connectTo([], [])
    const service = new MigrationService(defaultOptions)
    await service.onApplicationBootstrap()
    await service.onApplicationShutdown()
    expect(migrator.close).toHaveBeenCalledOnce()
  })

  it('shuts down without a Migrator when bootstrap never ran', async () => {
    const service = new MigrationService(defaultOptions)
    await expect(service.onApplicationShutdown()).resolves.toBeUndefined()
    expect(service.instance).toBeUndefined()
  })
})
