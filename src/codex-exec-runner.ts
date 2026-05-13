import { existsSync, readFileSync } from 'fs'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { basename, resolve } from 'path'
import { spawn } from 'child_process'

export interface CodexExecRunResult {
  exitCode: number
  response: string
  stdout: string
  stderr: string
  lastMessage: string
  timedOut: boolean
  killedAfterFinalMessage: boolean
  forcedKillAfterFinalMessage: boolean
  sawTurnCompleted: boolean
  sawTurnFailed: boolean
  eventTypes: string[]
}

export interface CodexExecRunOptions {
  cwd: string
  timeoutMs: number
  env?: NodeJS.ProcessEnv
  outputDirPrefix?: string
}

export async function executeCodexExecCommand(
  command: string[],
  options: CodexExecRunOptions,
): Promise<CodexExecRunResult> {
  if (basename(command[0]) !== 'codex' || command[1] !== 'exec') {
    throw new Error('Codex exec runner requires a command beginning with `codex exec`.')
  }

  const outputDir = await mkdtemp(resolve(tmpdir(), options.outputDirPrefix ?? 'pluxx-codex-exec-'))
  const lastMessagePath = resolve(outputDir, 'last-message.txt')
  const runtimeCommand = [...command]
  runtimeCommand.splice(2, 0, '--json', '--output-last-message', lastMessagePath)

  try {
    return await new Promise((resolvePromise, reject) => {
      const startedAt = Date.now()
      const child = spawn(runtimeCommand[0], runtimeCommand.slice(1), {
        cwd: options.cwd,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: options.env ?? process.env,
      })

      const stdoutChunks: Buffer[] = []
      const stderrChunks: Buffer[] = []
      const eventTypes = new Set<string>()
      let stdoutBuffer = ''
      let sawTurnCompleted = false
      let sawTurnFailed = false
      let killedAfterFinalMessage = false
      let forcedKillAfterFinalMessage = false
      let sawFinalMessageAt: number | null = null
      let settled = false
      let timedOut = false
      const sentinelInterval = setInterval(() => {
        const finalMessage = readCodexLastMessage(lastMessagePath)
        const sawCompletionSignal = sawTurnCompleted
          || sawTurnFailed
          || finalMessage.length > 0
        if (!sawCompletionSignal) return
        if (sawFinalMessageAt == null) {
          sawFinalMessageAt = Date.now()
          return
        }
        const elapsed = Date.now() - sawFinalMessageAt
        if (!killedAfterFinalMessage && elapsed >= 250) {
          killedAfterFinalMessage = true
          signalSpawnedProcess(child, 'SIGTERM')
          return
        }
        if (!forcedKillAfterFinalMessage && elapsed >= 750) {
          forcedKillAfterFinalMessage = true
          signalSpawnedProcess(child, 'SIGKILL')
        }
      }, 100)
      const timeout = setTimeout(() => {
        if (readCodexLastMessage(lastMessagePath).length > 0) {
          killedAfterFinalMessage = true
        }
        timedOut = true
        signalSpawnedProcess(child, 'SIGKILL')
      }, options.timeoutMs)

      child.stdout?.on('data', (chunk) => {
        stdoutChunks.push(Buffer.from(chunk))

        const text = chunk.toString()
        const lines = (stdoutBuffer + text).split('\n')
        stdoutBuffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const event = JSON.parse(trimmed) as { type?: string }
            if (typeof event.type === 'string') {
              eventTypes.add(event.type)
            }
            if (event.type === 'turn.completed') {
              sawTurnCompleted = true
            } else if (event.type === 'turn.failed' || event.type === 'error') {
              sawTurnFailed = true
            }
          } catch {
            // Ignore non-JSON lines. Codex can still emit plain text alongside JSON events.
          }
        }
      })
      child.stderr?.on('data', (chunk) => stderrChunks.push(Buffer.from(chunk)))
      child.on('error', (error) => {
        if (settled) return
        settled = true
        clearInterval(sentinelInterval)
        clearTimeout(timeout)
        reject(error)
      })
      child.on('close', (code) => {
        if (settled) return
        settled = true
        clearInterval(sentinelInterval)
        clearTimeout(timeout)
        const elapsedMs = Date.now() - startedAt
        const exceededDeadline = timedOut || elapsedMs > options.timeoutMs
        const stdout = Buffer.concat(stdoutChunks).toString('utf-8')
        const stderr = Buffer.concat(stderrChunks).toString('utf-8')
        const lastMessage = readCodexLastMessage(lastMessagePath)
        const timeoutMessage = exceededDeadline && !killedAfterFinalMessage && !sawTurnCompleted
          ? `behavioral runner timed out after ${options.timeoutMs}ms`
          : ''
        const exitCode = sawTurnFailed
          ? 1
          : (killedAfterFinalMessage || sawTurnCompleted
              ? 0
              : exceededDeadline
                ? 124
                : (code ?? 1))
        resolvePromise({
          exitCode,
          response: lastMessage || timeoutMessage || stdout.trim() || stderr.trim(),
          stdout,
          stderr,
          lastMessage,
          timedOut: exceededDeadline && !killedAfterFinalMessage && !sawTurnCompleted,
          killedAfterFinalMessage,
          forcedKillAfterFinalMessage,
          sawTurnCompleted,
          sawTurnFailed,
          eventTypes: [...eventTypes],
        })
      })
    })
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
}

function readCodexLastMessage(path: string): string {
  if (!existsSync(path)) return ''
  return readFileSync(path, 'utf-8').trim()
}

function signalSpawnedProcess(
  child: ReturnType<typeof spawn>,
  signal: NodeJS.Signals,
): void {
  if (child.exitCode != null || child.signalCode != null) {
    return
  }

  if (process.platform !== 'win32' && typeof child.pid === 'number') {
    try {
      process.kill(-child.pid, signal)
      return
    } catch {
      // Fall back to signaling the direct child if the process group is gone.
    }
  }

  try {
    child.kill(signal)
  } catch {
    // Ignore signaling failures after the child exits.
  }
}
