import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

export const repoRoot = path.resolve(import.meta.dirname, '../..')
export const fixturesDir = path.join(import.meta.dirname, 'fixtures')

export const PACKAGE_NAME = 'ts-migrate-mongoose'
const PROCESS_TIMEOUT_MS = 60_000
// The checkbox prompt's hint line closes every frame it renders.
const PROMPT_MARKER = 'enter submit'

export interface RunResult {
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  elapsedMs: number
}

export interface Step {
  command: string
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut?: true
  aliveAfterSignal?: true
}

export interface Consumer {
  dir: string
  bin: string
  version: string
}

export type Observation = Record<string, unknown>

export interface ScenarioContext {
  consumer: Consumer
  dir: string
  uri: string
  closedUri: string
  cli: (args: string[], options?: { env?: Record<string, string>; cwd?: string }) => Promise<Step>
  node: (script: string, args: string[]) => Promise<RunResult>
  tty: (args: string[], keys: string[], options?: { rows?: number; env?: Record<string, string>; cwd?: string }) => Promise<Step>
  write: (relative: string, content: string) => void
  remove: (relative: string) => void
  tree: () => Record<string, string | null>
  db: () => Promise<Record<string, unknown[]>>
}

export interface Scenario {
  name: string
  run: (context: ScenarioContext) => Promise<Observation>
}

export const lockVersion = (name: string): string => {
  const lock = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf8')) as { packages: Record<string, { version?: string }> }
  const version = lock.packages[`node_modules/${name}`]?.version
  if (!version) throw new Error(`${name} is not in package-lock.json`)
  return version
}

// The children must see only the variables a scenario sets, never the developer's own MIGRATE_* values.
const cleanEnv = (extra: Record<string, string> = {}): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (!/^MIGRATE_/.test(key) && !/^migrate[A-Z]/.test(key)) env[key] = value
  }
  return { ...env, ...extra }
}

export const runProcess = (command: string, args: string[], options: { cwd: string; env?: Record<string, string> }): Promise<RunResult> => {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const child = spawn(command, args, { cwd: options.cwd, env: cleanEnv(options.env), stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk
    })
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, PROCESS_TIMEOUT_MS)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (exitCode) => {
      clearTimeout(timer)
      resolve({ exitCode, stdout, stderr, timedOut, elapsedMs: Date.now() - started })
    })
  })
}

const npm = (args: string[], cwd: string): string => {
  const result = spawnSync('npm', args, { cwd, encoding: 'utf8', env: cleanEnv() })
  if (result.status !== 0) {
    throw new Error(`npm ${args.join(' ')} failed in ${cwd}:\n${result.stdout}\n${result.stderr}`)
  }
  return result.stdout
}

export const pack = (destination: string): string => {
  const output = npm(['pack', '--silent', '--pack-destination', destination], repoRoot).trim().split('\n')
  const file = output.at(-1)
  if (!file) throw new Error('npm pack printed no file name')
  return path.join(destination, file)
}

export const installConsumer = (root: string, spec: string, mongooseVersion: string): Consumer => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(root, 'consumer-')))
  fs.writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify({ name: 'e2e-consumer', version: '1.0.0', private: true }, null, 2)}\n`)
  const peers = ['@nestjs/common', '@nestjs/core', 'reflect-metadata', 'rxjs'].map((name) => `${name}@${lockVersion(name)}`)
  npm(['install', '--ignore-scripts', '--no-audit', '--no-fund', '--loglevel=error', spec, `mongoose@${mongooseVersion}`, ...peers], dir)
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'node_modules', PACKAGE_NAME, 'package.json'), 'utf8')) as { version: string }
  return { dir, bin: path.join(dir, 'node_modules', '.bin', 'migrate'), version: manifest.version }
}

export const startMongo = async (): Promise<{ uri: string; stop: () => Promise<void> }> => {
  const server = await MongoMemoryServer.create()
  return { uri: server.getUri(), stop: async () => void (await server.stop({ doCleanup: true, force: true })) }
}

export const closedPort = async (): Promise<number> => {
  const server = net.createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  if (!address || typeof address === 'string') throw new Error('Could not reserve a port')
  return address.port
}

const walk = (root: string, relative = ''): Record<string, string | null> => {
  const entries: Record<string, string | null> = {}
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const rel = relative ? `${relative}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      entries[`${rel}/`] = null
      Object.assign(entries, walk(root, rel))
    } else {
      entries[rel] = fs.readFileSync(path.join(root, rel), 'utf8')
    }
  }
  return entries
}

export const tree = (root: string): Record<string, string | null> => {
  const entries = walk(root)
  return Object.fromEntries(
    Object.keys(entries)
      .sort()
      .map((key) => [key, entries[key] ?? null]),
  )
}

