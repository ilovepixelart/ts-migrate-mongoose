import { Logger } from '@nestjs/common'
import { Migrator } from '../index'

import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import type { MigrationModuleOptions } from './interfaces'

export const MIGRATION_OPTIONS = Symbol('MIGRATION_OPTIONS')

export class MigrationService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MigrationService.name)
  private readonly options: MigrationModuleOptions
  private migrator!: Migrator

  constructor(options: MigrationModuleOptions) {
    this.options = options
  }

  get instance(): Migrator {
    return this.migrator
  }

  async onApplicationBootstrap(): Promise<void> {
    this.migrator = await Migrator.connect(this.options)
    this.logger.log('Connected to migration database')

    if (this.options.onBootstrap) {
      await this.options.onBootstrap(this.migrator)
    } else {
      await this.runDefaultMigrations()
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.migrator) {
      await this.migrator.close()
    }
  }

  private async runDefaultMigrations(): Promise<void> {
    const existing = await this.migrator.list()
    const migrations = await this.migrator.run('up')

    if (migrations.length === 0 && existing.length > 0) {
      this.logger.log(`All migrations are up to date (${existing.length} total)`)
    } else if (migrations.length === 0) {
      this.logger.log('No migrations found')
    } else {
      for (const migration of migrations) {
        this.logger.log(`up: ${migration.filename}`)
      }
      this.logger.log(`Applied ${migrations.length} migration(s)`)
    }
  }
}
