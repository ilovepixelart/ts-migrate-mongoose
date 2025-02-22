import { config } from 'dotenv'
import { beforeEach, describe, expect, it } from 'vitest'
import { getEnv, getEnvBoolean, toCamelCase } from '../src/commander'
import { Env } from '../src/types'

// Load environment variables from .env file
config({ path: '.env.test' })

describe('Environment Variable Utilities', () => {
  beforeEach(() => {
    // Clear environment variables before each test
    // biome-ignore lint/performance/noDelete: we need to delete the environment variables for testing
    delete process.env.MIGRATE_MODE
    // biome-ignore lint/performance/noDelete: we need to delete the environment variables for testing
    delete process.env.migrateMode
    // biome-ignore lint/performance/noDelete: we need to delete the environment variables for testing
    delete process.env.MIGRATE_CONFIG_PATH
    // biome-ignore lint/performance/noDelete: we need to delete the environment variables for testing
    delete process.env.migrateConfigPath
  })

  describe('toCamelCase', () => {
    it('should convert snake_case to camelCase', () => {
      expect(toCamelCase(Env.MIGRATE_CONFIG_PATH)).toBe('migrateConfigPath')
      expect(toCamelCase(Env.MIGRATE_MODE)).toBe('migrateMode')
    })
  })

  describe('getEnv', () => {
    it('should return the value of the environment variable', () => {
      process.env.MIGRATE_MODE = 'development'
      expect(getEnv(Env.MIGRATE_MODE)).toBe('development')
    })

    it('should return the value of the camelCase environment variable', () => {
      process.env.migrateMode = 'development'
      expect(getEnv(Env.MIGRATE_MODE)).toBe('development')
    })

    it('should return undefined if the environment variable is not set', () => {
      expect(getEnv(Env.MIGRATE_MODE)).toBeUndefined()
    })
  })

  describe('getEnvBoolean', () => {
    it('should return true if the environment variable is set to "true"', () => {
      process.env.MIGRATE_AUTOSYNC = 'true'
      expect(getEnvBoolean(Env.MIGRATE_AUTOSYNC)).toBe(true)
    })

    it('should return undefined if the environment variable is not set to "true"', () => {
      process.env.MIGRATE_AUTOSYNC = 'false'
      expect(getEnvBoolean(Env.MIGRATE_AUTOSYNC)).toBeUndefined()
    })

    it('should return undefined if the environment variable is not set', () => {
      expect(getEnvBoolean(Env.MIGRATE_AUTOSYNC)).toBeUndefined()
    })
  })
})
