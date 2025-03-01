export const colors = ['red', 'green', 'yellow', 'cyan'] as const

export type Color = (typeof colors)[number]

export const chalk: Record<Color, (text: string) => string> = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
}
