import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closedPort, createContext, createNormalizer, escapeRegExp, installConsumer, lockVersion, pack, pool, repoRoot, startMongo } from './harness'
import { scenarios } from './scenarios'

import type { Observation } from './harness'

// Usage: npm run test:e2e
//   E2E_CANDIDATE  package spec under test (tarball path or name@version); default: npm pack of this checkout
//   E2E_BASELINE   package spec to compare against; default: the baseline version in tests/e2e/allowlist.json
//   E2E_MONGOOSE   mongoose version installed in the consumer; default: the version in package-lock.json

const CONCURRENCY = 4

interface Allowlist {
  baseline: string
}

const collect = async (root: string, label: string, spec: string, mongooseVersion: string): Promise<Record<string, Observation>> => {
  console.log(`[e2e] ${label}: installing ${spec} with mongoose@${mongooseVersion}`)
  const consumer = installConsumer(root, spec, mongooseVersion)
  const mongo = await startMongo()
  const port = await closedPort()
  const closedUri = `mongodb://127.0.0.1:${port.toString()}/e2e`
  const normalize = createNormalizer([
    [new RegExp(escapeRegExp(consumer.dir), 'g'), '<consumer>'],
    [new RegExp(escapeRegExp(mongo.uri), 'g'), '<mongo>/'],
    [new RegExp(`127\\.0\\.0\\.1:${port.toString()}\\b`, 'g'), '127.0.0.1:<closed-port>'],
    [/\b\d{13}\b/g, '<timestamp>'],
    [new RegExp(`(^|"|\\n)${escapeRegExp(consumer.version)}(?=\\n|"|$)`, 'g'), '$1<version>'],
  ])
  try {
    const started = Date.now()
    const observations = await pool(scenarios, CONCURRENCY, async (scenario) => {
      const context = createContext(consumer, scenario.name, mongo.uri, closedUri)
      try {
        return [scenario.name, normalize(await scenario.run(context))] as const
      } catch (error) {
        return [scenario.name, { harnessError: normalize(error instanceof Error ? (error.stack ?? error.message) : String(error)) }] as const
      }
    })
    console.log(`[e2e] ${label}: ${scenarios.length.toString()} scenarios in ${((Date.now() - started) / 1000).toFixed(1)}s`)
    return Object.fromEntries(observations) as Record<string, Observation>
  } finally {
    await mongo.stop()
    fs.rmSync(consumer.dir, { recursive: true, force: true })
  }
}

const main = async (): Promise<number> => {
  const allowlist = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'allowlist.json'), 'utf8')) as Allowlist
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tmm-e2e-')))
  try {
    const candidate = process.env.E2E_CANDIDATE ?? pack(root)
    const baseline = process.env.E2E_BASELINE ?? `ts-migrate-mongoose@${allowlist.baseline}`
    const mongooseVersion = process.env.E2E_MONGOOSE ?? lockVersion('mongoose')
    const outDir = path.join(root, 'observations')
    fs.mkdirSync(outDir)
    for (const [label, spec] of [
      ['baseline', baseline],
      ['candidate', candidate],
    ] as const) {
      fs.writeFileSync(path.join(outDir, `${label}.json`), `${JSON.stringify(await collect(root, label, spec, mongooseVersion), null, 2)}\n`)
    }
    if (process.env.E2E_KEEP_OBSERVATIONS) fs.cpSync(outDir, process.env.E2E_KEEP_OBSERVATIONS, { recursive: true })
    const vitest = spawnSync(process.execPath, [path.join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs'), 'run', '--config', 'vitest.e2e.config.mts'], {
      cwd: repoRoot,
      stdio: 'inherit',
      env: { ...process.env, E2E_OBSERVATIONS: outDir, E2E_CANDIDATE_SPEC: candidate, E2E_BASELINE_SPEC: baseline },
    })
    return vitest.status ?? 1
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

process.exitCode = await main()
