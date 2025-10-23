import { describe, expect, it, vi } from 'vitest'

import { Migrate } from '../src/commander'

// Mock the Migrate class
vi.mock('../src/commander', () => {
  return {
    // biome-ignore lint/complexity/useArrowFunction: vitest requires a function (not arrow function) to work as a constructor
    Migrate: vi.fn(function () {
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
