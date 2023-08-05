import type { Swcrc } from '@swc/core'

const swcrc: Swcrc = {
  jsc: {
    parser: {
      syntax: 'typescript',
      decorators: true,
      dynamicImport: true
    },
    target: 'es2021',
    keepClassNames: true,
    loose: true
  },
  module: {
    type: 'commonjs'
  },
  sourceMaps: true
}

export default swcrc
