import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, resolve } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  checkpointMatchesWorkspace,
  createDurableCheckpoint,
  createEnforcementCheckpoint,
  deleteCheckpoint,
  listDurableCheckpoints,
  loadCheckpoint,
  readCheckpointFile,
  pruneDurableCheckpoints,
  restoreCheckpoint,
} from '../src/cli/checkpoints'

const roots: string[] = []

function makeRoot(prefix: string): string {
  const root = mkdtempSync(resolve(tmpdir(), prefix))
  roots.push(root)
  return root
}

function write(root: string, path: string, content: string): void {
  const filePath = resolve(root, path)
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, content)
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('workspace checkpoints', () => {
  it('creates durable snapshots with required exclusions', async () => {
    const root = makeRoot('pluxx-checkpoint-durable-')
    write(root, 'src/index.ts', 'export const value = 1\n')
    write(root, '.gitignore', '*.local-only\nignored/\n')
    write(root, 'notes.local-only', 'ignored fixture\n')
    write(root, 'ignored/note.txt', 'ignored fixture\n')
    write(root, '.git/HEAD', 'ref fixture\n')
    write(root, 'node_modules/pkg/index.js', 'dependency cache\n')
    write(root, 'dist/index.js', 'generated output\n')

    const checkpoint = await createDurableCheckpoint(root, 'baseline')
    const paths = checkpoint.manifest.files.map((file) => file.path)

    expect(checkpoint.directory).toContain(resolve(root, '.pluxx/checkpoints'))
    expect(paths).toContain('src/index.ts')
    expect(paths).not.toContain('notes.local-only')
    expect(paths).not.toContain('ignored/note.txt')
    expect(paths.some((path) => path.startsWith('.git/'))).toBe(false)
    expect(paths.some((path) => path.startsWith('node_modules/'))).toBe(false)
    expect(paths.some((path) => path.startsWith('dist/'))).toBe(false)
    expect(readFileSync(resolve(root, '.gitignore'), 'utf8')).toContain('.pluxx/checkpoints/')
  })

  it('prunes durable checkpoints not referenced by current recovery state', async () => {
    const root = makeRoot('pluxx-checkpoint-prune-')
    write(root, 'state.txt', 'one\n')
    const first = await createDurableCheckpoint(root, 'first')
    write(root, 'state.txt', 'two\n')
    const retained = await createDurableCheckpoint(root, 'retained')
    write(root, 'state.txt', 'three\n')
    const third = await createDurableCheckpoint(root, 'third')

    await pruneDurableCheckpoints(root, [retained.directory])

    expect((await listDurableCheckpoints(root)).map((checkpoint) => checkpoint.directory)).toEqual([retained.directory])
    expect(existsSync(first.directory)).toBe(false)
    expect(existsSync(third.directory)).toBe(false)
  })

  it('captures symbolic links without following them', async () => {
    const root = makeRoot('pluxx-checkpoint-links-')
    const outside = makeRoot('pluxx-checkpoint-outside-')
    write(root, 'captured.txt', 'inside\n')
    write(outside, 'outside.txt', 'outside\n')
    symlinkSync(resolve(outside, 'outside.txt'), resolve(root, 'linked-file.txt'))

    const checkpoint = await createDurableCheckpoint(root, 'links')
    const link = checkpoint.manifest.files.find((file) => file.path === 'linked-file.txt')

    expect(link).toMatchObject({ path: 'linked-file.txt', type: 'symlink' })
    expect(await readCheckpointFile(checkpoint.directory, 'linked-file.txt')).toEqual(Buffer.from(resolve(outside, 'outside.txt')))
    expect(checkpoint.manifest.files.map((file) => file.path)).not.toContain('linked-file.txt/outside.txt')
    expect(readlinkSync(resolve(root, 'linked-file.txt'))).toBe(resolve(outside, 'outside.txt'))
  })

  it('detects and removes symlinks created after a durable checkpoint', async () => {
    const root = makeRoot('pluxx-checkpoint-new-link-')
    const outside = makeRoot('pluxx-checkpoint-new-link-outside-')
    write(root, 'captured.txt', 'inside\n')
    write(outside, 'outside.txt', 'outside\n')
    const checkpoint = await createDurableCheckpoint(root, 'before-link')
    symlinkSync(resolve(outside, 'outside.txt'), resolve(root, 'linked-file.txt'))

    expect(await checkpointMatchesWorkspace(root, checkpoint.directory)).toBe(false)
    await restoreCheckpoint(root, checkpoint.directory)

    expect(existsSync(resolve(root, 'linked-file.txt'))).toBe(false)
    expect(readFileSync(resolve(outside, 'outside.txt'), 'utf8')).toBe('outside\n')
    await expect(checkpointMatchesWorkspace(root, checkpoint.directory)).resolves.toBe(true)
  })

  it('restores captured files and removes new included files', async () => {
    const root = makeRoot('pluxx-checkpoint-restore-')
    write(root, 'keep.txt', 'original\n')
    write(root, 'nested/deleted.txt', 'restore me\n')
    write(root, '.gitignore', 'ignored.txt\n')
    write(root, 'ignored.txt', 'ignored original\n')
    write(root, 'dist/output.js', 'old build\n')
    const checkpoint = await createDurableCheckpoint(root, 'before-change')

    write(root, 'keep.txt', 'changed\n')
    rmSync(resolve(root, 'nested/deleted.txt'))
    write(root, '.gitignore', 'ignored.txt\nnew.txt\n')
    write(root, 'new.txt', 'remove me\n')
    write(root, 'ignored.txt', 'ignored changed\n')
    write(root, 'dist/output.js', 'new build\n')

    await restoreCheckpoint(root, checkpoint.directory)

    expect(readFileSync(resolve(root, 'keep.txt'), 'utf8')).toBe('original\n')
    expect(readFileSync(resolve(root, 'nested/deleted.txt'), 'utf8')).toBe('restore me\n')
    expect(existsSync(resolve(root, 'new.txt'))).toBe(false)
    expect(readFileSync(resolve(root, 'ignored.txt'), 'utf8')).toBe('ignored changed\n')
    expect(readFileSync(resolve(root, 'dist/output.js'), 'utf8')).toBe('new build\n')
  })

  it('restores the original gitignore bytes from the initial durable checkpoint', async () => {
    const root = makeRoot('pluxx-checkpoint-gitignore-')
    write(root, '.gitignore', 'existing-rule\n')
    const checkpoint = await createDurableCheckpoint(root, 'initial')
    expect(readFileSync(resolve(root, '.gitignore'), 'utf8')).toContain('.pluxx/checkpoints/')

    await restoreCheckpoint(root, checkpoint.directory)

    expect(readFileSync(resolve(root, '.gitignore'), 'utf8')).toBe('existing-rule\n')
  })

  it('uses disposable enforcement snapshots that include build output', async () => {
    const root = makeRoot('pluxx-checkpoint-enforcement-')
    write(root, 'src/index.ts', 'before\n')
    write(root, 'dist/index.js', 'built before\n')

    const checkpoint = await createEnforcementCheckpoint(root)
    expect(checkpoint.directory.startsWith(tmpdir())).toBe(true)
    expect(checkpoint.manifest.files.map((file) => file.path)).toContain('dist/index.js')
    expect(await readCheckpointFile(checkpoint.directory, 'dist/index.js')).toEqual(Buffer.from('built before\n'))
    expect(await readCheckpointFile(checkpoint.directory, 'missing.js')).toBeUndefined()

    write(root, 'src/index.ts', 'after\n')
    write(root, 'dist/index.js', 'built after\n')
    write(root, 'dist/new.js', 'new output\n')
    await restoreCheckpoint(root, checkpoint.directory)

    expect(readFileSync(resolve(root, 'src/index.ts'), 'utf8')).toBe('before\n')
    expect(readFileSync(resolve(root, 'dist/index.js'), 'utf8')).toBe('built before\n')
    expect(existsSync(resolve(root, 'dist/new.js'))).toBe(false)

    await deleteCheckpoint(checkpoint.directory)
    expect(existsSync(checkpoint.directory)).toBe(false)
  })

  it('restores symlink targets and file modes in enforcement snapshots', async () => {
    const root = makeRoot('pluxx-checkpoint-enforcement-metadata-')
    const outside = makeRoot('pluxx-checkpoint-enforcement-outside-')
    write(outside, 'first.txt', 'first\n')
    write(outside, 'second.txt', 'second\n')
    write(root, 'protected.txt', 'protected\n')
    chmodSync(resolve(root, 'protected.txt'), 0o640)
    symlinkSync(resolve(outside, 'first.txt'), resolve(root, 'linked.txt'))
    const checkpoint = await createEnforcementCheckpoint(root)

    chmodSync(resolve(root, 'protected.txt'), 0o777)
    rmSync(resolve(root, 'linked.txt'))
    symlinkSync(resolve(outside, 'second.txt'), resolve(root, 'linked.txt'))
    await restoreCheckpoint(root, checkpoint.directory)

    expect(lstatSync(resolve(root, 'protected.txt')).mode & 0o777).toBe(0o640)
    expect(readlinkSync(resolve(root, 'linked.txt'))).toBe(resolve(outside, 'first.txt'))
    expect(readFileSync(resolve(outside, 'second.txt'), 'utf8')).toBe('second\n')
  })

  it('restores a file after it is replaced by a directory', async () => {
    const root = makeRoot('pluxx-checkpoint-type-swap-')
    write(root, 'entry', 'captured file\n')
    const checkpoint = await createEnforcementCheckpoint(root)
    rmSync(resolve(root, 'entry'))
    write(root, 'entry/nested.txt', 'replacement directory\n')

    await restoreCheckpoint(root, checkpoint.directory)

    expect(readFileSync(resolve(root, 'entry'), 'utf8')).toBe('captured file\n')
  })

  it('replaces a symlinked parent without touching its external target', async () => {
    const root = makeRoot('pluxx-checkpoint-symlink-parent-')
    const outside = makeRoot('pluxx-checkpoint-symlink-parent-outside-')
    write(root, 'nested/file.txt', 'captured\n')
    const checkpoint = await createEnforcementCheckpoint(root)
    rmSync(resolve(root, 'nested'), { recursive: true })
    write(outside, 'file.txt', 'outside\n')
    symlinkSync(outside, resolve(root, 'nested'))

    await restoreCheckpoint(root, checkpoint.directory)

    expect(readFileSync(resolve(root, 'nested/file.txt'), 'utf8')).toBe('captured\n')
    expect(readFileSync(resolve(outside, 'file.txt'), 'utf8')).toBe('outside\n')
  })

  it('recreates a captured parent directory after it is replaced by a file', async () => {
    const root = makeRoot('pluxx-checkpoint-parent-file-')
    write(root, 'nested/file.txt', 'captured\n')
    const checkpoint = await createEnforcementCheckpoint(root)
    rmSync(resolve(root, 'nested'), { recursive: true })
    write(root, 'nested', 'replacement file\n')

    await restoreCheckpoint(root, checkpoint.directory)

    expect(readFileSync(resolve(root, 'nested/file.txt'), 'utf8')).toBe('captured\n')
  })

  it('rejects manifest paths that escape the project root', async () => {
    const root = makeRoot('pluxx-checkpoint-traversal-')
    write(root, 'safe.txt', 'safe\n')
    const checkpoint = await createEnforcementCheckpoint(root)
    const manifestPath = resolve(checkpoint.directory, 'manifest.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      files: Array<{ path: string }>
    }
    manifest.files[0]!.path = '../outside.txt'
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

    await expect(loadCheckpoint(checkpoint.directory)).rejects.toThrow(/unsafe checkpoint path/i)
    await expect(restoreCheckpoint(root, checkpoint.directory)).rejects.toThrow(/unsafe checkpoint path/i)
  })

  it('validates every payload before mutating the workspace during restore', async () => {
    const root = makeRoot('pluxx-checkpoint-integrity-')
    write(root, 'keep.txt', 'before\n')
    const checkpoint = await createEnforcementCheckpoint(root)
    const captured = checkpoint.manifest.files.find((file) => file.path === 'keep.txt')!
    writeFileSync(resolve(checkpoint.directory, 'payloads', captured.digest), 'corrupt\n')
    write(root, 'keep.txt', 'current\n')
    write(root, 'new.txt', 'must survive failed restore\n')

    await expect(restoreCheckpoint(root, checkpoint.directory)).rejects.toThrow(/integrity validation/i)
    expect(readFileSync(resolve(root, 'keep.txt'), 'utf8')).toBe('current\n')
    expect(readFileSync(resolve(root, 'new.txt'), 'utf8')).toBe('must survive failed restore\n')
  })
})
