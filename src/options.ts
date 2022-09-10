import { RegisterOptions } from 'ts-node'

export const registerOptions: RegisterOptions = {
  transpileOnly: true,
  compilerOptions: {
    declaration: true,
    declarationMap: true,
    sourceMap: true,
    allowJs: true,
    allowSyntheticDefaultImports: true,
    forceConsistentCasingInFileNames: true,
    esModuleInterop: true,
    importHelpers: true,
    removeComments: true
  }
}
