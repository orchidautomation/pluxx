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
  surface?: string
  kind: 'copy' | 'file' | 'symlink'
  symlinkTarget?: string
  rootSha256?: string
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
  surface?: string,
): string {
  const suffix = surface ? `--${validateIdentity(surface, 'install surface')}` : ''
  return resolve(home, '.pluxx/install-ownership', validateIdentity(pluginName, 'plugin name'), `${validateIdentity(platform, 'platform')}${suffix}.json`)
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
  surface?: string,
): InstallOwnership | undefined {
  const ownershipPath = getInstallOwnershipPath(pluginName, platform, undefined, surface)
  if (!existsSync(ownershipPath)) return undefined
  try {
    const parsed = JSON.parse(readFileSync(ownershipPath, 'utf-8')) as Partial<InstallOwnership>
    if (
      parsed.schema !== INSTALL_OWNERSHIP_SCHEMA
      || parsed.pluginName !== pluginName
      || parsed.platform !== platform
      || parsed.surface !== surface
      || resolve(parsed.installPath ?? '') !== resolve(installPath)
      || !['copy', 'file', 'symlink'].includes(parsed.kind ?? '')
      || !Array.isArray(parsed.entries)
    ) throw new Error('unexpected ownership schema or identity')
    for (const entry of parsed.entries) {
      if (!entry || !safeRelativePath(entry.path) || !['file', 'symlink'].includes(entry.kind) || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
        throw new Error('invalid owned entry')
      }
      resolveOwnedPath(resolve(installPath), entry.path)
    }
    if (parsed.kind === 'symlink' && typeof parsed.symlinkTarget !== 'string') throw new Error('missing symlink target')
    if (parsed.kind === 'file' && !/^[a-f0-9]{64}$/.test(parsed.rootSha256 ?? '')) throw new Error('missing file hash')
    return parsed as InstallOwnership
  } catch (error) {
    throw new Error(`Cannot use install ownership record ${ownershipPath}: ${String(error)}`)
  }
}

