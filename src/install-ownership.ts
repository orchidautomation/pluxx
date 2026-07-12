import { createHash, randomBytes } from 'crypto'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  renameSync,
  rmSync,
  rmdirSync,
  symlinkSync,
  writeFileSync,
  cpSync,
} from 'fs'
import { homedir } from 'os'
import { dirname, relative, resolve, sep } from 'path'
import type { TargetPlatform } from './schema'

const INSTALL_OWNERSHIP_SCHEMA = 'pluxx.install-ownership.v1'

export interface InstallOwnedEntry {
  path: string
  kind: 'file' | 'symlink'
  sha256: string
}

export interface InstallOwnership {
  schema: typeof INSTALL_OWNERSHIP_SCHEMA
  pluginName: string
  platform: TargetPlatform
  installPath: string
  kind: 'copy' | 'symlink'
  symlinkTarget?: string
  entries: InstallOwnedEntry[]
}

export interface InstallRemovalResult {
  changed: boolean
  removed: string[]
  preserved: string[]
  ownershipPath: string
}

function hash(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function isInside(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}${sep}`)
}

function safeRelativePath(path: string): boolean {
  if (!path || path.startsWith('/') || path.startsWith('\\')) return false
  const normalized = path.replace(/\\/g, '/')
  return normalized !== '..' && !normalized.startsWith('../') && !normalized.includes('/../')
}

function resolveOwnedPath(root: string, relativePath: string): string {
  if (!safeRelativePath(relativePath)) throw new Error(`Unsafe install ownership path "${relativePath}".`)
  const path = resolve(root, relativePath)
  if (path === root || !isInside(path, root)) throw new Error(`Unsafe install ownership path "${relativePath}".`)
  return path
}

function validateIdentity(value: string, label: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
    throw new Error(`Invalid ${label} "${value}" for install ownership.`)
  }
  return value
}

export function getInstallOwnershipPath(
  pluginName: string,
  platform: TargetPlatform,
  home = process.env.HOME?.trim() || homedir(),
): string {
  return resolve(home, '.pluxx/install-ownership', validateIdentity(pluginName, 'plugin name'), `${validateIdentity(platform, 'platform')}.json`)
}

export function collectInstallEntries(root: string): InstallOwnedEntry[] {
  if (!existsSync(root)) return []
  const entries: InstallOwnedEntry[] = []

  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolutePath = resolve(directory, entry.name)
      const relativePath = relative(root, absolutePath).replace(/\\/g, '/')
      const stats = lstatSync(absolutePath)
      if (stats.isSymbolicLink()) {
        entries.push({ path: relativePath, kind: 'symlink', sha256: hash(readlinkSync(absolutePath)) })
      } else if (stats.isDirectory()) {
        visit(absolutePath)
      } else if (stats.isFile()) {
        entries.push({ path: relativePath, kind: 'file', sha256: hash(readFileSync(absolutePath)) })
      }
    }
  }

  if (lstatSync(root).isDirectory()) visit(root)
  return entries
}

export function hashInstallBundle(root: string): string {
  const digest = createHash('sha256')
  for (const entry of collectInstallEntries(root)) {
    digest.update(entry.path)
    digest.update('\0')
    digest.update(entry.kind)
    digest.update('\0')
    digest.update(entry.sha256)
    digest.update('\0')
  }
  return digest.digest('hex')
}

export function readInstallOwnership(
  pluginName: string,
  platform: TargetPlatform,
  installPath: string,
): InstallOwnership | undefined {
  const ownershipPath = getInstallOwnershipPath(pluginName, platform)
  if (!existsSync(ownershipPath)) return undefined
  try {
    const parsed = JSON.parse(readFileSync(ownershipPath, 'utf-8')) as Partial<InstallOwnership>
    if (
      parsed.schema !== INSTALL_OWNERSHIP_SCHEMA
      || parsed.pluginName !== pluginName
      || parsed.platform !== platform
      || resolve(parsed.installPath ?? '') !== resolve(installPath)
      || (parsed.kind !== 'copy' && parsed.kind !== 'symlink')
      || !Array.isArray(parsed.entries)
    ) throw new Error('unexpected ownership schema or identity')
    for (const entry of parsed.entries) {
      if (!entry || !safeRelativePath(entry.path) || !['file', 'symlink'].includes(entry.kind) || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
        throw new Error('invalid owned entry')
      }
      resolveOwnedPath(resolve(installPath), entry.path)
    }
    if (parsed.kind === 'symlink' && typeof parsed.symlinkTarget !== 'string') throw new Error('missing symlink target')
    return parsed as InstallOwnership
  } catch (error) {
    throw new Error(`Cannot use install ownership record ${ownershipPath}: ${String(error)}`)
  }
}

function writeOwnership(record: InstallOwnership): void {
  const path = getInstallOwnershipPath(record.pluginName, record.platform)
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${process.pid}-${randomBytes(4).toString('hex')}`
  writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 })
  renameSync(temporary, path)
}

function buildOwnership(pluginName: string, platform: TargetPlatform, installPath: string, kind: 'copy' | 'symlink'): InstallOwnership {
  const resolvedPath = resolve(installPath)
  return {
    schema: INSTALL_OWNERSHIP_SCHEMA,
    pluginName,
    platform,
    installPath: resolvedPath,
    kind,
    ...(kind === 'symlink' ? { symlinkTarget: readlinkSync(resolvedPath) } : {}),
    entries: kind === 'copy' ? collectInstallEntries(resolvedPath) : [],
  }
}

