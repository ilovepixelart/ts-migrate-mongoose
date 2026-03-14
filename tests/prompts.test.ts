import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { checkbox } from '../src/prompts'

const choices = [
  { name: 'Migration 1', value: 'migration-1' },
  { name: 'Migration 2', value: 'migration-2' },
  { name: 'Migration 3', value: 'migration-3' },
]

const emitKey = (name: string, ctrl = false) => {
  process.stdin.emit('keypress', null, { name, ctrl })
}

const setupTTY = () => {
  Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true, configurable: true })
  if (!process.stdin.setRawMode) {
    Object.defineProperty(process.stdin, 'setRawMode', { value: () => process.stdin, writable: true, configurable: true })
  }
  vi.spyOn(process.stdin, 'setRawMode').mockReturnValue(process.stdin)
  vi.spyOn(process.stdin, 'resume').mockReturnValue(process.stdin)
  vi.spyOn(process.stdin, 'pause').mockReturnValue(process.stdin)
  vi.spyOn(process.stdout, 'write').mockReturnValue(true)
}

describe('checkbox prompt', () => {
  beforeEach(() => {
    setupTTY()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true, configurable: true })
  })

  it('should return all choices when stdin is not a TTY', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true, configurable: true })
    const result = await checkbox({ message: 'Select', choices })
    expect(result).toEqual(['migration-1', 'migration-2', 'migration-3'])
  })

  it('should return empty array when nothing selected and enter pressed', async () => {
    const promise = checkbox({ message: 'Select', choices })
    emitKey('return')
    const result = await promise
    expect(result).toEqual([])
  })

  it('should select items with space and submit with enter', async () => {
    const promise = checkbox({ message: 'Select', choices })
    emitKey('space')
    emitKey('down')
    emitKey('space')
    emitKey('return')
    const result = await promise
    expect(result).toEqual(['migration-1', 'migration-2'])
  })

  it('should navigate down and wrap around', async () => {
    const promise = checkbox({ message: 'Select', choices })
    emitKey('down')
    emitKey('down')
    emitKey('down')
    emitKey('space')
    emitKey('return')
    const result = await promise
    expect(result).toEqual(['migration-1'])
  })

  it('should navigate up and wrap around', async () => {
    const promise = checkbox({ message: 'Select', choices })
    emitKey('up')
    emitKey('space')
    emitKey('return')
    const result = await promise
    expect(result).toEqual(['migration-3'])
  })

  it('should toggle all with "a" key', async () => {
    const promise = checkbox({ message: 'Select', choices })
    emitKey('a')
    emitKey('return')
    const result = await promise
    expect(result).toEqual(['migration-1', 'migration-2', 'migration-3'])
  })

  it('should deselect all when "a" pressed twice', async () => {
    const promise = checkbox({ message: 'Select', choices })
    emitKey('a')
    emitKey('a')
    emitKey('return')
    const result = await promise
    expect(result).toEqual([])
  })

  it('should toggle individual items on and off', async () => {
    const promise = checkbox({ message: 'Select', choices })
    emitKey('space')
    emitKey('space')
    emitKey('return')
    const result = await promise
    expect(result).toEqual([])
  })

  it('should ignore unknown keys', async () => {
    const promise = checkbox({ message: 'Select', choices })
    emitKey('x')
    emitKey('z')
    emitKey('space')
    emitKey('return')
    const result = await promise
    expect(result).toEqual(['migration-1'])
  })

  it('should hide cursor on start and show on submit', async () => {
    const writeSpy = process.stdout.write as ReturnType<typeof vi.fn>
    const promise = checkbox({ message: 'Select', choices })
    expect(writeSpy).toHaveBeenCalledWith('\x1b[?25l')
    emitKey('return')
    await promise
    expect(writeSpy).toHaveBeenCalledWith('\x1b[?25h')
  })

  it('should call setRawMode on start and restore on submit', async () => {
    const setRawModeSpy = process.stdin.setRawMode as ReturnType<typeof vi.fn>
    const promise = checkbox({ message: 'Select', choices })
    expect(setRawModeSpy).toHaveBeenCalledWith(true)
    emitKey('return')
    await promise
    expect(setRawModeSpy).toHaveBeenCalledWith(false)
  })

  it('should render choice names in output', async () => {
    const writeSpy = process.stdout.write as ReturnType<typeof vi.fn>
    const promise = checkbox({ message: 'Select', choices })
    const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('')
    expect(allOutput).toContain('Migration 1')
    expect(allOutput).toContain('Migration 2')
    expect(allOutput).toContain('Migration 3')
    emitKey('return')
    await promise
  })

  it('should show summary of selected items on submit', async () => {
    const writeSpy = process.stdout.write as ReturnType<typeof vi.fn>
    const promise = checkbox({ message: 'Select', choices })
    emitKey('space')
    emitKey('return')
    await promise
    const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('')
    expect(allOutput).toContain('Migration 1')
  })

  it('should show "none" in summary when nothing selected', async () => {
    const writeSpy = process.stdout.write as ReturnType<typeof vi.fn>
    const promise = checkbox({ message: 'Select', choices })
    emitKey('return')
    await promise
    const allOutput = writeSpy.mock.calls.map((c) => c[0]).join('')
    expect(allOutput).toContain('none')
  })

  it('should exit with code 130 on Ctrl+C', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })
    const promise = checkbox({ message: 'Select', choices })
    try {
      emitKey('c', true)
    } catch {
      // expected
    }
    expect(exitSpy).toHaveBeenCalledWith(130)
    exitSpy.mockRestore()
    // Clean up the dangling promise
    await Promise.race([promise, new Promise((r) => setTimeout(r, 10))])
  })

  it('should clean up event listeners on submit', async () => {
    const removeSpy = vi.spyOn(process.stdin, 'removeListener')
    const promise = checkbox({ message: 'Select', choices })
    emitKey('return')
    await promise
    expect(removeSpy).toHaveBeenCalledWith('keypress', expect.any(Function))
  })
})
