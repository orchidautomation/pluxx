import { AsyncLocalStorage } from 'async_hooks'
import { mkdir, open, readFile, rm } from 'fs/promises'
import { resolve } from 'path'
import { assertWorkspacePathNotSymlink } from '../text-files'

const LOCK_PATH = '.pluxx/mutation.lock'
const lockContext = new AsyncLocalStorage<Set<string>>()

export async function withWorkspaceMutationLock<T>(rootDir: string, task: () => Promise<T>): Promise<T> {
  const root = resolve(rootDir)
  if (lockContext.getStore()?.has(root)) return task()

  const lockPath = resolve(root, LOCK_PATH)
  await assertWorkspacePathNotSymlink(root, resolve(root, '.pluxx'))
  await mkdir(resolve(root, '.pluxx'), { recursive: true, mode: 0o700 })
  await clearStaleLock(lockPath)
  let handle: Awaited<ReturnType<typeof open>>
  try {
    handle = await open(lockPath, 'wx', 0o600)
  } catch (error) {
    if (isCode(error, 'EEXIST')) throw new Error('Another mutating Pluxx run is active in this workspace.')
    throw error
  }
  try {
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`)
    await handle.sync()
    const held = new Set(lockContext.getStore() ?? [])
    held.add(root)
    return await lockContext.run(held, task)
  } finally {
    await handle.close()
    await rm(lockPath, { force: true })
  }
}

async function clearStaleLock(lockPath: string): Promise<void> {
  let contents: string
  try {
    contents = await readFile(lockPath, 'utf8')
  } catch (error) {
    if (isCode(error, 'ENOENT')) return
    throw error
  }

  let parsed: { pid?: unknown }
  try {
    parsed = JSON.parse(contents) as { pid?: unknown }
  } catch {
    await rm(lockPath, { force: true })
    return
  }

  if (typeof parsed.pid === 'number' && Number.isSafeInteger(parsed.pid) && parsed.pid > 0) {
    try {
      process.kill(parsed.pid, 0)
      return
    } catch (error) {
      if (!isCode(error, 'ESRCH')) return
    }
  }
  await rm(lockPath, { force: true })
}

function isCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}