export function listInstallOwnershipDrift(record: InstallOwnership): string[] {
  const installPath = resolve(record.installPath)
  if (!existsSync(installPath)) return ['installed path is missing']
  const details = lstatSync(installPath)
  if (record.kind === 'symlink') {
    if (!details.isSymbolicLink()) return ['installed path is no longer the owned symlink']
    return readlinkSync(installPath) === record.symlinkTarget ? [] : ['installed symlink target was modified']
  }
  if (!details.isDirectory() || details.isSymbolicLink()) return ['installed path is no longer the owned copied directory']

  const expected = new Map(record.entries.map((entry) => [entry.path, entry]))
  const actual = new Map(collectInstallEntries(installPath).map((entry) => [entry.path, entry]))
  const drift: string[] = []
  for (const [path, entry] of expected) {
    const current = actual.get(path)
    if (!current) drift.push(`owned file is missing: ${path}`)
    else if (current.kind !== entry.kind || current.sha256 !== entry.sha256) drift.push(`owned file was modified: ${path}`)
  }
  for (const path of actual.keys()) if (!expected.has(path)) drift.push(`unowned file is present: ${path}`)
  return drift
}

export function assertInstallReplaceable(pluginName: string, platform: TargetPlatform, installPath: string): void {
  if (!existsSync(installPath)) return
  const details = lstatSync(installPath)
  const ownership = readInstallOwnership(pluginName, platform, installPath)
  if (!ownership) {
    if (details.isSymbolicLink()) return
    throw new Error(`Refusing to replace unowned install at ${installPath}. Move it aside or uninstall it manually, then retry.`)
  }
  const drift = listInstallOwnershipDrift(ownership)
  if (drift.length > 0) {
    throw new Error(`Refusing to replace modified install at ${installPath}: ${drift.join('; ')}`)
  }
}

export function transactionalInstall(options: {
  pluginName: string
  platform: TargetPlatform
  sourcePath: string
  installPath: string
  kind: 'copy' | 'symlink'
  prepare?: (stagePath: string) => void
  validate?: (path: string) => void
}): InstallOwnership {
  const installPath = resolve(options.installPath)
  const parent = dirname(installPath)
  mkdirSync(parent, { recursive: true })
  assertInstallReplaceable(options.pluginName, options.platform, installPath)
  const nonce = `${process.pid}-${randomBytes(5).toString('hex')}`
  const stagePath = resolve(parent, `.${options.pluginName}.pluxx-stage-${nonce}`)
  const backupPath = resolve(parent, `.${options.pluginName}.pluxx-backup-${nonce}`)
  let movedPrevious = false
  let installedCandidate = false

  try {
    if (options.kind === 'symlink') symlinkSync(resolve(options.sourcePath), stagePath)
    else cpSync(options.sourcePath, stagePath, { recursive: true })
    options.prepare?.(stagePath)
    options.validate?.(stagePath)
    if (existsSync(installPath)) {
      renameSync(installPath, backupPath)
      movedPrevious = true
    }
    renameSync(stagePath, installPath)
    installedCandidate = true
    options.validate?.(installPath)
    const ownership = buildOwnership(options.pluginName, options.platform, installPath, options.kind)
    writeOwnership(ownership)
    if (movedPrevious) {
      try {
        rmSync(backupPath, { recursive: true, force: true })
      } catch {
        // The committed install and ownership are valid; leave the recoverable backup in place.
      }
    }
    return ownership
  } catch (error) {
    if (installedCandidate && existsSync(installPath)) rmSync(installPath, { recursive: true, force: true })
    if (movedPrevious && existsSync(backupPath)) renameSync(backupPath, installPath)
    throw error
  } finally {
    if (existsSync(stagePath)) rmSync(stagePath, { recursive: true, force: true })
  }
}

function pruneEmptyParents(path: string, root: string): void {
  let current = dirname(path)
  while (current !== root && isInside(current, root)) {
    try { rmdirSync(current) } catch { break }
    current = dirname(current)
  }
}

export function removeOwnedInstall(pluginName: string, platform: TargetPlatform, installPath: string): InstallRemovalResult {
  const ownershipPath = getInstallOwnershipPath(pluginName, platform)
  const record = readInstallOwnership(pluginName, platform, installPath)
  if (!record) return { changed: false, removed: [], preserved: existsSync(installPath) ? [installPath] : [], ownershipPath }
  const root = resolve(installPath)
  const removed: string[] = []
  const preserved: string[] = []

  if (record.kind === 'symlink') {
    if (existsSync(root) && lstatSync(root).isSymbolicLink() && readlinkSync(root) === record.symlinkTarget) {
      rmSync(root, { force: true })
      removed.push(root)
    } else if (existsSync(root)) preserved.push(root)
  } else if (existsSync(root)) {
    const expected = new Map(record.entries.map((entry) => [entry.path, entry]))
    for (const entry of [...record.entries].sort((a, b) => b.path.localeCompare(a.path))) {
      const path = resolveOwnedPath(root, entry.path)
      if (!existsSync(path)) continue
      const details = lstatSync(path)
      const currentKind = details.isSymbolicLink() ? 'symlink' : details.isFile() ? 'file' : undefined
      const currentHash = currentKind === 'symlink' ? hash(readlinkSync(path)) : currentKind === 'file' ? hash(readFileSync(path)) : undefined
      if (currentKind === entry.kind && currentHash === entry.sha256) {
        rmSync(path, { force: true })
        removed.push(entry.path)
        pruneEmptyParents(path, root)
      } else preserved.push(entry.path)
    }
    for (const entry of collectInstallEntries(root)) if (!expected.has(entry.path) && !preserved.includes(entry.path)) preserved.push(entry.path)
    try { rmdirSync(root) } catch { /* Modified or unowned content remains. */ }
  }

  rmSync(ownershipPath, { force: true })
  return { changed: removed.length > 0, removed, preserved, ownershipPath }
}
