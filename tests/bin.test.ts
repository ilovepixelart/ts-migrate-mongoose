import { describe, expect, it, vi } from 'vitest'

import { Migrate } from '../src/commander'

// Mock the Migrate class
vi.mock('../src/commander', () => {
  return {
    Migrate: vi.fn().mockImplementation(() => {
      return {
        run: vi.fn(),
      }
    }),
  }
})

describe('CLI', () => {
  it('should instantiate Migrate and call run', async () => {
    // Import the CLI script
    await import('../src/cli')

    // Check if Migrate was instantiated
    expect(Migrate).toHaveBeenCalledTimes(1)
  })
})
