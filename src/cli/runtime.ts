import * as clack from '@clack/prompts'

export interface CliRuntime {
  dryRun: boolean
  jsonOutput: boolean
  quiet: boolean
  isCI: boolean
  isTTY: boolean
  isInteractive: boolean
}

export function createCliRuntime(rawArgs: string[]): CliRuntime {
  const isCI = process.env.CI === '1' || process.env.CI === 'true'
  const isTTY = process.stdin.isTTY === true && process.stdout.isTTY === true

  return {
    dryRun: rawArgs.includes('--dry-run'),
    jsonOutput: rawArgs.includes('--json'),
    quiet: rawArgs.includes('--quiet'),
    isCI,
    isTTY,
    isInteractive: isTTY && !isCI,
  }
}

export function readFlag(rawArgs: string[], flag: string): boolean {
  return rawArgs.includes(flag)
}

export function readOption(rawArgs: string[], flag: string): string | undefined {
  const index = rawArgs.indexOf(flag)
  if (index === -1) return undefined

  const value = rawArgs[index + 1]
  if (!value || value.startsWith('-')) {
    return undefined
  }

  return value
}

export function readMultiValueOption(rawArgs: string[], flag: string): string[] | undefined {
  const index = rawArgs.indexOf(flag)
  if (index === -1) return undefined

  const values: string[] = []
  for (let i = index + 1; i < rawArgs.length; i += 1) {
    const value = rawArgs[i]
    if (value.startsWith('-')) break
    values.push(value)
  }

  return values.length > 0 ? values : undefined
}

export function createSpinner(runtime: CliRuntime): ReturnType<typeof clack.spinner> | undefined {
  if (runtime.jsonOutput || runtime.quiet || !runtime.isInteractive) {
    return undefined
  }

  return clack.spinner()
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2))
}

export function logInfo(runtime: CliRuntime, message: string): void {
  if (!runtime.jsonOutput && !runtime.quiet) {
    console.log(message)
  }
}

export function logWarn(runtime: CliRuntime, message: string): void {
  if (!runtime.jsonOutput && !runtime.quiet) {
    console.warn(message)
  }
}

export function logError(message: string): void {
  console.error(message)
}

export function formatPathList(paths: string[]): string {
  return paths.length > 0 ? paths.join(', ') : 'none'
}
