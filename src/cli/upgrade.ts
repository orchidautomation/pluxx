import { spawnSync } from 'child_process'
import { existsSync, readFileSync, realpathSync } from 'fs'
import { dirname, parse, resolve } from 'path'

export interface UpgradeCommandResult {
  status: number | null
  stdout: string
  stderr: string
}

export type UpgradeCommandRunner = (command: string, args: string[]) => UpgradeCommandResult
export type UpgradeInvocationSource = 'npm-global' | 'npx-cache' | 'repo-source' | 'unknown'
export type UpgradeComparison = 'upgrade' | 'downgrade' | 'current' | 'unknown'

export interface UpgradePlan {
  dryRun: boolean
  packageName: string
  currentVersion: string
  requestedVersion: string
  resolvedVersion?: string
  comparison: UpgradeComparison
  invocationPath: string
  invocationSource: UpgradeInvocationSource
  activePathBefore?: string
  specifier: string
  command: string[]
  rollbackCommand: string[]
  note: string
  warning?: string
  error?: string
}

export interface UpgradeExecutionResult extends UpgradePlan {
  ok: boolean
  activePathAfter?: string
  activeVersionAfter?: string
  activePackageAfter?: string
  installExitCode?: number
  detail: string
}

const UPGRADE_COMMAND_TIMEOUT_MS = 120_000

function defaultRunner(command: string, args: string[]): UpgradeCommandResult {
  const result = spawnSync(command, args, {
    encoding: 'utf-8',
    env: process.env,
    timeout: UPGRADE_COMMAND_TIMEOUT_MS,
    killSignal: 'SIGTERM',
  })
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.error?.message || result.stderr || '',
  }
}

export function classifyUpgradeInvocationSource(filepath: string): UpgradeInvocationSource {
  const normalized = filepath.replace(/\\/g, '/')
  if (normalized.includes('/_npx/') || normalized.includes('/.npm/_npx/')) return 'npx-cache'
  if (normalized.includes('/node_modules/')) return 'npm-global'
  if (normalized.endsWith('/bin/pluxx.js')) return 'repo-source'
  return 'unknown'
}

interface ParsedVersion {
  core: [bigint, bigint, bigint]
  prerelease: string[]
}

function parseVersion(value: string | undefined): ParsedVersion | undefined {
  const match = value?.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/)
  if (!match) return undefined
  const prerelease = match[4]?.split('.') ?? []
  if (prerelease.some((identifier) => /^\d+$/.test(identifier) && identifier.length > 1 && identifier.startsWith('0'))) return undefined
  return {
    core: [BigInt(match[1]), BigInt(match[2]), BigInt(match[3])],
    prerelease,
  }
}

export function compareUpgradeVersions(current: string, target: string | undefined): UpgradeComparison {
  const left = parseVersion(current)
  const right = parseVersion(target)
  if (!left || !right) return 'unknown'
  for (let index = 0; index < left.core.length; index += 1) {
    if (right.core[index] > left.core[index]) return 'upgrade'
    if (right.core[index] < left.core[index]) return 'downgrade'
  }
  if (left.prerelease.length === 0 && right.prerelease.length === 0) return 'current'
  if (left.prerelease.length === 0) return 'downgrade'
  if (right.prerelease.length === 0) return 'upgrade'
  const length = Math.max(left.prerelease.length, right.prerelease.length)
  for (let index = 0; index < length; index += 1) {
    const current = left.prerelease[index]
    const target = right.prerelease[index]
    if (current === undefined) return 'upgrade'
    if (target === undefined) return 'downgrade'
    if (current === target) continue
    const currentNumeric = /^\d+$/.test(current)
    const targetNumeric = /^\d+$/.test(target)
    if (currentNumeric && targetNumeric) return BigInt(target) > BigInt(current) ? 'upgrade' : 'downgrade'
    if (currentNumeric !== targetNumeric) return targetNumeric ? 'downgrade' : 'upgrade'
    return target > current ? 'upgrade' : 'downgrade'
  }
  return 'current'
}

function parseViewedVersion(result: UpgradeCommandResult): string | undefined {
  if (result.status !== 0) return undefined
  const normalized = result.stdout.trim().replace(/^"|"$/g, '')
  return parseVersion(normalized) ? normalized : undefined
}

