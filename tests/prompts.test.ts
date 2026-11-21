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

// Expected screens, written out by hand: ANSI codes for the colours and cursor moves the prompt uses.
const green = (text: string) => `\x1b[32m${text}\x1b[0m`
const cyan = (text: string) => `\x1b[36m${text}\x1b[0m`
const dim = (text: string) => `\x1b[2m${text}\x1b[0m`
const bold = (text: string) => `\x1b[1m${text}\x1b[0m`
const HINTS = '↑↓ navigate • space select • a all • enter submit'

const written = (): string[] => (process.stdout.write as unknown as ReturnType<typeof vi.fn>).mock.calls.map((call) => String(call[0]))
const named = (count: number) => Array.from({ length: count }, (_, i) => ({ name: `M${String(i + 1)}`, value: `m${String(i + 1)}` }))
const setRows = (rows: number | undefined) => Object.defineProperty(process.stdout, 'rows', { value: rows, writable: true, configurable: true })
// The last frame the prompt drew, as the visible text without colours.
const COLOURS = ['\x1b[32m', '\x1b[36m', '\x1b[2m', '\x1b[1m', '\x1b[0m']
const lastFrame = (): string => COLOURS.reduce((frame, code) => frame.replaceAll(code, ''), written().at(-1) ?? '')

