#! /usr/bin/env node
import { Migrate } from './commander'

/**
 * The main entry point for the CLI migration tool.
 * It creates an instance of the Migrate class and runs the migration.
 */
const migrate = new Migrate()
migrate.run()
