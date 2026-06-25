import { TargetPlatform as TargetPlatformSchema, type TargetPlatform } from './schema'

export const INSTALL_REFERENCE_SCHEMES = ['local', 'github', 'npm', 'team'] as const

export type InstallReferenceScheme = typeof INSTALL_REFERENCE_SCHEMES[number]

interface BaseInstallReference {
  raw: string
  scheme: InstallReferenceScheme
  locator: string
  version?: string
  target?: TargetPlatform
  normalized: string
}

export interface LocalInstallReference extends BaseInstallReference {
  scheme: 'local'
  path: string
}

export interface GitHubInstallReference extends BaseInstallReference {
  scheme: 'github'
  owner: string
  repo: string
}

export interface NpmInstallReference extends BaseInstallReference {
  scheme: 'npm'
  packageName: string
}

export interface TeamInstallReference extends BaseInstallReference {
  scheme: 'team'
  team: string
  plugin: string
}

export type ParsedInstallReference =
  | LocalInstallReference
  | GitHubInstallReference
  | NpmInstallReference
  | TeamInstallReference

const INSTALL_REFERENCE_HELP =
  'Install references must use <scheme>:<locator>[@<version>][#<target>] with scheme local, github, npm, or team.'

const OWNER_PAIR_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const NPM_PACKAGE_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+:/-]*$/

export function parseInstallReference(rawReference: string): ParsedInstallReference {
  const raw = rawReference.trim()
  if (!raw) {
    throw installReferenceError('Provide an install reference.')
  }

  const schemeSeparator = raw.indexOf(':')
  if (schemeSeparator <= 0) {
    throw installReferenceError('Install reference is missing a scheme.')
  }

  const rawScheme = raw.slice(0, schemeSeparator)
  if (!isInstallReferenceScheme(rawScheme)) {
    throw installReferenceError(`Unsupported install reference scheme "${rawScheme}".`)
  }

  const rest = raw.slice(schemeSeparator + 1)
  const { body, target } = splitInstallReferenceTarget(rest)
  if (!body) {
    throw installReferenceError(`Install reference "${rawScheme}:" is missing a locator.`)
  }

  if (rawScheme === 'local') {
    return buildLocalInstallReference(raw, body, target)
  }

  const { locator, version } = splitInstallReferenceVersion(body)
  if (!locator) {
    throw installReferenceError(`Install reference "${rawScheme}:" is missing a locator before the version.`)
  }
  validateInstallReferenceVersion(version)

  switch (rawScheme) {
    case 'github':
      return buildGitHubInstallReference(raw, locator, version, target)
    case 'npm':
      return buildNpmInstallReference(raw, locator, version, target)
    case 'team':
      return buildTeamInstallReference(raw, locator, version, target)
  }
}

export function formatInstallReference(reference: ParsedInstallReference): string {
  return reference.normalized
}

function buildLocalInstallReference(raw: string, locator: string, target?: TargetPlatform): LocalInstallReference {
  return {
    raw,
    scheme: 'local',
    locator,
    path: locator,
    ...(target ? { target } : {}),
    normalized: normalizeInstallReference('local', locator, undefined, target),
  }
}

function buildGitHubInstallReference(
  raw: string,
  locator: string,
  version?: string,
  target?: TargetPlatform,
): GitHubInstallReference {
  if (!OWNER_PAIR_PATTERN.test(locator)) {
    throw installReferenceError('GitHub install references must look like github:<owner>/<repo>[@<version>][#<target>].')
  }

  const [owner, repo] = locator.split('/') as [string, string]
  return {
    raw,
    scheme: 'github',
    locator,
    owner,
    repo,
    ...(version ? { version } : {}),
    ...(target ? { target } : {}),
    normalized: normalizeInstallReference('github', locator, version, target),
  }
}

function buildNpmInstallReference(
  raw: string,
  locator: string,
  version?: string,
  target?: TargetPlatform,
): NpmInstallReference {
  if (!NPM_PACKAGE_PATTERN.test(locator)) {
    throw installReferenceError('npm install references must look like npm:<package>[@<version>][#<target>].')
  }

  return {
    raw,
    scheme: 'npm',
    locator,
    packageName: locator,
    ...(version ? { version } : {}),
    ...(target ? { target } : {}),
    normalized: normalizeInstallReference('npm', locator, version, target),
  }
}

function buildTeamInstallReference(
  raw: string,
  locator: string,
  version?: string,
  target?: TargetPlatform,
): TeamInstallReference {
  if (!OWNER_PAIR_PATTERN.test(locator)) {
    throw installReferenceError('Team install references must look like team:<team>/<plugin>[@<version>][#<target>].')
  }

  const [team, plugin] = locator.split('/') as [string, string]
  return {
    raw,
    scheme: 'team',
    locator,
    team,
    plugin,
    ...(version ? { version } : {}),
    ...(target ? { target } : {}),
    normalized: normalizeInstallReference('team', locator, version, target),
  }
}

function splitInstallReferenceTarget(input: string): { body: string; target?: TargetPlatform } {
  const targetSeparator = input.lastIndexOf('#')
  if (targetSeparator === -1) return { body: input }

  const body = input.slice(0, targetSeparator).trim()
  const rawTarget = input.slice(targetSeparator + 1).trim()
  if (!rawTarget) {
    throw installReferenceError('Install reference target cannot be empty after "#".')
  }

  const parsedTarget = TargetPlatformSchema.safeParse(rawTarget)
  if (!parsedTarget.success) {
    throw installReferenceError(`Unknown install reference target "${rawTarget}".`)
  }

  return { body, target: parsedTarget.data }
}

function splitInstallReferenceVersion(input: string): { locator: string; version?: string } {
  const versionSeparator = input.lastIndexOf('@')
  if (versionSeparator <= 0) {
    return { locator: input.trim() }
  }

  const locator = input.slice(0, versionSeparator).trim()
  const version = input.slice(versionSeparator + 1).trim()
  if (!version) {
    throw installReferenceError('Install reference version cannot be empty after "@".')
  }

  return { locator, version }
}

function validateInstallReferenceVersion(version?: string): void {
  if (!version) return
  if (!VERSION_PATTERN.test(version)) {
    throw installReferenceError(`Install reference version "${version}" is not valid.`)
  }
}

function normalizeInstallReference(
  scheme: InstallReferenceScheme,
  locator: string,
  version?: string,
  target?: TargetPlatform,
): string {
  return `${scheme}:${locator}${version ? `@${version}` : ''}${target ? `#${target}` : ''}`
}

function isInstallReferenceScheme(value: string): value is InstallReferenceScheme {
  return (INSTALL_REFERENCE_SCHEMES as readonly string[]).includes(value)
}

function installReferenceError(message: string): Error {
  return new Error(`${message} ${INSTALL_REFERENCE_HELP}`)
}
