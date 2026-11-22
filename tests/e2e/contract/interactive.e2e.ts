import { describe, expect, it } from 'vitest'

import { db, names, steps } from './observations'

import type { Step } from '../harness'

describe('CLI interactive prompt on a TTY', () => {
  const SYNC_PROMPT = 'The following migrations exist in the migrations folder but not in the database.\nSelect the ones you want to import into the database'
  const PRUNE_PROMPT = 'The following migrations exist in the database but not in the migrations folder.\nSelect the ones you want to remove from the database'
  const [, , cursor, afterDown, afterUp, toggledOff, all, allTwice, none, unknownKey, interrupted, prune] = steps('interactive')
  const both = ['first', 'second']
  const imported = (collection: string, name = 'interactive') => names(db(name)[collection]).sort()
  const summary = (step?: Step) => new RegExp(`✔ ${SYNC_PROMPT.replace('.', '\\.')} (.+)\\n`).exec(step?.stdout ?? '')?.[1]

  it('law prompt: lists every new file as an unchecked choice with the key hints', () => {
    expect(cursor?.stdout).toContain(`? ${SYNC_PROMPT}\n`)
    expect(cursor?.stdout).toMatch(/◯ <timestamp>-first\n/)
    expect(cursor?.stdout).toMatch(/◯ <timestamp>-second\n/)
    expect(cursor?.stdout).toContain('↑↓ navigate • space select • a all • enter submit')
  })

  it('law prompt: imports only the choices toggled with space, naming them in the summary', () => {
    for (const [step, collection] of [
      [cursor, 'pick_cursor'],
      [afterDown, 'pick_after_down'],
      [afterUp, 'pick_after_up'],
    ] as const) {
      expect(step?.exitCode).toBe(0)
      expect(imported(collection)).toHaveLength(1)
      expect(summary(step)).toBe(`<timestamp>-${imported(collection)[0] ?? ''}`)
    }
  })

  it('law prompt: moves the cursor with the arrow keys and wraps around both ends', () => {
    expect([...imported('pick_cursor'), ...imported('pick_after_down')].sort()).toEqual(both)
    expect(imported('pick_after_up')).toEqual(imported('pick_after_down'))
  })

  it('law prompt: selects every choice with a and clears them with a second a', () => {
    expect(imported('pick_all')).toEqual(both)
    expect(summary(all)).toMatch(/^<timestamp>-(first|second), <timestamp>-(first|second)$/)
    expect(imported('pick_all_twice')).toEqual([])
    expect(summary(allTwice)).toBe('none')
  })

  it('law prompt: imports nothing when submitted with no selection, after toggling off, or after an unknown key', () => {
    for (const [step, collection] of [
      [toggledOff, 'pick_toggled_off'],
      [none, 'pick_none'],
      [unknownKey, 'pick_unknown_key'],
    ] as const) {
      expect(step?.exitCode).toBe(0)
      expect(summary(step)).toBe('none')
      expect(imported(collection)).toEqual([])
    }
  })

  it('law prompt: exits with code 130 on Ctrl+C without importing anything', () => {
    expect(interrupted?.exitCode).toBe(130)
    expect(interrupted?.stdout).not.toContain('✔')
    expect(imported('interrupted')).toEqual([])
  })

  it('law prompt: asks before pruning and removes the selected records', () => {
    expect(prune?.exitCode).toBe(0)
    expect(prune?.stdout).toContain(`? ${PRUNE_PROMPT}\n`)
    expect(prune?.stdout).toMatch(/✔ The following migrations exist in the database but not in the migrations folder\.\nSelect the ones you want to remove from the database first, second\nRemoving migration\(s\) from database:\nfirst\nsecond\n$/)
    expect(imported('pruned')).toEqual([])
  })

  it('law prompt: pages the choices to the terminal height, scrolls with the cursor and re-pages on resize', () => {
    const [paging] = steps('interactive-paging')
    const hints = '↑↓ navigate • space select • a all • enter submit'
    const frames = paging?.stdout ?? ''
    const scrolled = frames.lastIndexOf(`13-18/18 • ${hints}`)
    expect(paging?.exitCode).toBe(0)
    expect(frames.indexOf(`1-6/18 • ${hints}`)).toBeGreaterThanOrEqual(0)
    expect(frames.indexOf(`1-6/18 • ${hints}`)).toBeLessThan(scrolled)
    expect(frames.slice(0, scrolled).includes(`\n${hints}`)).toBe(false)
    const afterResize = frames.slice(scrolled)
    expect(afterResize).toContain(`\n${hints}`)
    expect(afterResize.match(/^[❯ ] [◯◉] /gm)).toHaveLength(18)
    const picked = imported('migrations', 'interactive-paging')
    expect(picked).toHaveLength(1)
    expect(summary(paging)).toBe(`<timestamp>-${picked[0] ?? ''}`)
  })

  // Known defect, pinned as it is: the visible window only moves when the cursor leaves it, so a terminal grown from
  // 10 to 14 rows keeps showing 6 choices (13-18) where 10 fit (9-18). A fix fails this test.
  it('law prompt: known defect: keeps the smaller window after the terminal grows', () => {
    const [, grown] = steps('interactive-paging')
    const frames = (grown?.stdout ?? '').split('? The following').slice(1)
    const window = (frame: string) => [/\d+-\d+\/18/.exec(frame)?.[0], frame.match(/^[❯ ] [◯◉] /gm)?.length]
    expect(frames.map(window)).toEqual([
      ['1-6/18', 6],
      ['13-18/18', 6],
      ['13-18/18', 6],
    ])
  })

  describe('law prompt: page boundaries and selection order (a page holds 6 choices at 10 rows)', () => {
    const [exact, over, empty, order] = steps('interactive-boundaries')
    const ranges = (step?: Step, of = 7) => [...(step?.stdout ?? '').matchAll(new RegExp(`(\\d+-\\d+)/${String(of)} • `, 'g'))].map((match) => match[1])
    const firstFrameChoices = (step?: Step) => ((step?.stdout ?? '').split('↑↓ navigate')[0] ?? '').match(/^[❯ ] [◯◉] (.+)$/gm)?.map((line) => line.slice(4)) ?? []

    it('law prompt: shows exactly a page of choices without a range, and treats Ctrl+N, and c without Ctrl, as unknown keys', () => {
      expect(exact?.exitCode).toBe(0)
      expect(ranges(exact, 6)).toEqual([])
      expect(summary(exact)).toBe('none')
      expect(imported('exact', 'interactive-boundaries')).toEqual([])
    })

    it('law prompt: does not ask when there is nothing new to import', () => {
      expect(empty?.exitCode).toBe(0)
      expect(empty?.stdout).not.toContain('? The following')
      expect(empty?.stdout).toContain('There are no migrations to list')
    })

    it('law prompt: scrolls when the cursor leaves the page and back when it returns, one choice at a time', () => {
      expect(over?.exitCode).toBe(0)
      expect(ranges(over)).toEqual([...Array(6).fill('1-6'), ...Array(6).fill('2-7'), '1-6'])
    })

    it('law prompt: lists the selected choices in their order, whatever order they were selected in', () => {
      const choices = firstFrameChoices(order)
      expect(choices).toHaveLength(11)
      expect(summary(order)).toBe(`${choices[2] ?? ''}, ${choices[10] ?? ''}`)
      expect(imported('order', 'interactive-boundaries')).toEqual([choices[2], choices[10]].map((choice) => (choice ?? '').replace('<timestamp>-', '')).sort())
    })
  })

  it('law prompt: imports nothing when terminated or hung up at the prompt', () => {
    expect(imported('terminated', 'interactive-signals')).toEqual([])
    expect(imported('hung_up', 'interactive-signals')).toEqual([])
  })

  // Known defect, pinned as it is: the prompt's SIGTERM and SIGHUP listeners only restore the cursor, which replaces
  // Node's default exit, so the CLI keeps waiting after a kill or a closed terminal. A fix fails this test; replace it
  // with one that expects the CLI to exit.
  it('law prompt: known defect: keeps running after SIGTERM or SIGHUP at the prompt', () => {
    expect(steps('interactive-signals').map((step) => [step.command, step.aliveAfterSignal])).toEqual([
      ['migrate list -d <mongo>/interactive_signals -c terminated', true],
      ['migrate list -d <mongo>/interactive_signals -c hung_up', true],
    ])
  })
})
