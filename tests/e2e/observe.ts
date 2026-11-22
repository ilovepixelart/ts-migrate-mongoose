import { closedPort, createContext, createNormalizer, escapeRegExp, pool, startMongo } from './harness'
import { scenarios } from './scenarios/index'

import type { Consumer, Observation } from './harness'

const CONCURRENCY = 4

// Runs every scenario against an installed consumer and returns the normalized observations by scenario name.
// stopWhen ends the run early: no scenario starts after it returns true (the mutation runner stops at the first difference).
export const observe = async (consumer: Consumer, stopWhen: (name: string, observation: Observation) => boolean = () => false): Promise<Record<string, Observation>> => {
  const mongo = await startMongo()
  const port = await closedPort()
  const closedUri = `mongodb://127.0.0.1:${port.toString()}/e2e`
  const normalize = createNormalizer([
    [new RegExp(escapeRegExp(consumer.dir), 'g'), '<consumer>'],
    [new RegExp(escapeRegExp(mongo.uri), 'g'), '<mongo>/'],
    [new RegExp(`127\\.0\\.0\\.1:${port.toString()}\\b`, 'g'), '127.0.0.1:<closed-port>'],
    // Not \b: a colour code such as \x1b[36m can sit right before a timestamp.
    [/(?<!\d)\d{13}(?!\d)/g, '<timestamp>'],
    [new RegExp(`(^|"|\\n)${escapeRegExp(consumer.version)}(?=\\n|"|$)`, 'g'), '$1<version>'],
  ])
  let stopped = false
  try {
    const observations = await pool(
      scenarios,
      CONCURRENCY,
      async (scenario) => {
        const context = createContext(consumer, scenario.name, mongo.uri, closedUri)
        let observation: Observation
        try {
          observation = normalize(await scenario.run(context)) as Observation
        } catch (error) {
          observation = { harnessError: normalize(error instanceof Error ? (error.stack ?? error.message) : String(error)) }
        }
        if (stopWhen(scenario.name, observation)) stopped = true
        return [scenario.name, observation] as const
      },
      () => stopped,
    )
    return Object.fromEntries(observations.filter(Boolean))
  } finally {
    await mongo.stop()
  }
}
