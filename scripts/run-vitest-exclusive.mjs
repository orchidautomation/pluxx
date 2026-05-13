import { closeSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const LOCK_PATH = resolve(ROOT, '.pluxx-vitest.lock')

function isProcessRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function readLockMetadata() {
  try {
    return JSON.parse(readFileSync(LOCK_PATH, 'utf-8'))
  } catch {
    return null
  }
}

function formatLockMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return null
  const pid = typeof metadata.pid === 'number' ? metadata.pid : 'unknown'
  const startedAt = typeof metadata.startedAt === 'string' ? metadata.startedAt : 'unknown time'
  const command = Array.isArray(metadata.command) ? metadata.command.join(' ') : 'unknown command'
  return `Active test run: pid=${pid}, startedAt=${startedAt}, command=${command}`
}

let lockFd

function releaseLock() {
  if (lockFd !== undefined) {
    try {
      closeSync(lockFd)
    } catch {
      // Best-effort cleanup.
    }
    lockFd = undefined
  }
  try {
    rmSync(LOCK_PATH, { force: true })
  } catch {
    // Best-effort cleanup.
  }
}

function acquireLock() {
  const existing = readLockMetadata()
  if (existing && !isProcessRunning(existing.pid)) {
    releaseLock()
  }

  try {
    lockFd = openSync(LOCK_PATH, 'wx')
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
      const metadata = formatLockMetadata(readLockMetadata())
      console.error('Refusing to start a second full Pluxx test run in the same worktree.')
      console.error('This suite uses repo-local fixtures and should be serialized per worktree.')
      if (metadata) console.error(metadata)
      process.exit(1)
    }
    throw error
  }

  const metadata = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    command: ['vitest', 'run', ...process.argv.slice(2)],
  }
  writeFileSync(lockFd, `${JSON.stringify(metadata, null, 2)}\n`, 'utf-8')
}

acquireLock()

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    releaseLock()
    process.exit(1)
  })
}

process.on('exit', releaseLock)
process.on('uncaughtException', (error) => {
  releaseLock()
  throw error
})
process.on('unhandledRejection', (error) => {
  releaseLock()
  throw error
})

const child = spawn(
  process.execPath,
  [resolve(ROOT, 'node_modules/vitest/vitest.mjs'), 'run', ...process.argv.slice(2)],
  {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  },
)

child.on('exit', (code, signal) => {
  releaseLock()
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
