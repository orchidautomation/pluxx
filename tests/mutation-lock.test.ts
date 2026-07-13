import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
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
        expect(JSON.parse(readFileSync(resolve(root, '.pluxx', 'mutation.lock'), 'utf8'))).toEqual(expect.objectContaining({
          pid: process.pid,
          createdAt: expect.any(String),
        }))
        expect(readdirSync(resolve(root, '.pluxx')).filter((entry) => entry.startsWith('.mutation.lock-'))).toEqual([])
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

  it.each(['', '{"pid":'])('recovers from an incomplete lock file (%j)', async (contents) => {
    const root = mkdtempSync(resolve(tmpdir(), 'pluxx-mutation-lock-'))
    const lockPath = resolve(root, '.pluxx', 'mutation.lock')
    mkdirSync(resolve(root, '.pluxx'), { recursive: true })
    writeFileSync(lockPath, contents)
    try {
      await expect(withWorkspaceMutationLock(root, async () => 'recovered')).resolves.toBe('recovered')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('recovers a lock owned by an exited process', async () => {
    const root = mkdtempSync(resolve(tmpdir(), 'pluxx-mutation-lock-'))
    const lockPath = resolve(root, '.pluxx', 'mutation.lock')
    mkdirSync(resolve(root, '.pluxx'), { recursive: true })
    const child = Bun.spawn(['/bin/sh', '-c', 'exit 0'])
    await child.exited
    writeFileSync(lockPath, `${JSON.stringify({ pid: child.pid, createdAt: new Date().toISOString() })}\n`)
    try {
      await expect(withWorkspaceMutationLock(root, async () => 'recovered')).resolves.toBe('recovered')
      expect(readdirSync(resolve(root, '.pluxx')).filter((entry) => entry === 'mutation.lock')).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('serializes stale-lock recovery so only one contender mutates', async () => {
    const root = mkdtempSync(resolve(tmpdir(), 'pluxx-mutation-lock-'))
    const lockPath = resolve(root, '.pluxx', 'mutation.lock')
    mkdirSync(resolve(root, '.pluxx'), { recursive: true })
    writeFileSync(lockPath, `${JSON.stringify({ pid: 2_147_483_647, createdAt: new Date().toISOString() })}\n`)
    let entered = 0
    let release!: () => void
    let signalEntered!: () => void
    const held = new Promise<void>((resolvePromise) => { release = resolvePromise })
    const firstEntered = new Promise<void>((resolvePromise) => { signalEntered = resolvePromise })
    const task = () => withWorkspaceMutationLock(root, async () => {
      entered += 1
      signalEntered()
      await held
    })
    try {
      const settled = Promise.allSettled([task(), task()])
      await firstEntered
      expect(entered).toBe(1)
      release()
      const results = await settled
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    } finally {
      release()
      rmSync(root, { recursive: true, force: true })
    }
  })
})
