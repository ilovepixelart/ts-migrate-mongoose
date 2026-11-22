import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { installConsumer, lockVersion, PACKAGE_NAME, pack } from './harness'
import { observe } from './observe'

import type { Consumer, Observation } from './harness'

// The e2e suite as a Stryker command runner (npm run test:mutation:e2e). Stryker instruments src/ once and
// switches mutants through __STRYKER_ACTIVE_MUTANT__, which every spawned process inherits.
//   prepare  build and pack the instrumented package and install it once
//   run      clone that install and run the scenarios. With no mutant active (Stryker's initial dry run) it records
//            the observations as the reference; with a mutant active it exits 1 on the first one that differs.
//            The reference is recorded in the dry run, not in prepare, because Stryker's build step does not see the
//            sandbox the way its test runs do.
// The reference is this build, not the published baseline, so allowlisted changes do not count as kills.
// Any observable difference kills: a contract test can only fail where an observation differs.

const STATE = path.resolve('.stryker-e2e')
const TEMPLATE = path.join(STATE, 'consumer')
const REFERENCE = path.join(STATE, 'reference.json')

const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, entry: unknown) =>
    entry && typeof entry === 'object' && !Array.isArray(entry)
      ? Object.fromEntries(
          Object.keys(entry)
            .sort()
            .map((key) => [key, (entry as Record<string, unknown>)[key]]),
        )
      : entry,
  )

const run = (command: string, args: string[]): void => {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited with ${String(result.status)}`)
}

const prepare = async (): Promise<void> => {
  fs.rmSync(STATE, { recursive: true, force: true })
  fs.mkdirSync(STATE)
  run('npm', ['run', 'build'])
  const candidate = installConsumer(STATE, pack(STATE), lockVersion('mongoose'))
  fs.renameSync(candidate.dir, TEMPLATE)
}

// Copy-on-write where the file system supports it, a plain copy elsewhere.
const cloneTemplate = (): Consumer => {
  const dir = path.join(fs.realpathSync(os.tmpdir()), `tmm-mutant-${process.pid.toString()}-${Date.now().toString()}`)
  fs.cpSync(TEMPLATE, dir, { recursive: true, verbatimSymlinks: true, mode: fs.constants.COPYFILE_FICLONE })
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'node_modules', PACKAGE_NAME, 'package.json'), 'utf8')) as { version: string }
  return { dir, bin: path.join(dir, 'node_modules', '.bin', 'migrate'), version: manifest.version }
}

const recordKill = (name: string, observation: Observation, reference: unknown): void => {
  const dir = process.env.MUTANT_KILLS_DIR
  if (!dir) return
  fs.mkdirSync(dir, { recursive: true })
  const mutant = process.env.__STRYKER_ACTIVE_MUTANT__ ?? 'none'
  fs.writeFileSync(path.join(dir, `${mutant}.json`), `${JSON.stringify({ scenario: name, observed: observation, reference }, null, 1)}\n`)
}

const recordReference = async (): Promise<number> => {
  const consumer = cloneTemplate()
  try {
    fs.writeFileSync(REFERENCE, `${JSON.stringify(await observe(consumer), null, 2)}\n`)
  } finally {
    fs.rmSync(consumer.dir, { recursive: true, force: true })
  }
  return 0
}

const runMutant = async (): Promise<number> => {
  if (!fs.existsSync(REFERENCE)) throw new Error(`No reference at ${REFERENCE}: the dry run with no active mutant records it`)
  const reference = JSON.parse(fs.readFileSync(REFERENCE, 'utf8')) as Record<string, Observation>
  const consumer = cloneTemplate()
  let killedBy: string | undefined
  let harnessFailed = false
  try {
    await observe(consumer, (name, observation) => {
      if (killedBy || canonical(observation) === canonical(reference[name])) return false
      killedBy = name
      harnessFailed = 'harnessError' in observation
      recordKill(name, observation, reference[name])
      return true
    })
  } catch (error) {
    // A scenario that differed decides the verdict; MongoDB failing to stop afterwards does not undo it. Any other
    // error is the harness failing, and Stryker counts that exit as a kill, which the survivors check refuses.
    if (!killedBy) throw error
  } finally {
    fs.rmSync(consumer.dir, { recursive: true, force: true })
  }
  if (!killedBy) {
    console.log('survived')
    return 0
  }
  // A scenario the harness itself failed in (pty driver, database snapshot) is not evidence the mutant changed
  // anything; the survivors check refuses this line as a kill and asks for a rerun.
  console.log(harnessFailed ? `harness error in ${killedBy}` : `killed by ${killedBy}`)
  return 1
}

const [mode] = process.argv.slice(2)
if (mode === 'prepare') await prepare()
else if (mode === 'run') process.exitCode = process.env.__STRYKER_ACTIVE_MUTANT__ ? await runMutant() : await recordReference()
else throw new Error(`Unknown mode '${String(mode)}': use prepare or run`)
