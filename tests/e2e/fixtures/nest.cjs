'use strict'

const { writeFileSync } = require('node:fs')
const core = require('@nestjs/core')
const tmm = require('ts-migrate-mongoose')
const nest = require('ts-migrate-mongoose/nest')
const scenario = require('./nest-scenario.cjs')

const [resultPath, options] = process.argv.slice(2)
scenario({ tmm, nest, core }, JSON.parse(options)).then((result) => writeFileSync(resultPath, JSON.stringify(result)))
