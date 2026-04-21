import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { loadConfig } from '../src/config/load'

const TEMP_DIRS: string[] = []

function createTempProject(prefix: string): string {
  const dir = mkdtempSync(resolve(tmpdir(), prefix))
  TEMP_DIRS.push(dir)
  return dir
}

function writeConfig(path: string, content: string) {
  writeFileSync(path, content)
}

afterEach(() => {
  while (TEMP_DIRS.length > 0) {
    const dir = TEMP_DIRS.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe('loadConfig', () => {
  it('loads a TypeScript config that imports definePlugin from pluxx', async () => {
    const projectDir = createTempProject('pluxx-config-ts-')
    writeConfig(
      resolve(projectDir, 'pluxx.config.ts'),
      `import { definePlugin } from 'pluxx'

export default definePlugin({
  name: 'ts-fixture',
  version: '0.1.0',
  description: 'Fixture config',
  author: { name: 'Test Author' },
  skills: './skills/',
  targets: ['codex'],
  outDir: './dist',
})
`,
    )

    const config = await loadConfig(projectDir)
    expect(config.name).toBe('ts-fixture')
    expect(config.targets).toEqual(['codex'])
  })

  it('loads a JavaScript config', async () => {
    const projectDir = createTempProject('pluxx-config-js-')
    writeConfig(
      resolve(projectDir, 'pluxx.config.js'),
      `export default {
  name: 'js-fixture',
  version: '0.1.0',
  description: 'Fixture config',
  author: { name: 'Test Author' },
  skills: './skills/',
  targets: ['cursor'],
  outDir: './dist',
}
`,
    )

    const config = await loadConfig(projectDir)
    expect(config.name).toBe('js-fixture')
    expect(config.targets).toEqual(['cursor'])
  })

  it('loads a JSON config', async () => {
    const projectDir = createTempProject('pluxx-config-json-')
    writeConfig(
      resolve(projectDir, 'pluxx.config.json'),
      JSON.stringify({
        name: 'json-fixture',
        version: '0.1.0',
        description: 'Fixture config',
        author: { name: 'Test Author' },
        skills: './skills/',
        targets: ['opencode'],
        outDir: './dist',
      }, null, 2),
    )

    const config = await loadConfig(projectDir)
    expect(config.name).toBe('json-fixture')
    expect(config.targets).toEqual(['opencode'])
  })
})
