import { artifactScenarios } from './artifact'
import { commandScenarios } from './commands'
import { configurationScenarios } from './configuration'
import { libraryScenarios } from './library'

import type { Scenario } from '../harness'

export const scenarios: Scenario[] = [...commandScenarios, ...configurationScenarios, ...libraryScenarios, ...artifactScenarios]
