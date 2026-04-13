import { describe, expect, it } from 'bun:test'
import { resolve } from 'path'

describe('init --from-mcp cancellation and lint severity handling', () => {
  it('passes the isolated CLI runner checks', async () => {
    const runner = './tests/helpers/cli-init-from-mcp-runner.ts'
    const proc = Bun.spawn(['bun', 'test', runner], {
      cwd: resolve(import.meta.dir, '..'),
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(`${stdout}${stderr}`).toContain('2 pass')
  })
})
