import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { withWorkspaceMutationLock } from '../src/cli/mutation-lock'

describe('workspace mutation lock', () => {
  it('rejects a concurrent mutating process while allowing nested work', async () => {
    const root = mkdtempSync(resolve(tmpdir(), 'pluxx-mutation-lock-'))
    mkdirSync(resolve(root, '.pluxx'), { recursive: true })
    let release!: () => void
    let enter!: () => void
    const held = new Promise<void>((resolvePromise) => { release = resolvePromise })
    const entered = new Promise<void>((resolvePromise) => { enter = resolvePromise })
    try {
      const first = withWorkspaceMutationLock(root, async () => {
        await withWorkspaceMutationLock(root, async () => undefined)
        enter()
        await held
      })
      await entered
      await expect(withWorkspaceMutationLock(root, async () => undefined)).rejects.toThrow(/another mutating pluxx run/i)
      release()
      await first
      await expect(withWorkspaceMutationLock(root, async () => 'released')).resolves.toBe('released')
    } finally {
      release()
      rmSync(root, { recursive: true, force: true })
    }
  })
})
