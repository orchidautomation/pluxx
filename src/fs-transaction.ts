import {
  copyFileSync,
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs'
import { basename, dirname, isAbsolute, relative, resolve } from 'path'
import { randomUUID } from 'crypto'

export const MUTATION_MANIFEST_VERSION = 1 as const

export type MutationPhase =
  | 'staged'
  | 'journaled'
  | 'backup-created'
  | 'entry-applied'
  | 'published'
  | 'rolled-back'

export interface FileMutation {
  path: string
  action: 'create' | 'update' | 'delete'
  content?: string | Uint8Array
  mode?: number
}

export interface MutationConflict {
  path: string
  reason: string
  candidates?: string[]
}

export interface MutationManifest {
  version: typeof MUTATION_MANIFEST_VERSION
  creates: string[]
  updates: string[]
  deletes: string[]
  renames: Array<{ from: string; to: string }>
  conflicts: MutationConflict[]
}

export interface MutationHooks {
  injectFailure?: (phase: MutationPhase, detail?: string) => void
}

export function createMutationManifest(input: {
  files?: FileMutation[]
  renames?: Array<{ from: string; to: string }>
  conflicts?: MutationConflict[]
}): MutationManifest {
  const files = input.files ?? []
  return {
    version: MUTATION_MANIFEST_VERSION,
    creates: files.filter((entry) => entry.action === 'create').map((entry) => entry.path).sort(),
    updates: files.filter((entry) => entry.action === 'update').map((entry) => entry.path).sort(),
    deletes: files.filter((entry) => entry.action === 'delete').map((entry) => entry.path).sort(),
    renames: [...(input.renames ?? [])].sort((a, b) => a.from.localeCompare(b.from)),
    conflicts: [...(input.conflicts ?? [])].sort((a, b) => a.path.localeCompare(b.path)),
  }
}

function resolveWithinRoot(rootDir: string, relativePath: string): string {
  if (isAbsolute(relativePath)) {
    throw new Error(`Mutation path must be relative to the project root: ${relativePath}`)
  }
  const root = resolve(rootDir)
  const target = resolve(root, relativePath)
  const rel = relative(root, target)
  if (rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)) {
    throw new Error(`Mutation path "${relativePath}" resolves outside the project root.`)
  }
  return target
}

function assertNoSymlinkComponents(rootDir: string, relativePath: string): void {
  const root = resolve(rootDir)
  const target = resolveWithinRoot(root, relativePath)
  const rel = relative(root, target)
  let current = root
  for (const segment of rel.split(/[\\/]/).filter(Boolean)) {
    current = resolve(current, segment)
    if (!existsSync(current)) return
    if (lstatSync(current).isSymbolicLink()) {
      throw new Error(`Atomic file mutation does not support symbolic-link paths: ${relativePath}`)
    }
  }
}

function pruneEmptyTransactionRoot(transactionRoot: string): void {
  const parent = dirname(transactionRoot)
  rmSync(transactionRoot, { recursive: true, force: true })
  try {
    if (existsSync(parent) && statSync(parent).isDirectory()) {
      rmdirSync(parent)
    }
  } catch {
    // Another transaction or recovery record still owns the parent.
  }
}

function pruneEmptyParents(rootDir: string, startDir: string): void {
  const root = resolve(rootDir)
  let current = resolve(startDir)
  while (current !== root && relative(root, current) && !relative(root, current).startsWith('..')) {
    if (!existsSync(current) || readdirSync(current).length > 0) return
    rmdirSync(current)
    current = dirname(current)
  }
}

function assertNoPendingFileTransaction(rootDir: string): void {
  const transactionParent = resolve(rootDir, '.pluxx', 'transactions')
  if (!existsSync(transactionParent)) return
  const journals = readdirSync(transactionParent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(transactionParent, entry.name, 'journal.json'))
    .filter(existsSync)
  if (journals.length > 0) {
    throw new Error(`Unfinished Pluxx mutation found. Inspect ${journals.join(', ')} and restore files from its backup directory before retrying.`)
  }
}

