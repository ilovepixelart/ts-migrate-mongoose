import { Env, Migrator } from 'ts-migrate-mongoose'
import { MIGRATION_OPTIONS, MigrationModule, MigrationService } from 'ts-migrate-mongoose/nest'

import type { ConfigOptions, Migration, MigratorOptions } from 'ts-migrate-mongoose'
import type { MigrationModuleAsyncOptions, MigrationModuleOptions, MigrationOptionsFactory } from 'ts-migrate-mongoose/nest'

const options: MigratorOptions = { uri: 'mongodb://127.0.0.1:27017/types', autosync: true, connectOptions: { serverSelectionTimeoutMS: 1000 } }
const config: ConfigOptions = { configPath: './migrate', mode: 'test' }
const key: Env = Env.MIGRATE_MONGO_URI

export const migrate = async (): Promise<Migration['state'][]> => {
  const migrator = await Migrator.connect(options)
  const ran = await migrator.run('up', 'name', true)
  await migrator.list()
  await migrator.sync()
  await migrator.prune()
  await migrator.create('name')
  // @ts-expect-error the direction is 'up' or 'down'
  await migrator.run('sideways')
  await migrator.close()
  return ran.map((migration) => migration.state)
}

const moduleOptions: MigrationModuleOptions = {
  ...options,
  onBootstrap: async (migrator: Migrator) => {
    await migrator.run('up')
  },
}

class OptionsFactory implements MigrationOptionsFactory {
  createMigrationOptions(): MigrationModuleOptions {
    return moduleOptions
  }
}

const asyncOptions: MigrationModuleAsyncOptions = { useClass: OptionsFactory }

export const modules = [MigrationModule.forRoot(moduleOptions), MigrationModule.forRootAsync(asyncOptions)]
export const tokens = [MIGRATION_OPTIONS, MigrationService, config, key]