export function planUpgrade(options: {
  packageName: string
  currentVersion: string
  requestedVersion?: string
  dryRun?: boolean
  invocationPath: string
  resolveRequestedVersion?: boolean
  runCommand?: UpgradeCommandRunner
}): UpgradePlan {
  const runCommand = options.runCommand ?? defaultRunner
  const requestedVersion = options.requestedVersion ?? 'latest'
  const requestedIsValid = requestedVersion === 'latest' || Boolean(parseVersion(requestedVersion))
  const specifier = `${options.packageName}@${requestedVersion}`
  const viewed = options.resolveRequestedVersion === false || !requestedIsValid || requestedVersion !== 'latest'
    ? undefined
    : runCommand('npm', ['view', specifier, 'version', '--json'])
  const resolvedVersion = viewed ? parseViewedVersion(viewed) : parseVersion(requestedVersion) ? requestedVersion : undefined
  const active = runCommand(process.platform === 'win32' ? 'where' : 'which', ['pluxx'])
  const comparison = compareUpgradeVersions(options.currentVersion, resolvedVersion)
  const resolutionRequired = options.resolveRequestedVersion !== false

  return {
    dryRun: options.dryRun ?? false,
    packageName: options.packageName,
    currentVersion: options.currentVersion,
    requestedVersion,
    resolvedVersion,
    comparison,
    invocationPath: options.invocationPath,
    invocationSource: classifyUpgradeInvocationSource(options.invocationPath),
    activePathBefore: active.status === 0 ? active.stdout.trim().split(/\r?\n/)[0] : undefined,
    specifier,
    command: [process.platform === 'win32' ? 'npm.cmd' : 'npm', 'install', '-g', specifier],
    rollbackCommand: [process.platform === 'win32' ? 'npm.cmd' : 'npm', 'install', '-g', `${options.packageName}@${options.currentVersion}`],
    note: 'This updates the global npm install used by `pluxx` on PATH. Repo-local and npx invocations are separate entrypoints.',
    ...(comparison === 'downgrade'
      ? { warning: `Requested ${resolvedVersion} is older than current ${options.currentVersion}; this is a downgrade.` }
      : {}),
    ...(!requestedIsValid
      ? { error: `Invalid upgrade version "${requestedVersion}". Use latest or an exact semantic version.` }
      : resolutionRequired && !resolvedVersion
        ? { error: `Unable to resolve ${specifier} to an exact semantic version; refusing to install an unverified specifier.` }
        : {}),
  }
}

export interface ActiveCliIdentity {
  path: string
  realPath: string
  packageName?: string
  version?: string
}

export function readActiveCliIdentity(filepath: string): ActiveCliIdentity {
  const realPath = realpathSync(filepath)
  let current = dirname(realPath)
  const root = parse(current).root
  while (current !== root) {
    const packagePath = resolve(current, 'package.json')
    if (existsSync(packagePath)) {
      try {
        const payload = JSON.parse(readFileSync(packagePath, 'utf-8')) as { name?: unknown; version?: unknown }
        if (typeof payload.name === 'string' || typeof payload.version === 'string') {
          return {
            path: filepath,
            realPath,
            packageName: typeof payload.name === 'string' ? payload.name : undefined,
            version: typeof payload.version === 'string' ? payload.version : undefined,
          }
        }
      } catch {
        // Keep walking toward the package root.
      }
    }
    current = dirname(current)
  }
  return { path: filepath, realPath }
}

export function executeUpgrade(
  plan: UpgradePlan,
  runCommand: UpgradeCommandRunner = defaultRunner,
  inspectActiveCli: (filepath: string) => ActiveCliIdentity = readActiveCliIdentity,
): UpgradeExecutionResult {
  if (plan.error) {
    return {
      ...plan,
      ok: false,
      detail: `${plan.error} Roll back with: ${plan.rollbackCommand.join(' ')}`,
    }
  }
  const install = runCommand(plan.command[0], plan.command.slice(1))
  if (install.status !== 0) {
    const failure = install.stderr || install.stdout || 'Upgrade failed.'
    return {
      ...plan,
      ok: false,
      installExitCode: install.status ?? 1,
      detail: `${failure.trim()} Roll back with: ${plan.rollbackCommand.join(' ')}`,
    }
  }

  const which = runCommand(process.platform === 'win32' ? 'where' : 'which', ['pluxx'])
  const activePathAfter = which.status === 0 ? which.stdout.trim().split(/\r?\n/)[0] : undefined
  let activeIdentity: ActiveCliIdentity | undefined
  try {
    activeIdentity = activePathAfter ? inspectActiveCli(activePathAfter) : undefined
  } catch {
    activeIdentity = undefined
  }
  const activeVersionAfter = activeIdentity?.version
  const activePackageAfter = activeIdentity?.packageName
  const expectedVersion = plan.resolvedVersion ?? (parseVersion(plan.requestedVersion) ? plan.requestedVersion : undefined)
  const verified = Boolean(
    activePathAfter
    && activeVersionAfter
    && activePackageAfter === plan.packageName
    && expectedVersion
    && activeVersionAfter === expectedVersion,
  )

  return {
    ...plan,
    ok: verified,
    activePathAfter,
    activeVersionAfter,
    activePackageAfter,
    installExitCode: install.status ?? 0,
    detail: verified
      ? `Active PATH binary is ${activePathAfter} at version ${activeVersionAfter}.`
      : `Global install completed, but the active PATH binary/version could not be verified as ${expectedVersion ?? plan.requestedVersion}. Roll back with: ${plan.rollbackCommand.join(' ')}`,
  }
}
