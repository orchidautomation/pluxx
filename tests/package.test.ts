import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')
const DIST_CLI_PATH = resolve(ROOT, 'dist/cli/index.js')

afterEach(() => {
  rmSync(DIST_CLI_PATH, { force: true })
})

describe('package metadata', () => {
  it('publishes a real launcher and compiled CLI entry metadata', () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'))

    expect(pkg.name).toBe('@orchid-labs/pluxx')
    expect(pkg.bin.pluxx).toBe('bin/pluxx.js')
    expect(pkg.files).toContain('bin/**/*')
    expect(pkg.types).toBe('dist/index.d.ts')
    expect(pkg.exports['.'].import).toBe('./dist/index.js')
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
})
