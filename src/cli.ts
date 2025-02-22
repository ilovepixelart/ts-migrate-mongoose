#! /usr/bin/env node
import 'tsx'
import { Migrate } from './commander'

const migrate = new Migrate()
migrate.run()
