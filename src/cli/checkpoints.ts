import { createHash, randomUUID } from 'crypto'
import type { Dirent } from 'fs'
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  readdir,
  realpath,
  rename,
  rm,
  rmdir,
  stat,
  symlink,
  writeFile,
} from 'fs/promises'
import { tmpdir } from 'os'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'path'
import { appendUniqueLines, assertWorkspacePathNotSymlink } from '../text-files'

export const CHECKPOINT_VERSION = 1 as const
export const DURABLE_CHECKPOINT_DIR = '.pluxx/checkpoints'

export type CheckpointKind = 'durable' | 'enforcement'

export interface CheckpointFile {
  path: string
  digest: string
  size: number
  mode: number
  type: 'file' | 'symlink'
}

export interface CheckpointManifest {
  version: typeof CHECKPOINT_VERSION
  kind: CheckpointKind
  createdAt: string
  label?: string
  files: CheckpointFile[]
  exclusions: string[]
}

export interface WorkspaceCheckpoint {
  directory: string
  manifest: CheckpointManifest
}

interface IgnoreRule {
  negative: boolean
  directoryOnly: boolean
  regex: RegExp
}

interface WalkOptions {
  kind: CheckpointKind
  ignoreRules: IgnoreRule[]
  includeAgentResults?: boolean
}

interface DurableCheckpointOptions {
  includeAgentResults?: boolean
}

const ALWAYS_EXCLUDED_ROOTS = new Set(['.git', 'node_modules'])
const DURABLE_EXCLUDED_ROOTS = new Set(['dist'])
const DURABLE_LOCAL_ONLY_NAMES = new Set([
  '.npmrc',
  '.pypirc',
  '.netrc',
  '.DS_Store',
  'autopilot-state.json',
  'mutation.lock',
])
const MANAGED_RECOVERY_IGNORE_LINES = new Set([
  `${DURABLE_CHECKPOINT_DIR}/`,
  '.pluxx/autopilot-state.json',
  '.pluxx/agent/*-run-result.json',
  '.pluxx/agent/review-result.json',
])

export async function createDurableCheckpoint(
  rootDir: string,
  label?: string,
  options: DurableCheckpointOptions = {},
): Promise<WorkspaceCheckpoint> {
  const root = await resolveProjectRoot(rootDir)
  const checkpointRoot = resolve(root, DURABLE_CHECKPOINT_DIR)
  await assertWorkspacePathNotSymlink(root, checkpointRoot)
  await mkdir(checkpointRoot, { recursive: true, mode: 0o700 })
  const safeLabel = sanitizeLabel(label)
  const checkpointDirectory = resolve(
    checkpointRoot,
    `${new Date().toISOString().replace(/[:.]/g, '-')}${safeLabel ? `-${safeLabel}` : ''}-${randomUUID()}`,
  )
  try {
    const checkpoint = await createCheckpoint(root, checkpointDirectory, 'durable', label, options)
    await assertWorkspacePathNotSymlink(root, resolve(root, '.gitignore'))
    await appendUniqueLines(resolve(root, '.gitignore'), [`${DURABLE_CHECKPOINT_DIR}/`])
    return checkpoint
  } catch (error) {
    await rm(checkpointDirectory, { recursive: true, force: true })
    throw error
  }
}

export async function createEnforcementCheckpoint(rootDir: string): Promise<WorkspaceCheckpoint> {
  const root = await resolveProjectRoot(rootDir)
  const checkpointDirectory = await mkdtemp(resolve(tmpdir(), 'pluxx-enforcement-checkpoint-'))
  await chmod(checkpointDirectory, 0o700)
  try {
    return await createCheckpoint(root, checkpointDirectory, 'enforcement')
  } catch (error) {
    await rm(checkpointDirectory, { recursive: true, force: true })
    throw error
  }
}

