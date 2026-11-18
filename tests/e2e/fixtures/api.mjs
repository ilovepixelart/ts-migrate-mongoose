import { writeFileSync } from 'node:fs'
import * as tmm from 'ts-migrate-mongoose'
import scenario from './api-scenario.cjs'

const [resultPath, options] = process.argv.slice(2)
writeFileSync(resultPath, JSON.stringify(await scenario(tmm, JSON.parse(options))))
