import { resolve, extname, dirname } from 'path'
import { existsSync } from 'fs'
import { readFile, rm, writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { createJiti } from 'jiti'
import { PluginConfigSchema, type PluginConfig } from '../schema'

export const CONFIG_FILES = [
  'pluxx.config.ts',
  'pluxx.config.js',
  'pluxx.config.json',
]

function getRuntimePackageEntry(): string {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const distEntry = resolve(packageRoot, 'dist', 'index.js')

  if (existsSync(distEntry)) {
    return distEntry
  }

  return resolve(packageRoot, 'src', 'index.ts')
}

async function importConfigModule(filepath: string): Promise<unknown> {
  const ext = extname(filepath)
  const runtimeEntry = getRuntimePackageEntry()
  const source = await readFile(filepath, 'utf-8')
  const rewritten = source
    .replace(/from\s+(['"])pluxx\1/g, `from ${JSON.stringify(runtimeEntry)}`)
    .replace(/import\s+(['"])pluxx\1/g, `import ${JSON.stringify(runtimeEntry)}`)
    .replace(/from\s+(['"])@orchid-labs\/pluxx\1/g, `from ${JSON.stringify(runtimeEntry)}`)
    .replace(/import\s+(['"])@orchid-labs\/pluxx\1/g, `import ${JSON.stringify(runtimeEntry)}`)

  const tempFile = resolve(
    dirname(filepath),
    `.pluxx-load-config-${Date.now()}-${Math.random().toString(36).slice(2)}${ext || '.js'}`,
  )
  await writeFile(tempFile, rewritten)

  const jiti = createJiti(import.meta.url, {
    interopDefault: true,
    moduleCache: false,
    fsCache: false,
  })
  try {
    return await jiti.import(tempFile, { default: true })
  } finally {
    await rm(tempFile, { force: true })
  }
}

/**
 * Load and validate a pluxx config from the given directory.
 */
export async function loadConfig(dir: string = process.cwd()): Promise<PluginConfig> {
  for (const filename of CONFIG_FILES) {
    const filepath = resolve(dir, filename)
    if (!existsSync(filepath)) continue

    const ext = extname(filename)

    if (ext === '.ts' || ext === '.js') {
      const raw = await importConfigModule(filepath)
      return PluginConfigSchema.parse(raw)
    }

    if (ext === '.json') {
      const text = await readFile(filepath, 'utf-8')
      return PluginConfigSchema.parse(JSON.parse(text))
    }
  }

  throw new Error(
    `No pluxx config found in ${dir}. Expected one of: ${CONFIG_FILES.join(', ')}`
  )
}