export async function inventoryWorkspace(rootDir: string): Promise<CheckpointFile[]> {
  const root = await resolveProjectRoot(rootDir)
  const files = await walkProjectFiles(root, { kind: 'enforcement', ignoreRules: [] })
  const inventory: CheckpointFile[] = []
  for (const file of files) {
    const content = file.type === 'symlink'
      ? Buffer.from(await readlink(safeProjectPath(root, file.path)))
      : await readFile(safeProjectPath(root, file.path))
    inventory.push({
      path: file.path,
      digest: createHash('sha256').update(content).digest('hex'),
      size: content.byteLength,
      mode: file.mode,
      type: file.type,
    })
  }
  return inventory
}

export async function checkpointMatchesWorkspace(
  rootDir: string,
  checkpointDirectory: string,
): Promise<boolean> {
  const root = await resolveProjectRoot(rootDir)
  const checkpoint = await loadCheckpoint(checkpointDirectory)
  const ignoreRules = checkpoint.manifest.kind === 'durable' ? await loadCheckpointIgnoreRules(checkpoint) : []
  const current = await walkProjectFiles(root, { kind: checkpoint.manifest.kind, ignoreRules })
  const currentInventory: CheckpointFile[] = []
  let currentGitignoreDigest: string | undefined
  for (const file of current) {
    const content = file.type === 'symlink'
      ? Buffer.from(await readlink(safeProjectPath(root, file.path)))
      : await readFile(safeProjectPath(root, file.path))
    if (checkpoint.manifest.kind === 'durable' && file.path === '.gitignore') {
      currentGitignoreDigest = digestContent(withoutManagedRecoveryIgnores(content))
    }
    currentInventory.push({
      path: file.path,
      digest: digestContent(content),
      size: content.byteLength,
      mode: file.mode,
      type: file.type,
    })
  }
  const checkpointGitignore = checkpoint.manifest.files.find((file) => file.path === '.gitignore')
  let checkpointGitignoreDigest: string | undefined
  if (checkpoint.manifest.kind === 'durable' && checkpointGitignore) {
    const content = await readFile(payloadPath(checkpoint.directory, checkpointGitignore.digest))
    assertPayloadDigest(content, checkpointGitignore)
    checkpointGitignoreDigest = digestContent(withoutManagedRecoveryIgnores(content))
  }
  if (currentGitignoreDigest !== checkpointGitignoreDigest) return false
  const comparable = (files: CheckpointFile[]) => files
    .filter((file) => file.path !== '.gitignore')
    .map((file) => `${file.path}\0${file.type}\0${file.mode}\0${file.digest}`)
    .sort()
  return JSON.stringify(comparable(currentInventory)) === JSON.stringify(comparable(checkpoint.manifest.files))
}

function withoutManagedRecoveryIgnores(content: Buffer): Buffer {
  const lines = content.toString('utf8').match(/[^\n]*\n|[^\n]+$/g) ?? []
  return Buffer.from(lines
    .filter((line) => !MANAGED_RECOVERY_IGNORE_LINES.has(line.replace(/\r?\n$/, '').trim()))
    .join(''))
}

function digestContent(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}

export async function loadCheckpoint(checkpointDirectory: string): Promise<WorkspaceCheckpoint> {
  const directory = resolve(checkpointDirectory)
  const raw = await readFile(resolve(directory, 'manifest.json'), 'utf8')
  const manifest = validateManifest(JSON.parse(raw) as unknown)
  return { directory, manifest }
}

export async function validateDurableCheckpointDirectory(
  rootDir: string,
  checkpointDirectory: string,
): Promise<string> {
  const root = await resolveProjectRoot(rootDir)
  const checkpointRoot = resolve(root, DURABLE_CHECKPOINT_DIR)
  const directory = await realpath(resolve(checkpointDirectory))
  const fromRoot = relative(checkpointRoot, directory)
  if (!fromRoot || fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new Error('Autopilot recovery checkpoint is outside this project.')
  }
  const checkpoint = await loadCheckpoint(directory)
  if (checkpoint.manifest.kind !== 'durable') {
    throw new Error('Autopilot recovery requires a durable checkpoint.')
  }
  return directory
}

