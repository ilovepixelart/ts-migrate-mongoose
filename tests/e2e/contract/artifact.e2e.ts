import { describe, expect, it } from 'vitest'

import { scenario } from './observations'

describe('package artifact', () => {
  it('law module-formats: type-checks a consumer under nodenext for both .mts and .cts', () => {
    expect(scenario('types')).toEqual({ exitCode: 0, stdout: '', stderr: '' })
  })

  it('law module-formats: links the migrate bin to dist/cli.js and ships every exported file', () => {
    const { manifest, files, binLink } = scenario('manifest') as { manifest: { bin: Record<string, string>; exports: Record<string, Record<string, Record<string, string>>> }; files: string[]; binLink: boolean }
    expect(binLink).toBe(true)
    expect(manifest.bin).toEqual({ migrate: './dist/cli.js' })
    const targets = Object.values(manifest.exports).flatMap((conditions) => Object.values(conditions).flatMap((entry) => Object.values(entry)))
    expect(targets).toHaveLength(8)
    for (const target of targets) expect(files).toContain(target.replace('./', ''))
  })
})
