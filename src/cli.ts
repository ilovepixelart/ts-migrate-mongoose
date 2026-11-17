#! /usr/bin/env node

import { Migrate } from './commander'

const migrate = new Migrate()
void migrate.run()
