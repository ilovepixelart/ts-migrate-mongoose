import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MigrationModule } from '../src/nest/migration.module'
import { MigrationService } from '../src/nest/migration.service'

const connectMock = vi.fn()

vi.mock('../src/index', () => ({
  Migrator: {
    connect: (...args: unknown[]) => connectMock(...args),
  },
}))

const stubInstance = () => ({
  run: vi.fn().mockResolvedValue([]),
  list: vi.fn().mockResolvedValue([]),
  close: vi.fn().mockResolvedValue(undefined),
  create: vi.fn(),
  prune: vi.fn(),
})

const defaultOptions = { uri: 'mongodb://localhost:27017/test' }

describe('MigrationModule — real Nest DI', () => {
  beforeEach(() => {
    connectMock.mockReset()
    connectMock.mockResolvedValue(stubInstance())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('forRoot wires MigrationService through the real DI container', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MigrationModule.forRoot(defaultOptions)],
    }).compile()

    const svc = moduleRef.get(MigrationService)
    expect(svc).toBeInstanceOf(MigrationService)

    await moduleRef.init()
    expect(connectMock).toHaveBeenCalledTimes(1)
    expect(connectMock).toHaveBeenCalledWith(defaultOptions)
    expect(svc.instance).toBeDefined()

    await moduleRef.close()
  })

  it('forRootAsync resolves a sync useFactory through the real DI container', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MigrationModule.forRootAsync({ useFactory: () => defaultOptions })],
    }).compile()

    await moduleRef.init()
    expect(connectMock).toHaveBeenCalledWith(defaultOptions)

    await moduleRef.close()
  })

  it('forRootAsync resolves an async useFactory through the real DI container', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        MigrationModule.forRootAsync({
          useFactory: async () => {
            await Promise.resolve()
            return defaultOptions
          },
        }),
      ],
    }).compile()

    await moduleRef.init()
    expect(connectMock).toHaveBeenCalledWith(defaultOptions)

    await moduleRef.close()
  })

  it('forRootAsync useClass calls createMigrationOptions via the real container', async () => {
    const createSpy = vi.fn().mockReturnValue(defaultOptions)

    class ConfigFactory {
      createMigrationOptions() {
        return createSpy()
      }
    }

    const moduleRef = await Test.createTestingModule({
      imports: [MigrationModule.forRootAsync({ useClass: ConfigFactory })],
    }).compile()

    await moduleRef.init()
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(connectMock).toHaveBeenCalledWith(defaultOptions)

    await moduleRef.close()
  })

  it('onApplicationBootstrap propagates errors from Migrator.connect so Nest refuses to start', async () => {
    const bootFailure = new Error('db unavailable')
    connectMock.mockRejectedValueOnce(bootFailure)

    const moduleRef = await Test.createTestingModule({
      imports: [MigrationModule.forRoot(defaultOptions)],
    }).compile()

    await expect(moduleRef.init()).rejects.toThrow('db unavailable')
  })

  it('onBootstrap callback overrides default migrations and receives the connected Migrator', async () => {
    const onBootstrap = vi.fn().mockResolvedValue(undefined)
    const instance = stubInstance()
    connectMock.mockResolvedValueOnce(instance)

    const moduleRef = await Test.createTestingModule({
      imports: [MigrationModule.forRoot({ ...defaultOptions, onBootstrap })],
    }).compile()

    await moduleRef.init()
    expect(onBootstrap).toHaveBeenCalledTimes(1)
    expect(onBootstrap).toHaveBeenCalledWith(instance)
    // When onBootstrap is provided, the default `run('up')` path is skipped.
    expect(instance.run).not.toHaveBeenCalled()

    await moduleRef.close()
  })

  it('onApplicationShutdown closes the connected Migrator', async () => {
    const instance = stubInstance()
    connectMock.mockResolvedValueOnce(instance)

    const moduleRef = await Test.createTestingModule({
      imports: [MigrationModule.forRoot(defaultOptions)],
    }).compile()
    moduleRef.enableShutdownHooks()

    await moduleRef.init()
    await moduleRef.close()

    expect(instance.close).toHaveBeenCalled()
  })
})