describe('checkbox prompt screen', () => {
  const rows = process.stdout.rows

  beforeEach(() => {
    setupTTY()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    setRows(rows)
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true, configurable: true })
  })

  it('reserves the lines, then draws the message, every choice with the pointer on the first, and the hints', async () => {
    setRows(24)
    const promise = checkbox({ message: 'Select', choices })
    expect(written()).toEqual(['\x1b[?25l', '\n\n\n\n\n', '\x1b[5A', '\x1b[J', `${green('?')} ${bold('Select')}\n${cyan('❯')} ${dim('◯')} Migration 1\n  ${dim('◯')} Migration 2\n  ${dim('◯')} Migration 3\n${dim(HINTS)}`])
    emitKey('return')
    await promise
  })

  it('redraws over the previous frame with the pointer and the checked marks where the keys put them', async () => {
    setRows(24)
    const promise = checkbox({ message: 'Select', choices })
    emitKey('down')
    emitKey('space')
    expect(written().slice(-3)).toEqual(['\x1b[5A', '\x1b[J', `${green('?')} ${bold('Select')}\n  ${dim('◯')} Migration 1\n${cyan('❯')} ${green('◉')} Migration 2\n  ${dim('◯')} Migration 3\n${dim(HINTS)}`])
    emitKey('return')
    await promise
  })

  it('redraws with every choice checked when a selects all', async () => {
    setRows(24)
    const promise = checkbox({ message: 'Select', choices })
    emitKey('a')
    expect(lastFrame()).toBe(`? Select\n❯ ◉ Migration 1\n  ◉ Migration 2\n  ◉ Migration 3\n${HINTS}`)
    emitKey('return')
    await promise
  })

  it('replaces the prompt with a one-line summary of the chosen names in list order and shows the cursor', async () => {
    setRows(24)
    const promise = checkbox({ message: 'Select', choices })
    emitKey('up')
    emitKey('space')
    emitKey('up')
    emitKey('up')
    emitKey('space')
    emitKey('return')
    expect(await promise).toEqual(['migration-1', 'migration-3'])
    expect(written().slice(-4)).toEqual(['\x1b[5A', '\x1b[J', `${green('✔')} ${bold('Select')} ${cyan('Migration 1, Migration 3')}\n`, '\x1b[?25h'])
  })

  it('shows every choice and no position when they fit the page exactly', async () => {
    setRows(9) // a page is rows - 4 = 5 choices
    const promise = checkbox({ message: 'Pick', choices: named(5) })
    expect(written()[1]).toBe('\n'.repeat(7))
    expect(lastFrame()).toBe(`? Pick\n❯ ◯ M1\n  ◯ M2\n  ◯ M3\n  ◯ M4\n  ◯ M5\n${HINTS}`)
    emitKey('return')
    await promise
  })

  it('pages one more choice than fits and shows the visible range first in the hints', async () => {
    setRows(9)
    const promise = checkbox({ message: 'Pick', choices: named(6) })
    expect(written()[1]).toBe('\n'.repeat(7))
    expect(lastFrame()).toBe(`? Pick\n❯ ◯ M1\n  ◯ M2\n  ◯ M3\n  ◯ M4\n  ◯ M5\n1-5/6 • ${HINTS}`)
    emitKey('return')
    await promise
  })

  it('scrolls only when the pointer leaves the page, by as little as keeps it visible', async () => {
    setRows(9)
    const promise = checkbox({ message: 'Pick', choices: named(7) })
    for (let i = 0; i < 4; i++) emitKey('down')
    expect(lastFrame()).toBe(`? Pick\n  ◯ M1\n  ◯ M2\n  ◯ M3\n  ◯ M4\n❯ ◯ M5\n1-5/7 • ${HINTS}`)
    emitKey('down')
    expect(lastFrame()).toBe(`? Pick\n  ◯ M2\n  ◯ M3\n  ◯ M4\n  ◯ M5\n❯ ◯ M6\n2-6/7 • ${HINTS}`)
    emitKey('up')
    // Scrolled, the frame is still 5 choices and 2 more lines, so the redraw moves up 7 lines.
    expect(written().slice(-3, -1)).toEqual(['\x1b[7A', '\x1b[J'])
    expect(lastFrame()).toBe(`? Pick\n  ◯ M2\n  ◯ M3\n  ◯ M4\n❯ ◯ M5\n  ◯ M6\n2-6/7 • ${HINTS}`)
    for (let i = 0; i < 4; i++) emitKey('up')
    expect(lastFrame()).toBe(`? Pick\n❯ ◯ M1\n  ◯ M2\n  ◯ M3\n  ◯ M4\n  ◯ M5\n1-5/7 • ${HINTS}`)
    emitKey('return')
    await promise
  })

  it('wraps from the first choice to the last page and back', async () => {
    setRows(9)
    const promise = checkbox({ message: 'Pick', choices: named(7) })
    emitKey('up')
    expect(lastFrame()).toBe(`? Pick\n  ◯ M3\n  ◯ M4\n  ◯ M5\n  ◯ M6\n❯ ◯ M7\n3-7/7 • ${HINTS}`)
    emitKey('down')
    expect(lastFrame()).toBe(`? Pick\n❯ ◯ M1\n  ◯ M2\n  ◯ M3\n  ◯ M4\n  ◯ M5\n1-5/7 • ${HINTS}`)
    emitKey('return')
    await promise
  })

  it('sizes the page to the terminal rows less 4, at least 5, and to 16 when the rows are unknown', async () => {
    for (const [terminalRows, count, range] of [
      [10, 7, '1-6/7'],
      [6, 6, '1-5/6'],
      [undefined, 17, '1-16/17'],
    ] as const) {
      setRows(terminalRows)
      const promise = checkbox({ message: 'Pick', choices: named(count) })
      expect(lastFrame().split('\n').at(-1)).toBe(`${range} • ${HINTS}`)
      emitKey('return')
      await promise
    }
  })

  it('redraws for the new page size when the terminal is resized', async () => {
    setRows(9)
    const promise = checkbox({ message: 'Pick', choices: named(7) })
    setRows(30)
    process.stdout.emit('resize')
    expect(written().slice(-3)).toEqual(['\x1b[7A', '\x1b[J', `${green('?')} ${bold('Pick')}\n${cyan('❯')} ${dim('◯')} M1\n${['M2', 'M3', 'M4', 'M5', 'M6', 'M7'].map((name) => `  ${dim('◯')} ${name}\n`).join('')}${dim(HINTS)}`])
    emitKey('return')
    await promise
  })

  it('shows the cursor again if the process exits or is signalled while the prompt is open, and stops listening once it closes', async () => {
    const counts = () => [process.listenerCount('exit'), process.listenerCount('SIGTERM'), process.listenerCount('SIGHUP'), process.stdout.listenerCount('resize'), process.stdin.listenerCount('keypress')]
    const before = counts()
    const promise = checkbox({ message: 'Select', choices })
    expect(counts()).toEqual(before.map((count) => count + 1))
    for (const restore of [process.listeners('exit').at(-1), process.listeners('SIGTERM').at(-1), process.listeners('SIGHUP').at(-1)] as (() => void)[]) {
      restore()
      expect(written().at(-1)).toBe('\x1b[?25h')
    }
    emitKey('return')
    await promise
    expect(counts()).toEqual(before)
    expect(process.stdin.resume).toHaveBeenCalledTimes(1)
    expect(process.stdin.pause).toHaveBeenCalledTimes(1)
  })

  it('on Ctrl+C restores the terminal, stops listening, shows the cursor on a new line and exits with 130', async () => {
    const counts = () => [process.listenerCount('exit'), process.listenerCount('SIGTERM'), process.listenerCount('SIGHUP'), process.stdout.listenerCount('resize'), process.stdin.listenerCount('keypress')]
    const before = counts()
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    void checkbox({ message: 'Select', choices })
    emitKey('c', true)
    expect(written().at(-1)).toBe('\x1b[?25h\n')
    expect(exit).toHaveBeenCalledWith(130)
    expect(process.stdin.setRawMode).toHaveBeenLastCalledWith(false)
    expect(counts()).toEqual(before)
  })

  it('treats c without Ctrl and Ctrl with another key as unknown keys', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    setRows(24)
    const promise = checkbox({ message: 'Select', choices })
    const drawn = written().length
    emitKey('c')
    emitKey('n', true)
    expect(written()).toHaveLength(drawn)
    expect(exit).not.toHaveBeenCalled()
    emitKey('return')
    expect(await promise).toEqual([])
  })
})
