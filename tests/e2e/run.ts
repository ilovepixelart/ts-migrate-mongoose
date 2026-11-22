import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { installConsumer, lockVersion, pack, repoRoot } from './harness'
import { observe } from './observe'

import type { Observation } from './harness'

interface Allowlist {
  baseline: string
}

// Usage: npm run test:e2e
//   E2E_CANDIDATE  package spec under test (tarball path or name@version); default: npm pack of this checkout
//   E2E_BASELINE   package spec to compare against; default: the baseline version in tests/e2e/allowlist.json
//   E2E_MONGOOSE   mongoose version installed in the consumer; default: the version in package-lock.json

const collect = async (root: string, label: string, spec: string, mongooseVersion: string): Promise<Record<string, Observation>> => {
  console.log(`[e2e] ${label}: installing ${spec} with mongoose@${mongooseVersion}`)
  const consumer = installConsumer(root, spec, mongooseVersion)
  try {
    const started = Date.now()
    const observations = await observe(consumer)
    console.log(`[e2e] ${label}: ${Object.keys(observations).length.toString()} scenarios in ${((Date.now() - started) / 1000).toFixed(1)}s`)
    return observations
  } finally {
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
      env: { ...process.env, E2E_OBSERVATIONS: outDir, E2E_CANDIDATE_SPEC: candidate, E2E_BASELINE_SPEC: baseline, E2E_MONGOOSE_VERSION: mongooseVersion },
    })
    return vitest.status ?? 1
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

process.exitCode = await main()
