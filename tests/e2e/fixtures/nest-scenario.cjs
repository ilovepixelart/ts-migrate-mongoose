'use strict'

require('reflect-metadata')
const fs = require('node:fs')
const path = require('node:path')
const { attempt, migration, summary } = require('./shared.cjs')

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

  out.bootRefused = await attempt(() => boot(MigrationModule.forRoot({ uri: closedUri, migrationsPath, connectOptions: { serverSelectionTimeoutMS: 1500 } })))
}

module.exports = async (modules, options) => {
  const out = { nestExports: Object.keys(modules.nest).sort() }
  const lines = []
  await exercise({ ...modules.tmm, ...modules.nest, NestFactory: modules.core.NestFactory }, options, out, lines)
  out.serviceLogs = lines.filter((line) => line.context === 'MigrationService').map((line) => `${line.level}: ${line.message}`)
  return out
}
