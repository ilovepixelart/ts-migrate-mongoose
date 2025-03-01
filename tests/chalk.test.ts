import { describe, it, expect } from 'vitest'
import { chalk } from '../src/chalk'

describe('chalk', () => {
  it('should wrap text with red color', () => {
    const text = 'Hello, World!'
    const result = chalk.red(text)
    expect(result).toBe(`\x1b[31m${text}\x1b[0m`)
  })

  it('should wrap text with green color', () => {
    const text = 'Hello, World!'
    const result = chalk.green(text)
    expect(result).toBe(`\x1b[32m${text}\x1b[0m`)
  })

  it('should wrap text with yellow color', () => {
    const text = 'Hello, World!'
    const result = chalk.yellow(text)
    expect(result).toBe(`\x1b[33m${text}\x1b[0m`)
  })

  it('should wrap text with cyan color', () => {
    const text = 'Hello, World!'
    const result = chalk.cyan(text)
    expect(result).toBe(`\x1b[36m${text}\x1b[0m`)
  })
})