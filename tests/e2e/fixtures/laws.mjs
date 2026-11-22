// Laws checked against the installed package: the proven migration model (tests/laws/model.mjs) on random command
// sequences, and Migrator.create against the proven name validator. Seeds are fixed so the baseline and the candidate
// see the same sequences and names. fast-check and the laws come from the repository, the Migrator from the package.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Migrator } from 'ts-migrate-mongoose'

const [resultPath, optionsJson] = process.argv.slice(2)
const { uri, repoRoot } = JSON.parse(optionsJson)
const fromRepo = (relative) => import(pathToFileURL(path.join(repoRoot, relative)).href)
const { default: fc } = await fromRepo('node_modules/fast-check/lib/fast-check.js')
const { checkAgainstModel, singleRerun } = await fromRepo('tests/laws/model.mjs')
const { default: Name } = await fromRepo('tests/laws/names/main.mjs')

const connect = (options) => Migrator.connect({ uri, autosync: true, ...options })
const out = {}

try {
  out.modelRuns = await checkAgainstModel(fc, connect, { numRuns: 25, seed: 42 })
} catch (error) {
  out.modelFailure = String(error.message).split('\n').slice(0, 12).join('\n')
}
out.singleRerun = await singleRerun(connect)

// The allowed alphabet plus the characters that matter for path safety, in runs, and arbitrary strings.
const nameArb = fc.oneof(
  fc.array(fc.constantFrom('a', 'Z', '0', '_', '-', '.', '..', '/', '\\', ' ', 'é', '\u0000'), { maxLength: 12 }).map((parts) => parts.join('')),
  fc.string({ unit: 'binary', maxLength: 20 }),
)
const names = [...new Set(fc.sample(nameArb, { numRuns: 300, seed: 7 }))]
const dir = mkdtempSync(path.join(os.tmpdir(), 'tmm-names-'))
const creator = await Migrator.connect({ uri, migrationsPath: dir, collection: 'names', autosync: true })
const mismatches = []
let accepted = 0
for (const name of names) {
  const created = await creator.create(name).then(
    () => true,
    () => false,
  )
  if (created) accepted++
  if (created !== Name.valid(name)) mismatches.push(name)
}
await creator.connection.db.dropDatabase()
await creator.close()
rmSync(dir, { recursive: true, force: true })
out.names = { checked: names.length, accepted, mismatches }

writeFileSync(resultPath, JSON.stringify(out))
