// Checks the last e2e mutation run (reports/mutation/e2e.json) against tests/mutation/equivalent-e2e.json: the mutants
// no behaviour observable through the package can kill, each with the reason. Fails on a survivor that is not listed (a
// gap in the suite) and on a listed mutant the run killed (the reason no longer holds). With `all`, a mutant survives
// only if it survives the unit run (reports/mutation/unit.json) too, so the check is that every mutant the suites
// together miss is listed; the unit suite killing a listed mutant does not make its reason wrong.
// A mutant is identified by its file, mutator, replacement and the trimmed source line it mutates, so the list
// survives edits that only move lines. Mutants that share all four (identical lines, or two on one line) are told apart
// by occurrence: 1 for the first in source order, the default, 2 for the next. Listed mutants a --mutate scoped run did
// not include are not checked.
//
// Usage: tsx tests/mutation/survivors.ts e2e|all
import fs from 'node:fs'
import path from 'node:path'

interface Mutant {
  mutatorName: string
  replacement: string
  status: string
  statusReason?: string
  location: { start: { line: number; column: number } }
}

interface Report {
  files: Record<string, { source: string; mutants: Mutant[] }>
}

interface Equivalent {
  file: string
  mutator: string
  replacement: string
  line: string
  occurrence?: number
  reason: string
}

interface Outcome {
  where: string
  status: string
  survived: boolean
  // Counted as killed by the e2e run without a scenario that differed: the harness failed, so nothing was verified.
  unverified: boolean
}

const mode = process.argv[2]
if (mode !== 'e2e' && mode !== 'all') throw new Error('Usage: tsx tests/mutation/survivors.ts e2e|all')

const root = path.resolve(import.meta.dirname, '../..')
const listFile = path.join(import.meta.dirname, 'equivalent-e2e.json')
const equivalents = JSON.parse(fs.readFileSync(listFile, 'utf8')) as Equivalent[]

const baseKeyOf = (entry: Omit<Equivalent, 'reason' | 'occurrence'>): string => [entry.file, entry.mutator, entry.replacement, entry.line].join('\u0000')
const keyOf = (entry: Omit<Equivalent, 'reason'>): string => `${baseKeyOf(entry)}\u0000${String(entry.occurrence ?? 1)}`
const listed = new Set(equivalents.map(keyOf))
if (listed.size !== equivalents.length) throw new Error(`${path.basename(listFile)} lists a mutant twice; number the next one with occurrence`)

const outcomesOf = (suite: string): Map<string, Outcome> => {
  const report = JSON.parse(fs.readFileSync(path.join(root, `reports/mutation/${suite}.json`), 'utf8')) as Report
  const outcomes = new Map<string, Outcome>()
  for (const [file, { source, mutants }] of Object.entries(report.files)) {
    const lines = source.split('\n')
    const relative = path.relative(root, path.resolve(root, file))
    const seen = new Map<string, number>()
    const inSourceOrder = [...mutants].sort((a, b) => a.location.start.line - b.location.start.line || a.location.start.column - b.location.start.column)
    for (const mutant of inSourceOrder) {
      const line = (lines[mutant.location.start.line - 1] ?? '').trim()
      const base = baseKeyOf({ file: relative, mutator: mutant.mutatorName, replacement: mutant.replacement, line })
      const occurrence = (seen.get(base) ?? 0) + 1
      seen.set(base, occurrence)
      // A mutant no test reaches survives too.
      const survived = mutant.status === 'Survived' || mutant.status === 'NoCoverage'
      const where = `${relative}:${String(mutant.location.start.line)} ${mutant.mutatorName} -> ${mutant.replacement}`
      const unverified = suite === 'e2e' && mutant.status === 'Killed' && !/^killed by \S+$/.test((mutant.statusReason ?? '').trim().split('\n').at(-1) ?? '')
      outcomes.set(keyOf({ file: relative, mutator: mutant.mutatorName, replacement: mutant.replacement, line, occurrence }), { where, status: mutant.status, survived, unverified })
    }
  }
  return outcomes
}

const outcomes = outcomesOf('e2e')
if (mode === 'all') {
  for (const [key, unit] of outcomesOf('unit')) {
    const e2e = outcomes.get(key)
    if (e2e && !unit.survived) outcomes.set(key, { ...e2e, survived: false, unverified: false })
  }
}

const unlisted: string[] = []
const killed: string[] = []
const unverified: string[] = []
for (const [key, { where, status, survived, unverified: harnessFailed }] of outcomes) {
  if (harnessFailed) unverified.push(where)
  if (survived && !listed.has(key)) unlisted.push(`${where} (${status})`)
  if (mode === 'e2e' && !survived && listed.has(key)) killed.push(`${where} (${status})`)
}

for (const where of unlisted) console.error(`survived, not listed as equivalent: ${where}`)
for (const where of killed) console.error(`listed as equivalent, but ${where}`)
for (const where of unverified) console.error(`killed by a harness failure, not a scenario; rerun it with --mutate: ${where}`)
if (unlisted.length || killed.length || unverified.length) process.exit(1)
const scope = mode === 'all' ? 'the unit and e2e runs both miss' : 'survives the e2e run'
console.log(`Every mutant that ${scope} is listed in ${path.relative(root, listFile)} (${String(equivalents.length)} entries).`)