const normalizeValue = (value: unknown): unknown => {
  if (value instanceof Date) return '<date>'
  if (Array.isArray(value)) return value.map(normalizeValue)
  if (value && typeof value === 'object') {
    if ((value as { _bsontype?: string })._bsontype === 'ObjectId') return '<id>'
    const record = value as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, normalizeValue(record[key])]),
    )
  }
  return value
}

export const snapshotDb = async (uri: string): Promise<Record<string, unknown[]>> => {
  const connection = await mongoose.createConnection(uri).asPromise()
  try {
    const db = connection.db
    if (!db) throw new Error('No database handle')
    const names = (await db.listCollections().toArray()).map((collection) => collection.name).sort()
    const snapshot: Record<string, unknown[]> = {}
    for (const name of names) {
      const docs = await db.collection(name).find().toArray()
      // mongoose creates collections in the background; whether an empty one exists when a process exits is a race.
      if (!docs.length) continue
      snapshot[name] = docs.map(normalizeValue).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    }
    return snapshot
  } finally {
    await connection.close()
  }
}

type Replacement = [RegExp, string]

export const createNormalizer = (replacements: Replacement[]): ((value: unknown) => unknown) => {
  const normalize = (value: unknown): unknown => {
    if (typeof value === 'string') return replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value)
    if (Array.isArray(value)) return value.map(normalize)
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [normalize(key), normalize(entry)]))
    }
    return value
  }
  return normalize
}

export const escapeRegExp = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)

// Runs worker over items with at most size in flight; once stop() returns true no further item starts, and results stay sparse.
export const pool = async <T, R>(items: T[], size: number, worker: (item: T) => Promise<R>, stop: () => boolean = () => false): Promise<R[]> => {
  const results: R[] = new Array(items.length)
  let next = 0
  const lanes = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length && !stop()) {
      const index = next++
      results[index] = await worker(items[index] as T)
    }
  })
  await Promise.all(lanes)
  return results
}

// sync() reports files in readdir order, which depends on the file system (ext4, tmpfs and APFS differ).
const sortSyncReport = (stdout: string): string => {
  const lines = stdout.split('\n')
  const isSync = (line: string): boolean => stripVTControlCharacters(line).startsWith('Adding migration ')
  const sorted = lines.filter(isSync).sort()
  return lines.map((line) => (isSync(line) ? (sorted.shift() ?? line) : line)).join('\n')
}

export const createContext = (consumer: Consumer, scenario: string, mongoUri: string, closedUri: string): ScenarioContext => {
  const dir = path.join(consumer.dir, 'work', scenario)
  fs.mkdirSync(dir, { recursive: true })
  const uri = `${mongoUri}${scenario.replaceAll('-', '_')}`
  return {
    consumer,
    dir,
    uri,
    closedUri,
    cli: async (args, options = {}) => {
      const result = await runProcess(consumer.bin, args, { cwd: options.cwd ? path.join(dir, options.cwd) : dir, env: options.env ?? {} })
      const step: Step = { command: ['migrate', ...args].join(' '), exitCode: result.exitCode, stdout: sortSyncReport(result.stdout), stderr: result.stderr }
      if (result.timedOut) step.timedOut = true
      return step
    },
    node: (script, args) => runProcess(process.execPath, [script, ...args], { cwd: dir }),
    tty: async (args, keys, options = {}) => {
      const env = { ...options.env, PTY_ROWS: String(options.rows ?? 24) }
      const cwd = options.cwd ? path.join(dir, options.cwd) : dir
      const result = await runProcess('python3', [path.join(fixturesDir, 'pty_drive.py'), JSON.stringify(keys), PROMPT_MARKER, consumer.bin, ...args], { cwd, env })
      if (result.exitCode !== 0) throw new Error(`pty_drive.py failed (${String(result.exitCode)}): ${result.stderr}`)
      const driven = JSON.parse(result.stdout) as { exitCode: number | null; output: string; timedOut: boolean; aliveAfterSignal: boolean }
      // A terminal merges stdout and stderr into one stream, escape codes included.
      const step: Step = { command: ['migrate', ...args].join(' '), exitCode: driven.exitCode, stdout: driven.output, stderr: '' }
      if (driven.timedOut) step.timedOut = true
      if (driven.aliveAfterSignal) step.aliveAfterSignal = true
      return step
    },
    write: (relative, content) => {
      const file = path.join(dir, relative)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, content)
    },
    remove: (relative) => fs.rmSync(path.join(dir, relative), { recursive: true, force: true }),
    tree: () => tree(dir),
    db: () => snapshotDb(uri),
  }
}