export function applyFileMutations(
  rootDir: string,
  files: FileMutation[],
  hooks: MutationHooks = {},
): void {
  if (files.length === 0) return

  assertNoPendingFileTransaction(rootDir)

  const seenPaths = new Set<string>()
  for (const entry of files) {
    assertNoSymlinkComponents(rootDir, entry.path)
    const targetPath = resolveWithinRoot(rootDir, entry.path)
    if (seenPaths.has(targetPath)) {
      throw new Error(`Duplicate mutation path: ${entry.path}`)
    }
    seenPaths.add(targetPath)
    const exists = existsSync(targetPath)
    if (entry.action === 'create' && exists) {
      throw new Error(`Create mutation destination already exists: ${entry.path}`)
    }
    if ((entry.action === 'update' || entry.action === 'delete') && !exists) {
      throw new Error(`${entry.action} mutation destination does not exist: ${entry.path}`)
    }
    if (entry.action !== 'delete' && entry.content === undefined) {
      throw new Error(`Missing content for ${entry.action} mutation: ${entry.path}`)
    }
  }

  const transactionId = randomUUID()
  const transactionRoot = resolve(rootDir, '.pluxx', 'transactions', transactionId)
  const backupRoot = resolve(transactionRoot, 'backup')
  const journalPath = resolve(transactionRoot, 'journal.json')
  const applied: Array<{ entry: FileMutation; existed: boolean; backupPath?: string; originalMode?: number }> = []

  assertNoSymlinkComponents(rootDir, '.pluxx/transactions')
  mkdirSync(backupRoot, { recursive: true })
  writeFileSync(journalPath, `${JSON.stringify({
    version: MUTATION_MANIFEST_VERSION,
    id: transactionId,
    rootDir: resolve(rootDir),
    state: 'applying',
    backupRoot,
    recovery: 'If this process is interrupted, restore original files from backup/ before retrying the mutation.',
    files: files.map(({ content: _content, ...entry }) => entry),
  }, null, 2)}\n`, 'utf-8')

  try {
    hooks.injectFailure?.('journaled', journalPath)
    for (const entry of files) {
      const targetPath = resolveWithinRoot(rootDir, entry.path)
      const existed = existsSync(targetPath)
      let backupPath: string | undefined
      let originalMode: number | undefined

      if (existed) {
        const targetStat = lstatSync(targetPath)
        if (!targetStat.isFile()) {
          throw new Error(`Atomic file mutation only supports files: ${entry.path}`)
        }
        originalMode = targetStat.mode
        backupPath = resolve(backupRoot, relative(resolve(rootDir), targetPath))
        mkdirSync(dirname(backupPath), { recursive: true })
        copyFileSync(targetPath, backupPath)
      }

      applied.push({ entry, existed, backupPath, originalMode })
      hooks.injectFailure?.('backup-created', entry.path)

      if (entry.action === 'delete') {
        rmSync(targetPath, { force: true })
        pruneEmptyParents(rootDir, dirname(targetPath))
      } else {
        mkdirSync(dirname(targetPath), { recursive: true })
        const stagedPath = resolve(dirname(targetPath), `.${basename(targetPath)}.pluxx-${transactionId}.tmp`)
        try {
          writeFileSync(stagedPath, entry.content!)
          if (entry.mode !== undefined) chmodSync(stagedPath, entry.mode)
          hooks.injectFailure?.('staged', entry.path)
          rmSync(targetPath, { force: true })
          renameSync(stagedPath, targetPath)
        } finally {
          rmSync(stagedPath, { force: true })
        }
      }

      hooks.injectFailure?.('entry-applied', entry.path)
    }

    pruneEmptyTransactionRoot(transactionRoot)
  } catch (error) {
    let rollbackError: unknown
    try {
      for (const item of [...applied].reverse()) {
        const targetPath = resolveWithinRoot(rootDir, item.entry.path)
        if (item.existed && item.backupPath) {
          mkdirSync(dirname(targetPath), { recursive: true })
          copyFileSync(item.backupPath, targetPath)
          if (item.originalMode !== undefined) chmodSync(targetPath, item.originalMode)
        } else {
          rmSync(targetPath, { force: true })
          pruneEmptyParents(rootDir, dirname(targetPath))
        }
      }
      hooks.injectFailure?.('rolled-back')
      pruneEmptyTransactionRoot(transactionRoot)
    } catch (caught) {
      rollbackError = caught
      writeFileSync(journalPath, `${JSON.stringify({
        version: MUTATION_MANIFEST_VERSION,
        id: transactionId,
        rootDir: resolve(rootDir),
        state: 'recovery-required',
        backupRoot,
        failure: error instanceof Error ? error.message : String(error),
        rollbackFailure: caught instanceof Error ? caught.message : String(caught),
        files: files.map(({ content: _content, ...entry }) => entry),
      }, null, 2)}\n`, 'utf-8')
    }

    const detail = rollbackError
      ? ` Automatic rollback failed; recover from ${journalPath}.`
      : ' Original files were restored.'
    throw new Error(`Atomic mutation failed.${detail}`, { cause: error })
  }
}

