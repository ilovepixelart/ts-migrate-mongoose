import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { chalk } from './chalk'
import { defaults } from './defaults'
import { config } from './env'
import { Env, Migrator } from './index'
import { loader } from './loader'

import type { ConfigOptions, ConfigOptionsDefault, MigratorOptions } from './types'

const fileExists = async (filePath: string): Promise<boolean> => {
  return fs.promises
    .access(filePath)
    .then(() => true)
    .catch(() => false)
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
    const exists = await fileExists(configFilePath)
    if (exists) {
      return configFilePath
    }
  }

  throw new Error(message)
}

const loadModule = async (configPath: string): Promise<{ default?: ConfigOptionsDefault | ConfigOptions }> => {
  const resolvedConfig = await resolveConfigPath(configPath)
  const fileUrl = pathToFileURL(resolvedConfig).href

  await loader()

  const extension = path.extname(resolvedConfig)
  if (extension === '.ts') {
    return (await import(fileUrl)) as { default?: ConfigOptionsDefault | ConfigOptions }
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
    console.error(chalk.red(error.message))
  }
}

export const getConfig = async (configPath: string, quiet = false): Promise<ConfigOptions> => {
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
      if (!quiet) logError(error)
      configOptions = {}
    }
  }

  return configOptions
}

export const toCamelCase = (str: Env): string => {
  return str.toLocaleLowerCase().replaceAll(/_([a-z])/g, (g) => (g[1] ? g[1].toUpperCase() : ''))
}

export const getEnv = (key: Env): string | undefined => {
  return process.env[key] ?? process.env[toCamelCase(key)]
}

export const getEnvBoolean = (key: Env): boolean | undefined => {
  const value = getEnv(key)
  return value === 'true' ? true : undefined
}