export async function listDurableCheckpoints(rootDir: string): Promise<WorkspaceCheckpoint[]> {
  const root = await resolveProjectRoot(rootDir)
  const checkpointRoot = resolve(root, DURABLE_CHECKPOINT_DIR)
  let entries: Dirent[]
  try {
    entries = await readdir(checkpointRoot, { withFileTypes: true })
  } catch (error) {
    if (isMissingPathError(error)) return []
    throw error
  }

  const checkpoints = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
      .map((entry) => loadCheckpoint(resolve(checkpointRoot, entry.name))),
  )
  return checkpoints.sort((left, right) => left.manifest.createdAt.localeCompare(right.manifest.createdAt))
}

export async function pruneDurableCheckpoints(
  rootDir: string,
  retainedDirectories: Iterable<string>,
): Promise<void> {
  const retained = new Set([...retainedDirectories].map((directory) => resolve(directory)))
  const checkpoints = await listDurableCheckpoints(rootDir)
  for (const checkpoint of checkpoints) {
    if (!retained.has(resolve(checkpoint.directory))) {
      await deleteCheckpoint(checkpoint.directory)
    }
  }
}

export async function readCheckpointFile(
  checkpointDirectory: string,
  relativePath: string,
): Promise<Buffer | undefined> {
  const checkpoint = await loadCheckpoint(checkpointDirectory)
  const safePath = validateRelativePath(relativePath)
  const file = checkpoint.manifest.files.find((candidate) => candidate.path === safePath)
  if (!file) return undefined
  const payload = await readFile(payloadPath(checkpoint.directory, file.digest))
  assertPayloadDigest(payload, file)
  return payload
}

export async function deleteCheckpoint(checkpointDirectory: string): Promise<void> {
  await rm(resolve(checkpointDirectory), { recursive: true, force: true })
}

export async function restoreCheckpoint(
  rootDir: string,
  checkpointDirectory: string,
): Promise<void> {
  const root = await resolveProjectRoot(rootDir)
  const checkpoint = await loadCheckpoint(checkpointDirectory)
  const ignoreRules = checkpoint.manifest.kind === 'durable'
    ? await loadCheckpointIgnoreRules(checkpoint)
    : []
  const verifiedPayloads = new Set<string>()
  const ancestorConflicts = new Set<string>()
  for (const file of checkpoint.manifest.files) {
    for (const conflict of await findAncestorConflicts(root, file.path)) ancestorConflicts.add(conflict)
    if (verifiedPayloads.has(file.digest)) continue
    const payload = await readFile(payloadPath(checkpoint.directory, file.digest))
    assertPayloadDigest(payload, file)
    verifiedPayloads.add(file.digest)
  }
  for (const conflict of [...ancestorConflicts].sort((left, right) => left.split('/').length - right.split('/').length)) {
    const path = safeProjectPath(root, conflict)
    await rm(path, { recursive: true, force: true })
    await mkdir(path, { recursive: true })
  }
  const currentFiles = await walkProjectFiles(root, {
    kind: checkpoint.manifest.kind,
    ignoreRules,
  })
  const capturedPaths = new Set(checkpoint.manifest.files.map((file) => file.path))

  for (const current of currentFiles) {
    if (!capturedPaths.has(current.path)) {
      await rm(safeProjectPath(root, current.path), { force: true })
    }
  }

  for (const file of checkpoint.manifest.files) {
    const target = safeProjectPath(root, file.path)
    const payload = await readFile(payloadPath(checkpoint.directory, file.digest))
    assertPayloadDigest(payload, file)
    await mkdir(dirname(target), { recursive: true })
    if (file.type === 'symlink') {
      await rm(target, { recursive: true, force: true })
      await symlink(payload.toString('utf8'), target)
      continue
    }
    try {
      const current = await lstat(target)
      if (!current.isFile()) await rm(target, { recursive: true, force: true })
    } catch (error) {
      if (!isMissingPathError(error)) throw error
    }
    const temporary = resolve(dirname(target), `.${basename(target)}.pluxx-restore-${randomUUID()}`)
    try {
      await writeFile(temporary, payload, { mode: file.mode })
      await chmod(temporary, file.mode)
      await rename(temporary, target)
    } finally {
      await rm(temporary, { force: true })
    }
  }

  await removeEmptyIncludedDirectories(root, {
    kind: checkpoint.manifest.kind,
    ignoreRules,
  })
}