export function publishStagedDirectory(
  destinationPath: string,
  stagedPath: string,
  hooks: MutationHooks = {},
): void {
  const destination = resolve(destinationPath)
  const staged = resolve(stagedPath)
  if (dirname(destination) !== dirname(staged)) {
    throw new Error('Staged directory must share the destination parent to avoid cross-device publication.')
  }
  if (!existsSync(staged) || !statSync(staged).isDirectory()) {
    throw new Error(`Staged directory does not exist: ${staged}`)
  }

  const pendingJournals = readdirSync(dirname(destination))
    .filter((entry) => entry.startsWith(`.${basename(destination)}.pluxx-transaction-`) && entry.endsWith('.json'))
    .map((entry) => resolve(dirname(destination), entry))
  if (pendingJournals.length > 0) {
    throw new Error(`Unfinished Pluxx directory publication found. Inspect ${pendingJournals.join(', ')} and restore its backup directory before retrying.`)
  }

  const transactionId = randomUUID()
  const backupPath = resolve(dirname(destination), `.${basename(destination)}.pluxx-backup-${transactionId}`)
  const journalPath = resolve(dirname(destination), `.${basename(destination)}.pluxx-transaction-${transactionId}.json`)
  const hadDestination = existsSync(destination)

  writeFileSync(journalPath, `${JSON.stringify({
    version: MUTATION_MANIFEST_VERSION,
    id: transactionId,
    state: 'publishing',
    destination,
    staged,
    backup: hadDestination ? backupPath : null,
    recovery: 'If this process is interrupted, restore backup to destination before retrying publication.',
  }, null, 2)}\n`, 'utf-8')

  try {
    hooks.injectFailure?.('journaled', journalPath)
    if (hadDestination) {
      renameSync(destination, backupPath)
    }
    hooks.injectFailure?.('backup-created', backupPath)
    renameSync(staged, destination)
    hooks.injectFailure?.('published', destination)
    rmSync(backupPath, { recursive: true, force: true })
    rmSync(journalPath, { force: true })
  } catch (error) {
    let rollbackError: unknown
    try {
      if (existsSync(destination)) {
        rmSync(destination, { recursive: true, force: true })
      }
      if (hadDestination && existsSync(backupPath)) {
        renameSync(backupPath, destination)
      }
      hooks.injectFailure?.('rolled-back')
      if (existsSync(staged)) {
        rmSync(staged, { recursive: true, force: true })
      }
      rmSync(journalPath, { force: true })
    } catch (caught) {
      rollbackError = caught
      writeFileSync(journalPath, `${JSON.stringify({
        version: MUTATION_MANIFEST_VERSION,
        id: transactionId,
        state: 'recovery-required',
        destination,
        staged,
        backup: hadDestination ? backupPath : null,
        failure: error instanceof Error ? error.message : String(error),
        rollbackFailure: caught instanceof Error ? caught.message : String(caught),
      }, null, 2)}\n`, 'utf-8')
    }

    const detail = rollbackError
      ? ` Automatic rollback failed; recover using ${journalPath}.`
      : ' Original directory was restored.'
    throw new Error(`Atomic directory publication failed.${detail}`, { cause: error })
  }
}

export function copyDirectoryForStaging(sourcePath: string, stagedPath: string): void {
  if (!existsSync(sourcePath)) {
    mkdirSync(stagedPath, { recursive: true })
    return
  }
  cpSync(sourcePath, stagedPath, { recursive: true })
}

const PROJECT_STAGE_IGNORES = new Set(['.git', 'node_modules', 'dist'])

export function copyProjectForStaging(sourcePath: string, stagedPath: string): void {
  const source = resolve(sourcePath)
  cpSync(source, stagedPath, {
    recursive: true,
    filter(path) {
      const rel = relative(source, path)
      if (rel === '') return true
      const [topLevel] = rel.split(/[\\/]/)
      if (PROJECT_STAGE_IGNORES.has(topLevel)) return false
      return !rel.startsWith(`.pluxx${process.platform === 'win32' ? '\\' : '/'}transactions`)
    },
  })
}

export function readFileMutation(rootDir: string, stagedRoot: string, path: string): FileMutation {
  const currentPath = resolveWithinRoot(rootDir, path)
  const stagedPath = resolveWithinRoot(stagedRoot, path)
  const currentExists = existsSync(currentPath)
  const stagedExists = existsSync(stagedPath)
  if (!stagedExists) {
    return { path, action: 'delete' }
  }
  const content = readFileSync(stagedPath)
  return {
    path,
    action: currentExists ? 'update' : 'create',
    content,
    mode: statSync(stagedPath).mode,
  }
}
