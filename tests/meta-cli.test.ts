import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')
const CLI_PATH = resolve(ROOT, 'bin/pluxx.js')
const PACKAGE_VERSION = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8')) as { version: string }

function spawnCli(argv: string[]) {
  return Bun.spawn(['bun', CLI_PATH, ...argv], {
    cwd: ROOT,
    env: {
      ...process.env,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })
}

describe('CLI lifecycle helpers', () => {
  it('prints the installed version for --version', async () => {
    const proc = spawnCli(['--version'])
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(stdout.trim()).toBe(PACKAGE_VERSION.version)
    expect(stderr).toBe('')
  })

  it('prints the installed version for -v', async () => {
    const proc = spawnCli(['-v'])
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(stdout.trim()).toBe(PACKAGE_VERSION.version)
    expect(stderr).toBe('')
  })

  it('prints the installed version for the version command', async () => {
    const proc = spawnCli(['version', '--json'])
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(JSON.parse(stdout)).toEqual({ version: PACKAGE_VERSION.version })
    expect(stderr).toBe('')
  })

  it('plans a global npm upgrade in dry-run mode', async () => {
    const proc = spawnCli(['upgrade', '--dry-run', '--json'])
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    const result = JSON.parse(stdout) as {
      dryRun: boolean
      packageName: string
      currentVersion: string
      requestedVersion: string
      specifier: string
      command: string[]
      note: string
    }

    expect(exitCode).toBe(0)
    expect(result.dryRun).toBe(true)
    expect(result.packageName).toBe('@orchid-labs/pluxx')
    expect(result.currentVersion).toBe(PACKAGE_VERSION.version)
    expect(result.requestedVersion).toBe('latest')
    expect(result.specifier).toBe('@orchid-labs/pluxx@latest')
    expect(result.command[1]).toBe('install')
    expect(result.command[2]).toBe('-g')
    expect(result.command[3]).toBe('@orchid-labs/pluxx@latest')
    expect(result.note).toContain('global npm install')
    expect(stderr).toBe('')
  })

  it('supports the --upgrade alias in dry-run mode', async () => {
    const proc = spawnCli(['--upgrade', '--dry-run', '--json', '--version', '0.1.5'])
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    const result = JSON.parse(stdout) as {
      requestedVersion: string
      specifier: string
      command: string[]
    }

    expect(exitCode).toBe(0)
    expect(result.requestedVersion).toBe('0.1.5')
    expect(result.specifier).toBe('@orchid-labs/pluxx@0.1.5')
    expect(result.command[3]).toBe('@orchid-labs/pluxx@0.1.5')
    expect(stderr).toBe('')
  })
})
