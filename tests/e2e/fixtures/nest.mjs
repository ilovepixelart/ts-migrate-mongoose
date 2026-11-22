import { writeFileSync } from 'node:fs'
import * as core from '@nestjs/core'
import * as tmm from 'ts-migrate-mongoose'
import * as nest from 'ts-migrate-mongoose/nest'
import scenario from './nest-scenario.cjs'

const [resultPath, options] = process.argv.slice(2)
writeFileSync(resultPath, JSON.stringify(await scenario({ tmm, nest, core }, JSON.parse(options))))
