import { afterAll, afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')
const DIST_CLI_PATH = resolve(ROOT, 'dist/cli/index.js')
const ORIGINAL_DIST_CLI_CONTENT = existsSync(DIST_CLI_PATH)
  ? readFileSync(DIST_CLI_PATH, 'utf-8')
  : null

afterEach(() => {
  if (ORIGINAL_DIST_CLI_CONTENT === null) {
    rmSync(DIST_CLI_PATH, { force: true })
    return
  }

  mkdirSync(resolve(ROOT, 'dist/cli'), { recursive: true })
  writeFileSync(DIST_CLI_PATH, ORIGINAL_DIST_CLI_CONTENT)
})

afterAll(() => {
  if (ORIGINAL_DIST_CLI_CONTENT === null) {
    rmSync(DIST_CLI_PATH, { force: true })
    return
  }

  mkdirSync(resolve(ROOT, 'dist/cli'), { recursive: true })
  writeFileSync(DIST_CLI_PATH, ORIGINAL_DIST_CLI_CONTENT)
})

describe('package metadata', () => {
  it('publishes a real launcher and compiled CLI entry metadata', () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'))

    expect(pkg.name).toBe('@orchid-labs/pluxx')
    expect(pkg.bin.pluxx).toBe('bin/pluxx.js')
    expect(pkg.files).toContain('bin/**/*')
    expect(pkg.types).toBe('dist/index.d.ts')
    expect(pkg.exports['.'].import).toBe('./dist/index.js')
    expect(pkg.engines.node).toBe('>=18')
    expect(pkg.engines.bun).toBeUndefined()
    expect(pkg.scripts.build).toContain('bun build src/cli/entry.ts')
    expect(pkg.scripts.build).toContain('dist/cli/index.js')
    expect(pkg.scripts.prepublishOnly).toMatch(/bun run build/)
  })

  it('ships a launcher that prefers the compiled CLI bundle', () => {
    const launcherPath = resolve(ROOT, 'bin/pluxx.js')
    expect(existsSync(launcherPath)).toBe(true)

    const launcher = readFileSync(launcherPath, 'utf-8')
    expect(launcher).toContain("resolve(binDir, '..', 'dist', 'cli', 'index.js')")
    expect(launcher).toContain('pluxx CLI bundle not found.')
    expect(launcher).toContain("await import(pathToFileURL(cliPath).href)")
  })

  it('routes execution through the published launcher under Node', async () => {
    mkdirSync(resolve(ROOT, 'dist/cli'), { recursive: true })
    writeFileSync(DIST_CLI_PATH, 'export async function main() { console.log("stub cli ok") }\n')

    const proc = Bun.spawn(['node', resolve(ROOT, 'bin/pluxx.js'), 'help'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(stdout).toContain('stub cli ok')
    expect(stderr).toBe('')
  })

  it('loads a TypeScript pluxx.config.ts through the built Node CLI', async () => {
    const buildProc = Bun.spawn(['bun', 'run', 'build'], {
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const buildExitCode = await buildProc.exited
    expect(buildExitCode).toBe(0)

    const projectDir = mkdtempSync(resolve(tmpdir(), 'pluxx-node-validate-'))
    try {
      writeFileSync(
        resolve(projectDir, 'pluxx.config.ts'),
        `import { definePlugin } from 'pluxx'

export default definePlugin({
  name: 'node-fixture',
  version: '0.1.0',
  description: 'Fixture config',
  author: { name: 'Test Author' },
  skills: './skills/',
  targets: ['codex'],
  outDir: './dist',
})
`,
      )

      const proc = Bun.spawn(['node', resolve(ROOT, 'bin/pluxx.js'), 'validate'], {
        cwd: projectDir,
        stdout: 'pipe',
        stderr: 'pipe',
      })

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
      expect(stdout).toContain('Config valid: node-fixture@0.1.0')
      expect(stderr).toBe('')
    } finally {
      rmSync(projectDir, { recursive: true, force: true })
    }
  })
})
