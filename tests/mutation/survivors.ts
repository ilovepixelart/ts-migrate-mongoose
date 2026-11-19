// Checks the last mutation run of a suite (reports/mutation/<suite>.json) against tests/mutation/equivalent-<suite>.json:
// the mutants the suite cannot kill because no behaviour it can observe changes, each with the reason. Fails on a
// survivor that is not listed (a gap in the suite) and on a listed mutant the run killed (the reason no longer holds).
// A mutant is identified by its file, mutator, replacement and the trimmed source line it mutates, so the list
// survives edits that only move lines. Mutants that share all four (identical lines, or two on one line) are told apart
// by occurrence: 1 for the first in source order, the default, 2 for the next. Listed mutants a --mutate scoped run did
// not include are not checked.
//
// Usage: tsx tests/mutation/survivors.ts e2e|unit
import fs from 'node:fs'
import path from 'node:path'

interface Mutant {
  mutatorName: string
  replacement: string
  status: string
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

const suite = process.argv[2]
if (suite !== 'e2e' && suite !== 'unit') throw new Error('Usage: tsx tests/mutation/survivors.ts e2e|unit')

const root = path.resolve(import.meta.dirname, '../..')
const listFile = path.join(import.meta.dirname, `equivalent-${suite}.json`)
const report = JSON.parse(fs.readFileSync(path.join(root, `reports/mutation/${suite}.json`), 'utf8')) as Report
const equivalents = JSON.parse(fs.readFileSync(listFile, 'utf8')) as Equivalent[]

const baseKeyOf = (entry: Omit<Equivalent, 'reason' | 'occurrence'>): string => [entry.file, entry.mutator, entry.replacement, entry.line].join('\u0000')
const keyOf = (entry: Omit<Equivalent, 'reason'>): string => `${baseKeyOf(entry)}\u0000${String(entry.occurrence ?? 1)}`
const listed = new Set(equivalents.map(keyOf))
if (listed.size !== equivalents.length) throw new Error(`${path.basename(listFile)} lists a mutant twice; number the next one with occurrence`)

const unlisted: string[] = []
const killed: string[] = []
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
    const key = keyOf({ file: relative, mutator: mutant.mutatorName, replacement: mutant.replacement, line, occurrence })
    const where = `${relative}:${String(mutant.location.start.line)} ${mutant.mutatorName} -> ${mutant.replacement}`
    // A mutant no test reaches survives too.
    const survived = mutant.status === 'Survived' || mutant.status === 'NoCoverage'
    if (survived && !listed.has(key)) unlisted.push(`${where} (${mutant.status})`)
    if (!survived && listed.has(key)) killed.push(`${where} (${mutant.status})`)
  }
}

for (const where of unlisted) console.error(`survived, not listed as equivalent: ${where}`)
for (const where of killed) console.error(`listed as equivalent, but ${where}`)
if (unlisted.length || killed.length) process.exit(1)
console.log(`Every surviving mutant is listed in ${path.relative(root, listFile)} (${String(equivalents.length)} entries).`)
