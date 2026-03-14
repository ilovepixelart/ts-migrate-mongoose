import type { InjectionToken, ModuleMetadata, OptionalFactoryDependency, Type } from '@nestjs/common'
import type { Migrator } from '../index'
import type { MigratorOptions } from '../types'

export interface MigrationModuleOptions extends MigratorOptions {
  onBootstrap?: (migrator: Migrator) => Promise<void>
}

export interface MigrationOptionsFactory {
  createMigrationOptions(): MigrationModuleOptions | Promise<MigrationModuleOptions>
}

export interface MigrationModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  isGlobal?: boolean
  inject?: (InjectionToken | OptionalFactoryDependency)[]
  useClass?: Type<MigrationOptionsFactory>
  useExisting?: Type<MigrationOptionsFactory>
  // biome-ignore lint/suspicious/noExplicitAny: NestJS convention for factory args
  useFactory?: (...args: any[]) => MigrationModuleOptions | Promise<MigrationModuleOptions>
}
