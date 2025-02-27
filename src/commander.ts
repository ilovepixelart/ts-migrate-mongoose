import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import chalk from 'chalk'
import { Command } from 'commander'
import { config } from 'dotenv'
import { tsImport } from 'tsx/esm/api'

import { defaults } from './defaults'
import { Env, Migrator } from './index'

import type { ConfigOptions, ConfigOptionsDefault, MigratorOptions } from './types'

const fileExists = async (filePath: string): Promise<boolean> => {
  return fs.promises.access(filePath).then(() => true).catch(() => false)
}

const resolveConfigPath = async (configPath: string): Promise<string> => {
  const validExtensions = ['.ts', '.js', '.json']
  const message = `Config file must have an extension of ${validExtensions.join(', ')}`
  const extension = path.extname(configPath)

  if (extension) {
    if (!validExtensions.includes(extension)) {
      throw new Error(message)
    }

    return path.resolve(configPath)
  }

  for (const ext of validExtensions) {
    const configFilePath = path.resolve(configPath + ext)
    if (await fileExists(configFilePath)) {
      console.log(`Found config file: ${configFilePath}`)

      return configFilePath
    }
  }

  throw new Error(message)
}

const loadModule = async (configPath: string): Promise<{ default?: ConfigOptionsDefault | ConfigOptions }> => {
  let config = await resolveConfigPath(configPath)
  const fileUrl = pathToFileURL(config).href

  const extension = path.extname(config)
  if (extension === '.ts') {
    return (await tsImport(fileUrl, import.meta.url)) as { default?: ConfigOptionsDefault | ConfigOptions }
  }

  return await import(fileUrl)
}

const extractOptions = (module: { default?: ConfigOptionsDefault | ConfigOptions }): ConfigOptions | undefined => {
  if (module.default) {
    return 'default' in module.default ? module.default.default : (module.default as ConfigOptions)
  }

  return module as ConfigOptions
}

const logError = (error: unknown): void => {
  if (error instanceof Error) {
    console.log(chalk.red(error.message))
  }
}

/**
 * Get the options from the config file
 * @param configPath The options passed to the CLI
 * @returns The options from the config file
 */
export const getConfig = async (configPath: string): Promise<ConfigOptions> => {
  let configOptions: ConfigOptions = {}
  if (configPath) {
    try {
      const configFilePath = path.resolve(configPath)
      const module = await loadModule(configFilePath)
      const fileOptions = extractOptions(module)

      if (fileOptions) {
        configOptions = fileOptions
      }
    } catch (error) {
      logError(error)
      configOptions = {}
    }
  }

  return configOptions
}

export const toCamelCase = (str: Env): string => {
  return str.toLocaleLowerCase().replace(/_([a-z])/g, (g) => (g[1] ? g[1].toUpperCase() : ''))
}

export const getEnv = (key: Env): string | undefined => {
  // To automatically support camelCase keys
  return process.env[key] ?? process.env[toCamelCase(key)]
}

export const getEnvBoolean = (key: Env): boolean | undefined => {
  const value = getEnv(key)
  if (value === 'true') return true

  return undefined
}

/**
 * Get the migrator instance
 * @param options The options passed to the CLI
 * @returns The migrator instance
 * @throws Error if the uri is not provided in the config file, environment or CLI
 */
