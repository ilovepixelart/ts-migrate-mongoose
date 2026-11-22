import { describe, expect, it } from 'vitest'

import fs from 'node:fs'
import path from 'node:path'
import { readmeHelp, scenario, scenarioNames } from './observations'

// The documented surface is the inventory: README help (pinned to the real binary by the help contract) and the Env enum the
// package exports. Anything listed there without a scenario exercising it fails here, before it can regress unnoticed.

const help = readmeHelp()
const section = (title: string): string[] => help.split(`${title}:\n`)[1]?.split('\n\n')[0]?.split('\n') ?? []
const documentedCommands = section('Commands').map((line) => line.trim().split(' ')[0] ?? '')
const documentedFlags = section('Options').flatMap((line) => [...line.matchAll(/(?:^|\s)(--?[a-z][a-z-]*)/g)].map((match) => match[1] ?? ''))

const invoked = scenarioNames().flatMap((name) => (scenario(name).steps ?? []).map((step) => step.command.split(' ').slice(1)))
const sources = (dir: string): string[] => fs.readdirSync(dir).map((file) => fs.readFileSync(path.join(dir, file), 'utf8'))
const scenarioSources = [...sources(path.join(import.meta.dirname, '..', 'scenarios')), ...sources(path.join(import.meta.dirname, '..', 'fixtures'))].join('\n')

describe('documented surface inventory', () => {
  it('reads a non-trivial inventory from the README', () => {
    expect(documentedCommands).toEqual(['list', 'create', 'up', 'down', 'prune'])
    expect(documentedFlags).toHaveLength(19)
  })

  it.each(documentedCommands)('runs the %s command in at least one scenario', (command) => {
    expect(invoked.some((args) => args[0] === command)).toBe(true)
  })

  it.each(documentedFlags)('passes %s in at least one scenario', (flag) => {
    expect(invoked.some((args) => args.includes(flag))).toBe(true)
  })

  it.each(Object.keys((scenario('api-esm').result as { env: Record<string, string> }).env))('sets %s in at least one scenario', (key) => {
    expect(scenarioSources).toMatch(new RegExp(`\\b${key}\\b`))
  })
})
