'use strict'

require('reflect-metadata')
const { Module } = require('@nestjs/common')
const fs = require('node:fs')
const path = require('node:path')
const { attempt, migration, summary } = require('./shared.cjs')

// Module() is a class decorator: it annotates the class it is given and returns nothing.
const nestModule = (name, metadata) => {
  const target = { [name]: class {} }[name]
  Module(metadata)(target)
  return target
}

const createLogger = (lines) => {
  const record = (level) => (message, context) => lines.push({ level, context: typeof context === 'string' ? context : undefined, message: String(message) })
  return { log: record('log'), error: record('error'), warn: record('warn'), debug: record('debug'), verbose: record('verbose'), fatal: record('fatal') }
}

const exercise = async ({ Migrator, MigrationModule, MigrationService, MIGRATION_OPTIONS, NestFactory }, { uri, closedUri, workDir }, out, lines) => {
  const migrationsPath = path.join(workDir, 'nest-migrations')
  fs.mkdirSync(migrationsPath, { recursive: true })
  fs.writeFileSync(path.join(migrationsPath, '1700000000001-nest-first.ts'), migration('nest-first'))
  const boot = (module) => NestFactory.createApplicationContext(module, { logger: createLogger(lines), abortOnError: false })

  let app = await boot(MigrationModule.forRoot({ uri, migrationsPath, autosync: true }))
  const service = app.get(MigrationService)
  out.instanceIsMigrator = service.instance instanceof Migrator
  out.optionsToken = typeof MIGRATION_OPTIONS
  out.afterFirstBoot = summary(await service.instance.list())
  const connection = service.instance.connection
  await app.close()
  out.readyStateAfterClose = connection.readyState

  app = await boot(MigrationModule.forRoot({ uri, migrationsPath, autosync: true, isGlobal: true }))
  await app.close()

  app = await boot(
    MigrationModule.forRootAsync({
      useFactory: async () => ({
        uri,
        migrationsPath,
        autosync: true,
        onBootstrap: async (migrator) => {
          out.onBootstrapDown = summary(await migrator.run('down', 'nest-first'))
        },
      }),
    }),
  )
  await app.close()

  class OptionsFactory {
    createMigrationOptions() {
      return { uri, migrationsPath, autosync: true }
    }
  }
  app = await boot(MigrationModule.forRootAsync({ useClass: OptionsFactory }))
  out.afterUseClassBoot = summary(await app.get(MigrationService).instance.list())
  await app.close()

  app = await boot(MigrationModule.forRoot({ uri, migrationsPath: path.join(workDir, 'nest-empty'), collection: 'empty_migrations' }))
  await app.close()

  const CONFIG = 'MIGRATE_CONFIG'
  const ConfigModule = nestModule('ConfigModule', { providers: [{ provide: CONFIG, useValue: { uri, migrationsPath, collection: 'inject_migrations', autosync: true } }], exports: [CONFIG] })
  app = await boot(MigrationModule.forRootAsync({ imports: [ConfigModule], useFactory: (config) => config, inject: [CONFIG] }))
  out.afterInjectedFactoryBoot = summary(await app.get(MigrationService).instance.list())
  await app.close()

  class ExistingFactory {
    createMigrationOptions() {
      return { uri, migrationsPath, collection: 'existing_migrations', autosync: true }
    }
  }
  const ExistingModule = nestModule('ExistingModule', { providers: [ExistingFactory], exports: [ExistingFactory] })
  app = await boot(MigrationModule.forRootAsync({ imports: [ExistingModule], useExisting: ExistingFactory }))
  out.afterUseExistingBoot = summary(await app.get(MigrationService).instance.list())
  await app.close()

  const FeatureModule = nestModule('FeatureModule', { providers: [{ provide: 'PROBE', useFactory: (service) => ({ service }), inject: [MigrationService] }] })
  const rootWith = (isGlobal) => nestModule('RootModule', { imports: [MigrationModule.forRoot({ uri, migrationsPath, collection: 'global_migrations', autosync: true, isGlobal }), FeatureModule] })
  app = await boot(rootWith(true))
  out.globalServiceInjectedElsewhere = app.get('PROBE').service === app.get(MigrationService)
  await app.close()
  out.nonGlobalServiceInjectedElsewhere = await attempt(() => boot(rootWith(false)).then((context) => context.close()))
  out.defaultServiceInjectedElsewhere = await attempt(() => boot(rootWith(undefined)).then((context) => context.close()))

  const asyncRootWith = (isGlobal) =>
    nestModule('AsyncGlobalRoot', {
      imports: [MigrationModule.forRootAsync({ isGlobal, useFactory: () => ({ uri, migrationsPath, collection: 'async_global_migrations', autosync: true }) }), FeatureModule],
    })
  out.asyncDefaultServiceInjectedElsewhere = await attempt(() => boot(asyncRootWith(undefined)).then((context) => context.close()))
  app = await boot(asyncRootWith(true))
  out.asyncGlobalServiceInjectedElsewhere = app.get('PROBE').service === app.get(MigrationService)
  await app.close()

  out.asyncWithoutFactory = await attempt(() => boot(MigrationModule.forRootAsync({})).then((context) => context.close()))

  out.bootRefused = await attempt(() => boot(MigrationModule.forRoot({ uri: closedUri, migrationsPath, connectOptions: { serverSelectionTimeoutMS: 1500 } })))
}

module.exports = async (modules, options) => {
  const out = { nestExports: Object.keys(modules.nest).sort() }
  const lines = []
  await exercise({ ...modules.tmm, ...modules.nest, NestFactory: modules.core.NestFactory }, options, out, lines)
  out.serviceLogs = lines.filter((line) => line.context === 'MigrationService').map((line) => `${line.level}: ${line.message}`)
  return out
}