async function createCheckpoint(
  root: string,
  checkpointDirectory: string,
  kind: CheckpointKind,
  label?: string,
  options: DurableCheckpointOptions = {},
): Promise<WorkspaceCheckpoint> {
  await mkdir(resolve(checkpointDirectory, 'payloads'), { recursive: true, mode: 0o700 })
  const ignoreRules = kind === 'durable' ? await loadIgnoreRules(root) : []
  const files = await walkProjectFiles(root, { kind, ignoreRules, includeAgentResults: options.includeAgentResults })
  const manifestFiles: CheckpointFile[] = []

  for (const file of files) {
    const source = safeProjectPath(root, file.path)
    const content = file.type === 'symlink'
      ? Buffer.from(await readlink(source))
      : await readFile(source)
    const digest = createHash('sha256').update(content).digest('hex')
    const destination = payloadPath(checkpointDirectory, digest)
    try {
      await stat(destination)
    } catch (error) {
      if (!isMissingPathError(error)) throw error
      await writeFile(destination, content)
      await chmod(destination, 0o600)
    }
    manifestFiles.push({
      path: file.path,
      digest,
      size: content.byteLength,
      mode: file.mode,
      type: file.type,
    })
  }

  const manifest: CheckpointManifest = {
    version: CHECKPOINT_VERSION,
    kind,
    createdAt: new Date().toISOString(),
    ...(label ? { label } : {}),
    files: manifestFiles.sort((left, right) => left.path.localeCompare(right.path)),
    exclusions: checkpointExclusions(kind),
  }
  await writeFile(
    resolve(checkpointDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { mode: 0o600 },
  )
  return { directory: checkpointDirectory, manifest }
}

async function resolveProjectRoot(rootDir: string): Promise<string> {
  const resolved = await realpath(resolve(rootDir))
  const details = await lstat(resolved)
  if (!details.isDirectory()) {
    throw new Error(`Checkpoint root is not a directory: ${rootDir}`)
  }
  return resolved
}

async function walkProjectFiles(
  root: string,
  options: WalkOptions,
): Promise<Array<{ path: string; mode: number; type: 'file' | 'symlink' }>> {
  const files: Array<{ path: string; mode: number; type: 'file' | 'symlink' }> = []

  const visit = async (directory: string, relativeDirectory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      const relativePath = normalizePath(relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name)
      const absolutePath = safeProjectPath(root, relativePath)
      const details = await lstat(absolutePath)
      if (details.isSymbolicLink()) {
        if (!isExcludedPath(relativePath, false, options)) {
          files.push({ path: relativePath, mode: details.mode & 0o777, type: 'symlink' })
        }
        continue
      }
      if (isExcludedPath(relativePath, details.isDirectory(), options)) continue
      if (details.isDirectory()) {
        await visit(absolutePath, relativePath)
      } else if (details.isFile()) {
        files.push({ path: relativePath, mode: details.mode & 0o777, type: 'file' })
      }
    }
  }

  await visit(root, '')
  return files
}

function isExcludedPath(relativePath: string, isDirectory: boolean, options: WalkOptions): boolean {
  const normalized = normalizePath(relativePath)
  const rootName = normalized.split('/')[0]!
  if (ALWAYS_EXCLUDED_ROOTS.has(rootName)) return true
  if (normalized === DURABLE_CHECKPOINT_DIR || normalized.startsWith(`${DURABLE_CHECKPOINT_DIR}/`)) return true
  if (options.kind === 'durable') {
    if (DURABLE_EXCLUDED_ROOTS.has(rootName)) return true
    if (DURABLE_LOCAL_ONLY_NAMES.has(basename(normalized))) return true
    if (!options.includeAgentResults
      && (normalized === '.pluxx/agent/review-result.json' || /^\.pluxx\/agent\/[^/]+-run-result\.json$/.test(normalized))) return true
    if (matchesIgnoreRules(normalized, isDirectory, options.ignoreRules)) return true
  }
  return false
}

