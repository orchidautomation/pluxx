import { resolve, extname } from 'path'
import { existsSync } from 'fs'
import { PluginConfigSchema, type PluginConfig } from '../schema'

const CONFIG_FILES = [
  'pluxx.config.ts',
  'pluxx.config.js',
  'pluxx.config.json',
  'pluxx.config.yaml',
  'pluxx.config.yml',
]

/**
 * Load and validate a pluxx config from the given directory.
 */
export async function loadConfig(dir: string = process.cwd()): Promise<PluginConfig> {
  for (const filename of CONFIG_FILES) {
    const filepath = resolve(dir, filename)
    if (!existsSync(filepath)) continue

    const ext = extname(filename)

    if (ext === '.ts' || ext === '.js') {
      const mod = await import(filepath)
      const raw = mod.default ?? mod
      return PluginConfigSchema.parse(raw)
    }

    if (ext === '.json') {
      const text = await Bun.file(filepath).text()
      return PluginConfigSchema.parse(JSON.parse(text))
    }

    // TODO: YAML support
  }

  throw new Error(
    `No pluxx config found in ${dir}. Expected one of: ${CONFIG_FILES.join(', ')}`
  )
}