export const getMigrator = async (options: ConfigOptions): Promise<Migrator> => {
  config({ path: '.env' })
  config({ path: '.env.local', override: true })

  const mode = options.mode ?? getEnv(Env.MIGRATE_MODE)

  if (mode) {
    config({ path: `.env.${mode}`, override: true })
    config({ path: `.env.${mode}.local`, override: true })
  }

  const configPath = options.configPath ?? getEnv(Env.MIGRATE_CONFIG_PATH) ?? defaults.MIGRATE_CONFIG_PATH

  const fileOptions = await getConfig(configPath)
  // No default value always required
  const uri = options.uri ?? getEnv(Env.MIGRATE_MONGO_URI) ?? fileOptions.uri
  // Connect options can be only provided in the config file for cli usage
  const connectOptions = fileOptions.connectOptions
  const collection = options.collection ?? getEnv(Env.MIGRATE_MONGO_COLLECTION) ?? fileOptions.collection ?? defaults.MIGRATE_MONGO_COLLECTION
  const migrationsPath = options.migrationsPath ?? getEnv(Env.MIGRATE_MIGRATIONS_PATH) ?? fileOptions.migrationsPath ?? defaults.MIGRATE_MIGRATIONS_PATH
  const templatePath = options.templatePath ?? getEnv(Env.MIGRATE_TEMPLATE_PATH) ?? fileOptions.templatePath
  // can be empty then we use default template
  const autosync = Boolean(options.autosync ?? getEnvBoolean(Env.MIGRATE_AUTOSYNC) ?? fileOptions.autosync ?? defaults.MIGRATE_AUTOSYNC)

  if (!uri) {
    const message = chalk.red('You need to provide the MongoDB Connection URI to persist migration status.\nUse option --uri / -d to provide the URI.')
    throw new Error(message)
  }

  const migratorOptions: MigratorOptions = {
    migrationsPath,
    uri,
    collection,
    autosync,
    cli: true,
  }

  if (templatePath) {
    migratorOptions.templatePath = templatePath
  }

  if (connectOptions) {
    migratorOptions.connectOptions = connectOptions
  }

  return Migrator.connect(migratorOptions)
}

/**
 * This class is responsible for running migrations in the CLI
 * @class Migrate
 */
export class Migrate {
  private readonly program: Command
  private migrator!: Migrator

  constructor() {
    this.program = new Command()

    this.program
      .name('migrate')
      .description(chalk.cyan('CLI migration tool for mongoose'))
      .option('-f, --config-path <path>', 'path to the config file')
      .option('-d, --uri <string>', chalk.yellow('mongo connection string'))
      .option('-c, --collection <string>', 'collection name to use for the migrations')
      .option('-a, --autosync <boolean>', 'automatically sync new migrations without prompt')
      .option('-m, --migrations-path <path>', 'path to the migration files')
      .option('-t, --template-path <path>', 'template file to use when creating a migration')
      .option('--mode <string>', 'environment mode to use .env.[mode] file')
      .hook('preAction', async () => {
        const options = this.program.opts<ConfigOptions>()
        this.migrator = await getMigrator(options)
      })

    this.program
      .command('list')
      .description('list all migrations')
      .action(async () => {
        console.log(chalk.cyan('Listing migrations'))
        await this.migrator.list()
      })

    this.program
      .command('create <migration-name>')
      .description('create a new migration file')
      .action(async (migrationName: string) => {
        await this.migrator.create(migrationName)
        const migrateUp = chalk.cyan(`migrate up ${migrationName}`)
        console.log(`Migration created. Run ${migrateUp} to apply the migration`)
      })

    this.program
      .command('up [migration-name]')
      .description('run all migrations or a specific migration if name provided')
      .option('-s, --single', 'run single migration', false)
      .action(async (migrationName?: string, options?: { single: boolean }) => {
        await this.migrator.run('up', migrationName, options?.single)
      })

    this.program
      .command('down <migration-name>')
      .description('roll back migrations down to given name')
      .option('-s, --single', 'run single migration', false)
      .action(async (migrationName?: string, options?: { single: boolean }) => {
        await this.migrator.run('down', migrationName, options?.single)
      })

    this.program
      .command('prune')
      .description('delete extraneous migrations from migration folder or database')
      .action(async () => {
        await this.migrator.prune()
      })
  }

  /**
   * Finish the CLI
   * @param error The error to log
   * @returns The parsed console arguments
   * @throws Error if error is provided
   */
  public async finish(exit: boolean, error?: Error): Promise<ConfigOptions> {
    if (this.migrator instanceof Migrator) {
      await this.migrator.close()
    }

    if (error) {
      console.error(chalk.red(error.message))
      if (exit) process.exit(1)
      throw error
    }

    if (exit) process.exit(0)

    return this.program.opts<ConfigOptions>()
  }

  /**
   * Run the CLI
   * @param exit Whether to exit the process after running the command, defaults to true
   * @returns The parsed options or void if exit is true
   */
  public async run(exit = true): Promise<ConfigOptions> {
    return this.program
      .parseAsync(process.argv)
      .then(() => {
        return this.finish(exit)
      })
      .catch((error: unknown) => {
        return this.finish(exit, error instanceof Error ? error : new Error('An unknown error occurred'))
      })
  }
}
