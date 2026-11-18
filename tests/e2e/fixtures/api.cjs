'use strict'

const { writeFileSync } = require('node:fs')
const tmm = require('ts-migrate-mongoose')
const scenario = require('./api-scenario.cjs')

const [resultPath, options] = process.argv.slice(2)
scenario(tmm, JSON.parse(options)).then((result) => writeFileSync(resultPath, JSON.stringify(result)))
