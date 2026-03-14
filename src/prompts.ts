import readline from 'node:readline'
import { chalk } from './chalk'

const ansi = {
  cursorUp: (n: number) => `\x1b[${n}A`,
  eraseDown: '\x1b[J',
  cursorHide: '\x1b[?25l',
  cursorShow: '\x1b[?25h',
}

interface CheckboxChoice {
  name: string
  value: string
}

interface CheckboxOptions {
  message: string
  choices: CheckboxChoice[]
}

const getPageSize = (): number => {
  return Math.max((process.stdout.rows || 20) - 4, 5)
}

export const checkbox = async (options: CheckboxOptions): Promise<string[]> => {
  const { message, choices } = options

  if (!process.stdin.isTTY) {
    return choices.map((c) => c.value)
  }

  return new Promise((resolve) => {
    let cursor = 0
    const selected = new Set<number>()
    let pageSize = getPageSize()
    let scrollOffset = 0

    function getVisibleRange(): { start: number; end: number } {
      if (choices.length <= pageSize) {
        return { start: 0, end: choices.length }
      }
      if (cursor < scrollOffset) {
        scrollOffset = cursor
      } else if (cursor >= scrollOffset + pageSize) {
        scrollOffset = cursor - pageSize + 1
      }
      return { start: scrollOffset, end: Math.min(scrollOffset + pageSize, choices.length) }
    }

    function getRenderedLines(): number {
      const { start, end } = getVisibleRange()
      return end - start + 2
    }

    let lastRenderedLines = 0

    const render = () => {
      if (lastRenderedLines > 0) {
        process.stdout.write(ansi.cursorUp(lastRenderedLines))
      }
      process.stdout.write(ansi.eraseDown)

      const { start, end } = getVisibleRange()

      let output = `${chalk.green('?')} ${chalk.bold(message)}\n`

      for (let i = start; i < end; i++) {
        const choice = choices[i] as CheckboxChoice
        const isActive = i === cursor
        const isChecked = selected.has(i)
        const pointer = isActive ? chalk.cyan('❯') : ' '
        const check = isChecked ? chalk.green('◉') : chalk.dim('◯')
        output += `${pointer} ${check} ${choice.name}\n`
      }

      const hints = ['↑↓ navigate', 'space select', 'a all', 'enter submit']
      if (choices.length > pageSize) {
        hints.unshift(`${start + 1}-${end}/${choices.length}`)
      }
      output += chalk.dim(hints.join(' • '))

      process.stdout.write(output)
      lastRenderedLines = getRenderedLines()
    }

    const onResize = () => {
      pageSize = getPageSize()
      render()
    }

    process.stdout.write(ansi.cursorHide)
    process.stdout.write('\n'.repeat(getRenderedLines()))
    lastRenderedLines = getRenderedLines()
    render()

    readline.emitKeypressEvents(process.stdin)
    process.stdin.setRawMode(true)
    process.stdin.resume()

    const restoreCursor = () => {
      process.stdout.write(ansi.cursorShow)
    }

    process.on('exit', restoreCursor)
    process.on('SIGTERM', restoreCursor)
    process.on('SIGHUP', restoreCursor)
    process.stdout.on('resize', onResize)

    const moveCursor = (direction: number) => {
      cursor = (cursor + direction + choices.length) % choices.length
      render()
    }

    const toggleCurrent = () => {
      selected.has(cursor) ? selected.delete(cursor) : selected.add(cursor)
      render()
    }

    const toggleAll = () => {
      if (selected.size === choices.length) {
        selected.clear()
      } else {
        for (let i = 0; i < choices.length; i++) selected.add(i)
      }
      render()
    }

    const submit = () => {
      cleanup()
      if (lastRenderedLines > 0) {
        process.stdout.write(ansi.cursorUp(lastRenderedLines))
      }
      process.stdout.write(ansi.eraseDown)

      const sorted = [...selected].sort((a, b) => a - b)
      const selectedValues = sorted.map((i) => (choices[i] as CheckboxChoice).value)
      const summary = sorted.length ? sorted.map((i) => (choices[i] as CheckboxChoice).name).join(', ') : 'none'
      process.stdout.write(`${chalk.green('✔')} ${chalk.bold(message)} ${chalk.cyan(summary)}\n`)
      process.stdout.write(ansi.cursorShow)
      resolve(selectedValues)
    }

    const keyActions: Record<string, () => void> = {
      up: () => moveCursor(-1),
      down: () => moveCursor(1),
      space: toggleCurrent,
      a: toggleAll,
      return: submit,
    }

    const onKeypress = (_str: string | undefined, key: readline.Key) => {
      if (key.ctrl && key.name === 'c') {
        cleanup()
        process.stdout.write(`${ansi.cursorShow}\n`)
        process.exit(130)
      }

      const action = key.name ? keyActions[key.name] : undefined
      if (action) action()
    }

    const cleanup = () => {
      process.stdin.removeListener('keypress', onKeypress)
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.removeListener('exit', restoreCursor)
      process.removeListener('SIGTERM', restoreCursor)
      process.removeListener('SIGHUP', restoreCursor)
      process.stdout.removeListener('resize', onResize)
    }

    process.stdin.on('keypress', onKeypress)
  })
}
