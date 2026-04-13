import { resolve, extname, dirname } from 'path'
import { existsSync } from 'fs'
import { rm } from 'fs/promises'
import { fileURLToPath, pathToFileURL } from 'url'
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
  const runtimeEntryUrl = pathToFileURL(getRuntimePackageEntry()).href
  const source = await Bun.file(filepath).text()
  const rewritten = source
    .replace(/from\s+(['"])pluxx\1/g, `from ${JSON.stringify(runtimeEntryUrl)}`)
    .replace(/import\s+(['"])pluxx\1/g, `import ${JSON.stringify(runtimeEntryUrl)}`)

  const transpiler = new Bun.Transpiler({
    loader: ext === '.ts' ? 'ts' : 'js',
  })

  const tempFile = resolve(
    dirname(filepath),
    `.pluxx-load-config-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`,
  )
  await Bun.write(tempFile, transpiler.transformSync(rewritten))

  try {
    const mod = await import(`${pathToFileURL(tempFile).href}?t=${Date.now()}`)
    return mod.default ?? mod
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
      const text = await Bun.file(filepath).text()
      return PluginConfigSchema.parse(JSON.parse(text))
    }
  }

  throw new Error(
    `No pluxx config found in ${dir}. Expected one of: ${CONFIG_FILES.join(', ')}`
  )
}
