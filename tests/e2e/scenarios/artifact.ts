import fs from 'node:fs'
import path from 'node:path'
import { fixturesDir, PACKAGE_NAME, repoRoot, tree } from '../harness'
import { json } from './sources'

import type { Scenario } from '../harness'

const typesScenario: Scenario = {
  name: 'types',
  run: async (context) => {
    const source = fs.readFileSync(path.join(fixturesDir, 'consumer-types.ts'), 'utf8')
    context.write('esm.mts', source)
    context.write('cjs.cts', source)
    const compilerOptions = { module: 'nodenext', moduleResolution: 'nodenext', target: 'es2022', strict: true, noEmit: true, skipLibCheck: true, typeRoots: [path.join(repoRoot, 'node_modules', '@types')], types: ['node'] }
    context.write('tsconfig.json', json({ compilerOptions, files: ['esm.mts', 'cjs.cts'] }))
    const result = await context.node(path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc'), ['-p', 'tsconfig.json'])
    return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr }
  },
}

// The public members of every class the published declarations export: whatever is not marked private.
const publicMembers = (declarations: string): Record<string, string[]> =>
  Object.fromEntries([...declarations.matchAll(/^declare class (\w+)[^{]*\{\n([\s\S]*?)^\}/gm)].map(([, name, body]) => [name, [...(body ?? '').matchAll(/^ {4}(?!private )(?:static |readonly |get )*(\w+)[(?:<]/gm)].map((member) => member[1] ?? '').filter((member) => member !== 'constructor')]))

const manifestScenario: Scenario = {
  name: 'manifest',
  run: async ({ consumer }) => {
    const root = path.join(consumer.dir, 'node_modules', PACKAGE_NAME)
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as Record<string, unknown>
    const fields = ['name', 'version', 'type', 'bin', 'main', 'module', 'types', 'exports', 'typesVersions', 'engines', 'dependencies', 'peerDependencies', 'peerDependenciesMeta']
    const files = Object.keys(tree(root)).filter((file) => !file.endsWith('.map'))
    const declarations = ['index.d.mts', 'nest/index.d.mts'].map((file) => fs.readFileSync(path.join(root, 'dist', file), 'utf8')).join('\n')
    return {
      manifest: Object.fromEntries(fields.map((field) => [field, manifest[field]])),
      files,
      binLink: fs.realpathSync(consumer.bin) === fs.realpathSync(path.join(root, 'dist', 'cli.js')),
      publicMembers: publicMembers(declarations),
    }
  },
}

// What npm installs: the manifest, the bin link and the published type declarations.
export const artifactScenarios: Scenario[] = [typesScenario, manifestScenario]