export const getMigrator = async (options: ConfigOptions): Promise<Migrator> => {
  config({ path: '.env', quiet: true })
  config({ path: '.env.local', quiet: true, override: true })

  const mode = options.mode ?? getEnv(Env.MIGRATE_MODE)

  if (mode) {
    config({ path: `.env.${mode}`, quiet: true, override: true })
    config({ path: `.env.${mode}.local`, quiet: true, override: true })
  }

  const configPath = options.configPath ?? getEnv(Env.MIGRATE_CONFIG_PATH) ?? defaults.MIGRATE_CONFIG_PATH
  const isDefaultConfig = configPath === defaults.MIGRATE_CONFIG_PATH

  const fileOptions = await getConfig(configPath, isDefaultConfig)
  const uri = options.uri ?? getEnv(Env.MIGRATE_MONGO_URI) ?? fileOptions.uri
  const connectOptions = fileOptions.connectOptions
  const collection = options.collection ?? getEnv(Env.MIGRATE_MONGO_COLLECTION) ?? fileOptions.collection ?? defaults.MIGRATE_MONGO_COLLECTION
  const migrationsPath = options.migrationsPath ?? getEnv(Env.MIGRATE_MIGRATIONS_PATH) ?? fileOptions.migrationsPath ?? defaults.MIGRATE_MIGRATIONS_PATH
  const templatePath = options.templatePath ?? getEnv(Env.MIGRATE_TEMPLATE_PATH) ?? fileOptions.templatePath
  const autosync = Boolean(options.autosync ?? getEnvBoolean(Env.MIGRATE_AUTOSYNC) ?? fileOptions.autosync ?? defaults.MIGRATE_AUTOSYNC)

  if (!uri) {
    throw new Error('You need to provide the MongoDB Connection URI to persist migration status.\nUse option --uri / -d to provide the URI.')
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

interface OptionDef {
  type: 'string' | 'boolean'
  short?: string
  arg?: string
  description: string
  default?: boolean
}

const commands = [
  { usage: 'list', description: 'list all migrations' },
  { usage: 'create <migration-name>', description: 'create a new migration file' },
  { usage: 'up [migration-name]', description: 'run all migrations or a specific migration if name provided' },
  { usage: 'down <migration-name>', description: 'roll back migrations down to given name' },
  { usage: 'prune', description: 'delete extraneous migrations from migration folder or database' },
]

const optionDefs = {
  'config-path': { type: 'string' as const, short: 'f', arg: '<path>', description: 'path to the config file' },
  uri: { type: 'string' as const, short: 'd', arg: '<string>', description: 'mongo connection string' },
  collection: { type: 'string' as const, short: 'c', arg: '<string>', description: 'collection name to use for the migrations' },
  autosync: { type: 'string' as const, short: 'a', arg: '<boolean>', description: 'automatically sync new migrations without prompt' },
  'migrations-path': { type: 'string' as const, short: 'm', arg: '<path>', description: 'path to the migration files' },
  'template-path': { type: 'string' as const, short: 't', arg: '<path>', description: 'template file to use when creating a migration' },
  mode: { type: 'string' as const, arg: '<string>', description: 'environment mode to use .env.[mode] file' },
  single: { type: 'boolean' as const, short: 's', description: 'run single migration (up/down only)', default: false },
  help: { type: 'boolean' as const, short: 'h', description: 'display help' },
  version: { type: 'boolean' as const, short: 'v', description: 'display version' },
} satisfies Record<string, OptionDef>

const formatHelp = (): string => {
  const lines: string[] = [chalk.cyan('CLI migration tool for mongoose'), '', 'Usage: migrate <command> [options]', '', 'Commands:']

  const cmdPadding = Math.max(...commands.map((c) => c.usage.length)) + 4
  for (const cmd of commands) {
    lines.push(`  ${cmd.usage.padEnd(cmdPadding)}${cmd.description}`)
  }

  lines.push('', 'Options:')

  const optEntries = (Object.entries(optionDefs) as [string, OptionDef][]).map(([name, opt]) => {
    const short = opt.short ? `-${opt.short}, ` : '    '
    const arg = opt.arg ? ' ' + opt.arg : ''
    const long = `--${name}${arg}`
    return { flag: `  ${short}${long}`, description: opt.description }
  })

  const flagPadding = Math.max(...optEntries.map((e) => e.flag.length)) + 4
  for (const entry of optEntries) {
    lines.push(`${entry.flag.padEnd(flagPadding)}${entry.description}`)
  }

  return `${lines.join('\n')}\n`
}

const parseArgsOptions = Object.fromEntries((Object.entries(optionDefs) as [string, OptionDef][]).map(([name, { description, arg, ...rest }]) => [name, rest])) as { [K in keyof typeof optionDefs]: Omit<(typeof optionDefs)[K], 'description' | 'arg'> }

const parseOptions = {
  options: parseArgsOptions,
  allowPositionals: true as const,
}

export class Migrate {
  private migrator!: Migrator
  private parsedOptions: ConfigOptions = {}

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

    return this.parsedOptions
  }

  private parseOptions(values: Record<string, string | boolean | undefined>): ConfigOptions {
    const options: ConfigOptions = {}
    if (values['config-path']) options.configPath = values['config-path'] as string
    if (values.uri) options.uri = values.uri as string
    if (values.collection) options.collection = values.collection as string
    if (values.autosync !== undefined) options.autosync = values.autosync === 'true'
    if (values['migrations-path']) options.migrationsPath = values['migrations-path'] as string
    if (values['template-path']) options.templatePath = values['template-path'] as string
    if (values.mode) options.mode = values.mode as string
    return options
  }

  private async dispatch(command: string, positionals: string[], single?: boolean): Promise<void> {
    switch (command) {
      case 'list': {
        console.log(chalk.cyan('Listing migrations'))
        await this.migrator.list()
        break
      }
      case 'create': {
        const migrationName = positionals[1]
        if (!migrationName) throw new Error('Migration name is required for create command')
        await this.migrator.create(migrationName)
        const migrateUp = chalk.cyan(`migrate up ${migrationName}`)
        console.log(`Migration created. Run ${migrateUp} to apply the migration`)
        break
      }
      case 'up': {
        await this.migrator.run('up', positionals[1], single)
        break
      }
      case 'down': {
        const migrationName = positionals[1]
        if (!migrationName) throw new Error('Migration name is required for down command')
        await this.migrator.run('down', migrationName, single)
        break
      }
      case 'prune': {
        await this.migrator.prune()
        break
      }
      default: {
        console.error(formatHelp())
        throw new Error(`Unknown command: ${command}`)
      }
    }
  }

  public async run(exit = true): Promise<ConfigOptions> {
    try {
      const args = process.argv.slice(2)
      const { values, positionals } = parseArgs({ ...parseOptions, args })

      if (values.version) {
        const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
        console.log(pkg.version)
        return await this.finish(exit)
      }

      const command = positionals[0]

      if (values.help || !command) {
        console.log(formatHelp())
        return await this.finish(exit)
      }

      if (values.single && command !== 'up' && command !== 'down') {
        throw new Error(`Option --single is only valid for 'up' and 'down' commands`)
      }

      this.parsedOptions = this.parseOptions(values)
      this.migrator = await getMigrator(this.parsedOptions)
      await this.dispatch(command, positionals, values.single)

      return await this.finish(exit)
    } catch (error: unknown) {
      return await this.finish(exit, error instanceof Error ? error : new Error('An unknown error occurred'))
    }
  }
}
