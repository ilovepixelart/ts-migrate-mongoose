import { describe, expect, it } from 'vitest'

import fs from 'node:fs'
import path from 'node:path'

const observationsDir = process.env.E2E_OBSERVATIONS
if (!observationsDir) throw new Error('E2E_OBSERVATIONS is not set: run the suite with `npm run test:e2e`')

interface Change {
  path: string
  pr: number
  reason: string
  // The mongoose major versions the change shows on; every version when left out.
  mongoose?: number[]
}

interface Difference {
  path: string
  baseline: unknown
  candidate: unknown
}

const mongooseMajor = Number(process.env.E2E_MONGOOSE_VERSION?.split('.')[0])
if (!Number.isInteger(mongooseMajor)) throw new Error('E2E_MONGOOSE_VERSION is not set: run the suite with `npm run test:e2e`')

const load = (label: string): unknown => JSON.parse(fs.readFileSync(path.join(observationsDir, `${label}.json`), 'utf8'))
const allowlist = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'allowlist.json'), 'utf8')) as { baseline: string; changes: Change[] }
const changes = allowlist.changes.filter((change) => !change.mongoose || change.mongoose.includes(mongooseMajor))

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const differences = (baseline: unknown, candidate: unknown, at = ''): Difference[] => {
  if (JSON.stringify(baseline) === JSON.stringify(candidate)) return []
  if (isRecord(baseline) && isRecord(candidate) && Array.isArray(baseline) === Array.isArray(candidate)) {
    const keys = [...new Set([...Object.keys(baseline), ...Object.keys(candidate)])]
    return keys.flatMap((key) => differences(baseline[key], candidate[key], `${at}/${key}`))
  }
  return [{ path: at, baseline, candidate }]
}

describe(`differential against ts-migrate-mongoose@${allowlist.baseline}`, () => {
  const found = differences(load('baseline'), load('candidate'))
  const allowed = new Set(changes.map((change) => change.path))

  it('matches the published baseline except for allowlisted changes', () => {
    expect(found.filter((difference) => !allowed.has(difference.path))).toEqual([])
  })

  it('has no allowlist entry that no longer matches a difference', () => {
    const paths = new Set(found.map((difference) => difference.path))
    expect(changes.filter((change) => !paths.has(change.path))).toEqual([])
  })

  it('names the pull request and reason for every allowlisted change', () => {
    expect(allowlist.changes.filter((change) => !(Number.isInteger(change.pr) && change.pr > 0 && change.reason.length > 0))).toEqual([])
  })
})
