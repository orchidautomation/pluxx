import { createHash } from 'crypto'
import { existsSync, lstatSync, readFileSync } from 'fs'
import { dirname, relative, resolve } from 'path'
import { PluginNameSchema } from '../compiler-contract'
import {
  compileDistributionAdjunctInventory,
  computeDistributionAdjunctInventoryDigest,
  type DistributionAdjunctSource,
} from '../distribution-adjuncts'
import { assertNoSymlinkComponents } from '../fs-transaction'

type CoreFourPlatform = 'claude-code' | 'cursor' | 'codex' | 'opencode'

interface AdjunctDetection {
  platform: CoreFourPlatform
  manifestPath?: string
}

interface AdjunctIdentity {
  name?: string
  version?: string
}

export function detectDistributionAdjuncts(
  pluginDir: string,
  detections: readonly AdjunctDetection[],
  manifest: AdjunctIdentity,
): DistributionAdjunctSource | undefined {
  const privateLocalOverride = resolve(
    pluginDir,
    '.compound-engineering',
    ['config', 'local', 'yaml'].join('.'),
  )
  if (existsSync(privateLocalOverride)) {
    throw new Error('Refusing migration while a private local override is present; move it outside the source tree first.')
  }
  if (!manifest.name || !manifest.version || !PluginNameSchema.safeParse(manifest.name).success) return undefined

  const items: DistributionAdjunctSource['items'] = []
  const addFile = (
    id: string,
    kind: DistributionAdjunctSource['items'][number]['kind'],
    path: string,
    sourcePlatform: DistributionAdjunctSource['items'][number]['sourcePlatform'],
    canonicalOwner: DistributionAdjunctSource['items'][number]['canonicalOwner'] = 'distribution',
    availability: DistributionAdjunctSource['items'][number]['availability'] = 'present',
  ): boolean => {
    assertNoSymlinkComponents(pluginDir, path)
    const absolute = resolve(pluginDir, path)
    let stats: ReturnType<typeof lstatSync>
    try {
      stats = lstatSync(absolute)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
      throw error
    }
    if (!stats.isFile()) return false
    const content = readFileSync(absolute)
    items.push({
      id,
      kind,
      source: path,
      target: path,
      sourcePlatform,
      canonicalOwner,
      availability,
      digest: createHash('sha256').update(content).digest('hex'),
      executable: (stats.mode & 0o111) !== 0,
      requiredForPublication: false,
    })
    return true
  }

  for (const detection of detections) {
    if (!detection.manifestPath) continue
    const path = relative(pluginDir, detection.manifestPath).split('\\').join('/')
    if (path === 'package.json') {
      addFile(`${detection.platform}-package-identity`, 'identity-manifest', path, detection.platform, 'distribution', 'source-inspected')
    } else {
      addFile(`${detection.platform}-plugin-manifest`, 'identity-manifest', path, detection.platform)
    }
    const marketplace = relative(pluginDir, resolve(dirname(detection.manifestPath), 'marketplace.json')).split('\\').join('/')
    addFile(`${detection.platform}-marketplace-catalog`, 'registration-catalog', marketplace, detection.platform)
  }
  addFile('codex-agents-marketplace-catalog', 'registration-catalog', '.agents/plugins/marketplace.json', 'codex')
  addFile('local-config-schema', 'helper-payload', '.compound-engineering/config.local.example.yaml', 'shared')

  const pkg = readOptionalJson(resolve(pluginDir, 'package.json'))
  const detectedOpenCode = detections.some(detection => detection.platform === 'opencode')
  if (detectedOpenCode && typeof pkg?.main === 'string' && pkg.main.trim()) {
    const entrypoint = stripRelativePrefix(pkg.main)
    if (!addFile('opencode-plugin-entrypoint', 'lifecycle-entrypoint', entrypoint, 'opencode', 'runtime')) {
      throw new Error(`OpenCode package main references missing lifecycle entrypoint ${entrypoint}.`)
    }
  }

  if (items.length === 0) return undefined
  const digest = computeDistributionAdjunctInventoryDigest(items)
  return compileDistributionAdjunctInventory({
    provenance: {
      fixture: manifest.name,
      plugin: manifest.name,
      version: manifest.version,
      revision: `source-tree:${digest}`,
      digest,
      evidenceTier: 'migrated-source-tree',
    },
    items,
  })
}

function stripRelativePrefix(path: string): string {
  return path.replace(/^\.\//, '')
}

function readOptionalJson(path: string): Record<string, unknown> | undefined {
  if (!existsSync(path)) return undefined
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
  } catch {
    return undefined
  }
}
