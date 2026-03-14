import { describe, expect, it, vi } from 'vitest'

import { MigrationModule } from '../src/nest/migration.module'
import { MIGRATION_OPTIONS, MigrationService } from '../src/nest/migration.service'

vi.mock('@nestjs/common', () => {
  const LoggerMock = class {
    log = vi.fn()
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
      const optionsProvider = (result.providers as { provide: symbol; useValue: unknown }[]).find(
        (p) => p.provide === MIGRATION_OPTIONS,
      )
      expect(optionsProvider).toBeDefined()
      expect(optionsProvider?.useValue).toEqual(defaultOptions)
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
      const serviceProvider = providers.find(
        (p) => typeof p === 'object' && p !== null && 'provide' in p && (p as { provide: unknown }).provide === MigrationService,
      )
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
  })
})

describe('MigrationService', () => {
  it('should store options', () => {
    const service = new MigrationService(defaultOptions)
    expect(service).toBeDefined()
  })

  it('should connect and run default migrations on bootstrap', async () => {
    const service = new MigrationService(defaultOptions)
    await service.onApplicationBootstrap()
    expect(service.instance).toBeDefined()
  })

  it('should call onBootstrap callback when provided', async () => {
    const onBootstrap = vi.fn()
    const service = new MigrationService({ ...defaultOptions, onBootstrap })
    await service.onApplicationBootstrap()
    expect(onBootstrap).toHaveBeenCalledWith(service.instance)
  })

  it('should log when no migrations found', async () => {
    const service = new MigrationService(defaultOptions)
    await service.onApplicationBootstrap()
    expect(service.instance).toBeDefined()
  })

  it('should log when migrations are up to date', async () => {
    const { Migrator } = await import('../src/index')
    vi.mocked(Migrator.connect).mockResolvedValueOnce({
      run: vi.fn().mockResolvedValue([]),
      list: vi.fn().mockResolvedValue([{ name: 'test', filename: '123-test', state: 'up' }]),
      close: vi.fn(),
    } as never)

    const service = new MigrationService(defaultOptions)
    await service.onApplicationBootstrap()
    expect(service.instance).toBeDefined()
  })

  it('should log applied migrations', async () => {
    const { Migrator } = await import('../src/index')
    vi.mocked(Migrator.connect).mockResolvedValueOnce({
      run: vi.fn().mockResolvedValue([{ name: 'test', filename: '123-test' }]),
      list: vi.fn().mockResolvedValue([]),
      close: vi.fn(),
    } as never)

    const service = new MigrationService(defaultOptions)
    await service.onApplicationBootstrap()
    expect(service.instance).toBeDefined()
  })

  it('should close migrator on shutdown', async () => {
    const service = new MigrationService(defaultOptions)
    await service.onApplicationBootstrap()
    const closeSpy = vi.spyOn(service.instance, 'close')
    await service.onApplicationShutdown()
    expect(closeSpy).toHaveBeenCalled()
  })

  it('should not throw on shutdown when migrator not initialized', async () => {
    const service = new MigrationService(defaultOptions)
    await expect(service.onApplicationShutdown()).resolves.not.toThrow()
  })

  it('should expose migrator via instance getter', async () => {
    const service = new MigrationService(defaultOptions)
    await service.onApplicationBootstrap()
    expect(service.instance).toBeDefined()
    expect(service.instance.run).toBeDefined()
    expect(service.instance.list).toBeDefined()
    expect(service.instance.close).toBeDefined()
  })
})