function writeOwnership(record: InstallOwnership): void {
  const path = getInstallOwnershipPath(record.pluginName, record.platform, undefined, record.surface)
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${process.pid}-${randomBytes(4).toString('hex')}`
  writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 })
  renameSync(temporary, path)
}

function buildOwnership(
  pluginName: string,
  platform: TargetPlatform,
  installPath: string,
  kind: 'copy' | 'file' | 'symlink',
  surface?: string,
): InstallOwnership {
  const resolvedPath = resolve(installPath)
  return {
    schema: INSTALL_OWNERSHIP_SCHEMA,
    pluginName,
    platform,
    installPath: resolvedPath,
    kind,
    ...(surface ? { surface } : {}),
    ...(kind === 'symlink' ? { symlinkTarget: readlinkSync(resolvedPath) } : {}),
    ...(kind === 'file' ? { rootSha256: hash(readFileSync(resolvedPath)) } : {}),
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
  if (record.kind === 'file') {
    if (!details.isFile() || details.isSymbolicLink()) return ['installed path is no longer the owned file']
    return hash(readFileSync(installPath)) === record.rootSha256 ? [] : ['owned file was modified']
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

export function assertInstallReplaceable(pluginName: string, platform: TargetPlatform, installPath: string, surface?: string): void {
  if (!existsSync(installPath)) return
  const details = lstatSync(installPath)
  const ownership = readInstallOwnership(pluginName, platform, installPath, surface)
  if (!ownership) {
    if (!surface && details.isSymbolicLink()) return
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
  sourcePath?: string
  installPath: string
  kind: 'copy' | 'file' | 'symlink'
  surface?: string
  content?: string
  prepare?: (stagePath: string) => void
  validate?: (path: string) => void
}): InstallOwnership {
  return transactionalInstallGroup({ pluginName: options.pluginName, platform: options.platform, targets: [options] })[0]
}

export function transactionalInstallGroup(options: {
  pluginName: string
  platform: TargetPlatform
  targets: Array<{
    sourcePath?: string
    installPath: string
    kind: 'copy' | 'file' | 'symlink'
    surface?: string
    content?: string
    prepare?: (stagePath: string) => void
    validate?: (path: string) => void
  }>
}): InstallOwnership[] {
  if (options.targets.length === 0) return []
  const surfaces = new Set<string>()
  const paths = new Set<string>()
  for (const target of options.targets) {
    const surface = target.surface ?? ''
    if (surfaces.has(surface)) throw new Error(`Duplicate install ownership surface "${surface || 'primary'}".`)
    surfaces.add(surface)
    const path = resolve(target.installPath)
    if (paths.has(path)) throw new Error(`Duplicate transactional install path ${path}.`)
    paths.add(path)
  }

  const nonce = `${process.pid}-${randomBytes(5).toString('hex')}`
  const transactions = options.targets.map((target, index) => {
    const installPath = resolve(target.installPath)
    const parent = dirname(installPath)
    mkdirSync(parent, { recursive: true })
    assertInstallReplaceable(options.pluginName, options.platform, installPath, target.surface)
    return {
      ...target,
      installPath,
      stagePath: resolve(parent, `.${options.pluginName}.pluxx-stage-${nonce}-${index}`),
      backupPath: resolve(parent, `.${options.pluginName}.pluxx-backup-${nonce}-${index}`),
      ownershipPath: getInstallOwnershipPath(options.pluginName, options.platform, undefined, target.surface),
      previousOwnership: undefined as Buffer | undefined,
      movedPrevious: false,
      installedCandidate: false,
    }
  })
  const ownership: InstallOwnership[] = []

  try {
    for (const transaction of transactions) {
      if (transaction.kind === 'file' && transaction.content !== undefined) {
        writeFileSync(transaction.stagePath, transaction.content)
      } else if (transaction.kind === 'symlink') {
        if (!transaction.sourcePath) throw new Error(`Missing source path for ${transaction.installPath}.`)
        symlinkSync(resolve(transaction.sourcePath), transaction.stagePath)
      } else {
        if (!transaction.sourcePath) throw new Error(`Missing source path for ${transaction.installPath}.`)
        cpSync(transaction.sourcePath, transaction.stagePath, { recursive: true })
      }
      transaction.prepare?.(transaction.stagePath)
      transaction.validate?.(transaction.stagePath)
    }

    for (const transaction of transactions) {
      if (existsSync(transaction.ownershipPath)) transaction.previousOwnership = readFileSync(transaction.ownershipPath)
      if (existsSync(transaction.installPath)) {
        renameSync(transaction.installPath, transaction.backupPath)
        transaction.movedPrevious = true
      }
      renameSync(transaction.stagePath, transaction.installPath)
      transaction.installedCandidate = true
      transaction.validate?.(transaction.installPath)
    }

    for (const transaction of transactions) {
      const record = buildOwnership(
        options.pluginName,
        options.platform,
        transaction.installPath,
        transaction.kind,
        transaction.surface,
      )
      writeOwnership(record)
      ownership.push(record)
    }
    for (const transaction of transactions) {
      if (transaction.movedPrevious) {
        try { rmSync(transaction.backupPath, { recursive: true, force: true }) } catch { /* Recoverable backup. */ }
      }
    }
    return ownership
  } catch (error) {
    for (const transaction of [...transactions].reverse()) {
      if (transaction.installedCandidate && existsSync(transaction.installPath)) rmSync(transaction.installPath, { recursive: true, force: true })
      if (transaction.movedPrevious && existsSync(transaction.backupPath)) renameSync(transaction.backupPath, transaction.installPath)
      if (transaction.previousOwnership) {
        mkdirSync(dirname(transaction.ownershipPath), { recursive: true })
        writeFileSync(transaction.ownershipPath, transaction.previousOwnership, { mode: 0o600 })
      } else rmSync(transaction.ownershipPath, { force: true })
    }
    throw error
  } finally {
    for (const transaction of transactions) {
      if (existsSync(transaction.stagePath)) rmSync(transaction.stagePath, { recursive: true, force: true })
    }
  }
}

function pruneEmptyParents(path: string, root: string): void {
  let current = dirname(path)
  while (current !== root && isInside(current, root)) {
    try { rmdirSync(current) } catch { break }
    current = dirname(current)
  }
}

export function removeOwnedInstall(pluginName: string, platform: TargetPlatform, installPath: string, surface?: string): InstallRemovalResult {
  const ownershipPath = getInstallOwnershipPath(pluginName, platform, undefined, surface)
  const record = readInstallOwnership(pluginName, platform, installPath, surface)
  if (!record) return { changed: false, removed: [], preserved: existsSync(installPath) ? [installPath] : [], ownershipPath }
  const root = resolve(installPath)
  const removed: string[] = []
  const preserved: string[] = []

  if (record.kind === 'symlink') {
    if (existsSync(root) && lstatSync(root).isSymbolicLink() && readlinkSync(root) === record.symlinkTarget) {
      rmSync(root, { force: true })
      removed.push(root)
    } else if (existsSync(root)) preserved.push(root)
  } else if (record.kind === 'file') {
    if (existsSync(root) && lstatSync(root).isFile() && !lstatSync(root).isSymbolicLink() && hash(readFileSync(root)) === record.rootSha256) {
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

export function listInstallOwnership(pluginName: string, platform: TargetPlatform): InstallOwnership[] {
  const primaryPath = getInstallOwnershipPath(pluginName, platform)
  const root = dirname(primaryPath)
  if (!existsSync(root)) return []
  const prefix = `${platform}--`
  const paths = readdirSync(root)
    .filter((name) => name === `${platform}.json` || (name.startsWith(prefix) && name.endsWith('.json')))
    .sort()
  return paths.map((name) => {
    const surface = name === `${platform}.json` ? undefined : name.slice(prefix.length, -'.json'.length)
    const raw = JSON.parse(readFileSync(resolve(root, name), 'utf-8')) as Partial<InstallOwnership>
    if (typeof raw.installPath !== 'string') throw new Error(`Cannot use install ownership record ${resolve(root, name)}: missing install path`)
    const record = readInstallOwnership(pluginName, platform, raw.installPath, surface)
    if (!record) throw new Error(`Cannot use install ownership record ${resolve(root, name)}.`)
    return record
  })
}
