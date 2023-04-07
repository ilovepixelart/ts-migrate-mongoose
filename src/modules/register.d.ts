import type { Swcrc } from '@swc/core'

declare module '@swc/register' {
  export default function register(options?: Swcrc): void
}
