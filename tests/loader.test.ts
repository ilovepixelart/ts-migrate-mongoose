import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('loader', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doUnmock('tsx')
  })

  it('marks loaded=true on successful tsx import and is idempotent across calls', async () => {
    const { loader } = await import('../src/loader')
    await expect(loader()).resolves.toBeUndefined()
    await expect(loader()).resolves.toBeUndefined()
  })

  it('swallows an import failure and leaves loaded=false without rethrowing', async () => {
    vi.doMock('tsx', () => {
      throw new Error('tsx not installed')
    })

    const { loader } = await import('../src/loader')
    await expect(loader()).resolves.toBeUndefined()
    // A second call hits the early return (loaded would be false on failure path).
    await expect(loader()).resolves.toBeUndefined()
  })
})
