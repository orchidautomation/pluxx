import { constants, existsSync } from 'fs'
import { lstat, mkdir, open, readFile, writeFile } from 'fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'path'

export async function readTextFile(path: string): Promise<string> {
  return readFile(path, 'utf-8')
}

export async function readTextFileIfExists(path: string): Promise<string | undefined> {
  if (!existsSync(path)) {
    return undefined
  }

  return readTextFile(path)
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, 'utf-8')
}

export async function assertWorkspacePathNotSymlink(rootDir: string, targetPath: string): Promise<void> {
  const root = resolve(rootDir)
  const target = resolve(targetPath)
  const fromRoot = relative(root, target)
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new Error(`Path is outside the workspace: ${targetPath}`)
  }
  let cursor = root
  for (const part of fromRoot.split(sep).filter(Boolean)) {
    cursor = resolve(cursor, part)
    try {
      if ((await lstat(cursor)).isSymbolicLink()) {
        throw new Error(`Refusing to write through workspace symbolic link: ${relative(root, cursor)}`)
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return
      throw error
    }
  }
}

export async function writePrivateTextFile(rootDir: string, path: string, content: string): Promise<void> {
  await assertWorkspacePathNotSymlink(rootDir, dirname(path))
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await assertWorkspacePathNotSymlink(rootDir, path)
  const handle = await open(
    path,
    constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW,
    0o600,
  )
  try {
    await handle.writeFile(content, 'utf8')
  } finally {
    await handle.close()
  }
}

export async function appendUniqueLines(path: string, entries: string[]): Promise<void> {
  let content = ''
  try {
    content = await readFile(path, 'utf-8')
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
  }
  const existing = new Set(content.split(/\r?\n/).map((line) => line.trim()))
  const additions = entries.filter((entry) => !existing.has(entry))
  if (additions.length === 0) return
  const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : ''
  await writeTextFile(path, `${content}${separator}${additions.join('\n')}\n`)
}

export async function planTextFileAction(
  path: string,
  content: string,
): Promise<'create' | 'update' | 'unchanged'> {
  if (!existsSync(path)) {
    return 'create'
  }

  return (await readTextFile(path)) === content ? 'unchanged' : 'update'
}
