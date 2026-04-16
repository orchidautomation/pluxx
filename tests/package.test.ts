import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')

describe('package metadata', () => {
  it('publishes a real launcher and declaration output metadata', () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'))

    expect(pkg.name).toBe('@orchid-labs/pluxx')
    expect(pkg.bin.pluxx).toBe('bin/pluxx.js')
    expect(pkg.files).toContain('bin/**/*')
    expect(pkg.types).toBe('dist/index.d.ts')
    expect(pkg.exports['.'].import).toBe('./dist/index.js')
    expect(pkg.scripts.prepublishOnly).toMatch(/bun run build/)
  })

  it('ships a launcher that explains the Bun runtime requirement', () => {
    const launcherPath = resolve(ROOT, 'bin/pluxx.js')
    expect(existsSync(launcherPath)).toBe(true)

    const launcher = readFileSync(launcherPath, 'utf-8')
    expect(launcher).toContain('pluxx currently requires Bun at runtime.')
    expect(launcher).toContain("await import(pathToFileURL(cliPath).href)")
  })

  it('routes help through the published launcher', async () => {
    const proc = Bun.spawn(['bun', resolve(ROOT, 'bin/pluxx.js'), 'help'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(stdout).toContain('pluxx — Cross-platform AI agent plugin SDK')
    expect(stderr).toBe('')
  })
})