function checkpointExclusions(kind: CheckpointKind): string[] {
  return kind === 'durable'
    ? ['.git/', 'node_modules/', 'dist/', `${DURABLE_CHECKPOINT_DIR}/`, 'gitignored files', 'local-only files']
    : ['.git/', 'node_modules/', `${DURABLE_CHECKPOINT_DIR}/`]
}

async function loadIgnoreRules(root: string): Promise<IgnoreRule[]> {
  let content: string
  try {
    content = await readFile(resolve(root, '.gitignore'), 'utf8')
  } catch (error) {
    if (isMissingPathError(error)) return []
    throw error
  }

  return parseIgnoreRules(content)
}

async function loadCheckpointIgnoreRules(checkpoint: WorkspaceCheckpoint): Promise<IgnoreRule[]> {
  const ignoreFile = checkpoint.manifest.files.find((file) => file.path === '.gitignore')
  if (!ignoreFile) return []
  const content = await readFile(payloadPath(checkpoint.directory, ignoreFile.digest))
  assertPayloadDigest(content, ignoreFile)
  return parseIgnoreRules(content.toString('utf8'))
}

function parseIgnoreRules(content: string): IgnoreRule[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map(compileIgnoreRule)
}

function compileIgnoreRule(input: string): IgnoreRule {
  let pattern = input
  const negative = pattern.startsWith('!')
  if (negative) pattern = pattern.slice(1)
  const directoryOnly = pattern.endsWith('/')
  pattern = pattern.replace(/^\//, '').replace(/\/$/, '')
  const hasSlash = pattern.includes('/')
  const expression = globExpression(pattern)
  return {
    negative,
    directoryOnly,
    regex: new RegExp(hasSlash
      ? `^${expression}${directoryOnly ? '(?:/.*)?' : ''}$`
      : `(?:^|/)${expression}${directoryOnly ? '(?:/.*)?' : '$'}`),
  }
}

function globExpression(pattern: string): string {
  let expression = ''
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]!
    if (character === '*') {
      if (pattern[index + 1] === '*') {
        expression += '.*'
        index += 1
      } else {
        expression += '[^/]*'
      }
    } else if (character === '?') {
      expression += '[^/]'
    } else {
      expression += character.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
    }
  }
  return expression
}

function matchesIgnoreRules(path: string, isDirectory: boolean, rules: IgnoreRule[]): boolean {
  let ignored = false
  for (const rule of rules) {
    if (rule.directoryOnly && !isDirectory && !path.includes('/')) continue
    if (rule.regex.test(path)) ignored = !rule.negative
  }
  return ignored
}

async function removeEmptyIncludedDirectories(root: string, options: WalkOptions): Promise<void> {
  const visit = async (directory: string, relativeDirectory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue
      const relativePath = normalizePath(relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name)
      if (isExcludedPath(relativePath, true, options)) continue
      const absolutePath = safeProjectPath(root, relativePath)
      await visit(absolutePath, relativePath)
      if ((await readdir(absolutePath)).length === 0) {
        await rmdir(absolutePath)
      }
    }
  }
  await visit(root, '')
}

async function findAncestorConflicts(root: string, relativePath: string): Promise<string[]> {
  const parts = validateRelativePath(relativePath).split('/').slice(0, -1)
  const conflicts: string[] = []
  let cursor = root
  for (const part of parts) {
    cursor = resolve(cursor, part)
    try {
      const details = await lstat(cursor)
      if (details.isSymbolicLink() || !details.isDirectory()) {
        conflicts.push(normalizePath(relative(root, cursor)))
        break
      }
    } catch (error) {
      if (isMissingPathError(error)) break
      throw error
    }
  }
  return conflicts
}

