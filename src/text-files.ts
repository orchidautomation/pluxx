import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname } from 'path'

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

export async function planTextFileAction(
  path: string,
  content: string,
): Promise<'create' | 'update' | 'unchanged'> {
  if (!existsSync(path)) {
    return 'create'
  }

  return (await readTextFile(path)) === content ? 'unchanged' : 'update'
}
