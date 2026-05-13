import { spawn } from 'child_process'

export function sanitizeTerminalTranscript(transcript: string): string {
  let output = transcript
  output = output.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
  output = output.replace(/\x1bP[\s\S]*?\x1b\\/g, '')
  output = output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
  output = output.replace(/\x1b[@-_]/g, '')
  output = stripBackspaces(output)
  output = output.replace(/[^\x09\x0a\x0d\x20-\x7E]/g, '')
  return output
}

export function signalSpawnedProcess(
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

function stripBackspaces(input: string): string {
  let output = input
  while (output.includes('\b')) {
    output = output.replace(/.\x08/g, '')
    output = output.replace(/\x08/g, '')
  }
  return output
}