function safeProjectPath(root: string, relativePath: string): string {
  const safeRelativePath = validateRelativePath(relativePath)
  const target = resolve(root, safeRelativePath)
  const fromRoot = relative(root, target)
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new Error(`Unsafe checkpoint path: ${relativePath}`)
  }
  return target
}

function validateRelativePath(input: string): string {
  if (typeof input !== 'string' || input.length === 0 || input.includes('\0') || isAbsolute(input)) {
    throw new Error(`Unsafe checkpoint path: ${String(input)}`)
  }
  const normalized = normalizePath(input)
  if (
    normalized === '.'
    || normalized === '..'
    || normalized.startsWith('../')
    || normalized.includes('/../')
    || normalized.startsWith('/')
  ) {
    throw new Error(`Unsafe checkpoint path: ${input}`)
  }
  return normalized
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}

function payloadPath(checkpointDirectory: string, digest: string): string {
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    throw new Error(`Invalid checkpoint payload digest: ${digest}`)
  }
  return resolve(checkpointDirectory, 'payloads', digest)
}

function assertPayloadDigest(payload: Buffer, file: CheckpointFile): void {
  const digest = createHash('sha256').update(payload).digest('hex')
  if (digest !== file.digest || payload.byteLength !== file.size) {
    throw new Error(`Checkpoint payload failed integrity validation: ${file.path}`)
  }
}

function validateManifest(input: unknown): CheckpointManifest {
  if (!isRecord(input) || input.version !== CHECKPOINT_VERSION) {
    throw new Error('Unsupported checkpoint manifest version.')
  }
  if (input.kind !== 'durable' && input.kind !== 'enforcement') {
    throw new Error('Invalid checkpoint kind.')
  }
  if (typeof input.createdAt !== 'string' || Number.isNaN(Date.parse(input.createdAt))) {
    throw new Error('Invalid checkpoint creation time.')
  }
  if (input.label !== undefined && typeof input.label !== 'string') {
    throw new Error('Invalid checkpoint label.')
  }
  if (!Array.isArray(input.files) || !Array.isArray(input.exclusions) || !input.exclusions.every((value) => typeof value === 'string')) {
    throw new Error('Invalid checkpoint manifest contents.')
  }

  const seenPaths = new Set<string>()
  const files = input.files.map((value): CheckpointFile => {
    if (!isRecord(value)) throw new Error('Invalid checkpoint file entry.')
    const path = validateRelativePath(String(value.path ?? ''))
    if (seenPaths.has(path)) throw new Error(`Duplicate checkpoint path: ${path}`)
    for (const existing of seenPaths) {
      if (path.startsWith(`${existing}/`) || existing.startsWith(`${path}/`)) {
        throw new Error(`Conflicting checkpoint paths: ${existing} and ${path}`)
      }
    }
    seenPaths.add(path)
    if (typeof value.digest !== 'string' || !/^[a-f0-9]{64}$/.test(value.digest)) {
      throw new Error(`Invalid checkpoint payload digest for ${path}`)
    }
    if (!Number.isSafeInteger(value.size) || Number(value.size) < 0) {
      throw new Error(`Invalid checkpoint file size for ${path}`)
    }
    if (!Number.isSafeInteger(value.mode) || Number(value.mode) < 0 || Number(value.mode) > 0o777) {
      throw new Error(`Invalid checkpoint file mode for ${path}`)
    }
    if (value.type !== 'file' && value.type !== 'symlink') {
      throw new Error(`Invalid checkpoint file type for ${path}`)
    }
    return {
      path,
      digest: value.digest,
      size: Number(value.size),
      mode: Number(value.mode),
      type: value.type,
    }
  })

  return {
    version: CHECKPOINT_VERSION,
    kind: input.kind,
    createdAt: input.createdAt,
    ...(typeof input.label === 'string' ? { label: input.label } : {}),
    files,
    exclusions: [...input.exclusions] as string[],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeLabel(label: string | undefined): string {
  return label?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) ?? ''
}

function isMissingPathError(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT'
}
