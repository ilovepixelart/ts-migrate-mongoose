/** biome-ignore-all lint/complexity/noStaticOnlyClass: nest */
import { Module } from '@nestjs/common'
import { MIGRATION_OPTIONS, MigrationService } from './migration.service'

import type { DynamicModule, Provider } from '@nestjs/common'
import type { MigrationModuleAsyncOptions, MigrationModuleOptions, MigrationOptionsFactory } from './interfaces'

@Module({})
export class MigrationModule {
  static forRoot(options: MigrationModuleOptions & { isGlobal?: boolean }): DynamicModule {
    return {
      module: MigrationModule,
      global: options.isGlobal ?? false,
      providers: [
        { provide: MIGRATION_OPTIONS, useValue: options },
        {
          provide: MigrationService,
          useFactory: (opts: MigrationModuleOptions) => new MigrationService(opts),
          inject: [MIGRATION_OPTIONS],
        },
      ],
      exports: [MigrationService],
    }
  }

  static forRootAsync(options: MigrationModuleAsyncOptions): DynamicModule {
    const asyncProviders = MigrationModule.createAsyncProviders(options)

    return {
      module: MigrationModule,
      global: options.isGlobal ?? false,
      imports: options.imports ?? [],
      providers: [
        ...asyncProviders,
        {
          provide: MigrationService,
          useFactory: (opts: MigrationModuleOptions) => new MigrationService(opts),
          inject: [MIGRATION_OPTIONS],
        },
      ],
      exports: [MigrationService],
    }
  }

  private static createAsyncProviders(options: MigrationModuleAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: MIGRATION_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
      ]
    }

    if (options.useClass) {
      return [
        { provide: options.useClass, useClass: options.useClass },
        {
          provide: MIGRATION_OPTIONS,
          useFactory: (factory: MigrationOptionsFactory) => factory.createMigrationOptions(),
          inject: [options.useClass],
        },
      ]
    }

    if (options.useExisting) {
      return [
        {
          provide: MIGRATION_OPTIONS,
          useFactory: (factory: MigrationOptionsFactory) => factory.createMigrationOptions(),
          inject: [options.useExisting],
        },
      ]
    }

    return []
  }
}
