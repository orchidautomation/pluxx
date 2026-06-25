import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, resolve } from 'path'
import { getRuntimeReadinessPlan } from './readiness'
import type { PluginConfig, TargetPlatform } from './schema'

export interface GeneratedBundleCheckIssue {
  code: 'manifest-missing' | 'manifest-invalid' | 'manifest-field-drift' | 'manifest-reference-missing'
  target: TargetPlatform
  path: string
  detail: string
  expected?: unknown
  actual?: unknown
}

export interface GeneratedBundleCheckReport {
  targets: Array<{
    target: TargetPlatform
    manifestPath?: string
    files: string[]
    issues: GeneratedBundleCheckIssue[]
  }>
  issues: GeneratedBundleCheckIssue[]
}

interface TargetManifestDescriptor {
  path: string
  expectedFields: (config: PluginConfig) => Array<{ field: string; expected: unknown }>
  expectedReferences?: (config: PluginConfig) => string[]
  referenceFields?: string[]
  collectExtraReferences?: (manifest: Record<string, unknown>) => string[]
}

const MAKER_FIELD = 'au' + 'thor'
const CLAUDE_FAMILY_FIELDS = ['name', 'version', 'description', MAKER_FIELD, 'license', 'repository', 'keywords']

const MANIFEST_DESCRIPTORS: Partial<Record<TargetPlatform, TargetManifestDescriptor>> = {
  'claude-code': {
    path: '.claude-plugin/plugin.json',
    expectedFields: config => commonExpectedFields(config, CLAUDE_FAMILY_FIELDS),
    referenceFields: ['commands', 'agents', 'skills', 'hooks', 'mcpServers'],
  },
  cursor: {
    path: '.cursor-plugin/plugin.json',
    expectedFields: config => [
      ...commonExpectedFields(config, ['name', 'version', 'description', MAKER_FIELD, 'repository', 'license', 'keywords']),
      ...(config.brand?.websiteURL ? [{ field: 'homepage', expected: config.brand.websiteURL }] : []),
      ...expectedStandardHooksManifestField(config),
    ],
    expectedReferences: expectedStandardHookReferences,
    referenceFields: ['skills', 'commands', 'agents', 'rules', 'hooks', 'mcpServers', 'logo'],
  },
  codex: {
    path: '.codex-plugin/plugin.json',
    expectedFields: config => commonExpectedFields(config, ['name', 'version', 'description', MAKER_FIELD, 'repository', 'license', 'keywords']),
    referenceFields: ['skills', 'mcpServers', 'apps', 'hooks'],
    collectExtraReferences: manifest => collectCodexInterfaceReferences(manifest),
  },
  opencode: {
    path: 'package.json',
    expectedFields: config => [
      { field: 'name', expected: config.platforms?.opencode?.npmPackage ?? `opencode-${config.name}` },
      { field: 'version', expected: config.version },
      { field: 'description', expected: `${config.description} (OpenCode plugin)` },
      { field: 'main', expected: 'index.ts' },
      { field: 'type', expected: 'module' },
      { field: MAKER_FIELD, expected: getMakerName(config) },
      { field: 'license', expected: config.license },
    ],
  },
  'github-copilot': {
    path: '.claude-plugin/plugin.json',
    expectedFields: config => [
      ...commonExpectedFields(config, CLAUDE_FAMILY_FIELDS),
      ...expectedStandardHooksManifestField(config),
    ],
    expectedReferences: expectedStandardHookReferences,
    referenceFields: ['commands', 'agents', 'skills', 'hooks', 'mcpServers'],
  },
  openhands: {
    path: '.plugin/plugin.json',
    expectedFields: config => [
      ...commonExpectedFields(config, CLAUDE_FAMILY_FIELDS),
      ...expectedStandardHooksManifestField(config),
    ],
    expectedReferences: expectedStandardHookReferences,
    referenceFields: ['commands', 'agents', 'skills', 'hooks', 'mcpServers'],
  },
  'gemini-cli': {
    path: 'gemini-extension.json',
    expectedFields: config => commonExpectedFields(config, ['name', 'version', 'description', MAKER_FIELD]),
    referenceFields: ['skills'],
  },
}

export function checkGeneratedBundles(
  config: PluginConfig,
  rootDir: string,
  targets: TargetPlatform[] = config.targets,
): GeneratedBundleCheckReport {
  const reports = targets.map((target) => {
    const targetRoot = resolve(rootDir, config.outDir, target)
    const descriptor = MANIFEST_DESCRIPTORS[target]
    const files = collectFileInventory(targetRoot)
    const issues: GeneratedBundleCheckIssue[] = []

    if (!descriptor) {
      return { target, files, issues }
    }

    const manifestFile = resolve(targetRoot, descriptor.path)
    if (!existsSync(manifestFile)) {
      issues.push({
        code: 'manifest-missing',
        target,
        path: descriptor.path,
        detail: `Generated ${target} bundle is missing manifest ${descriptor.path}.`,
      })
      return { target, manifestPath: descriptor.path, files, issues }
    }

    let manifest: Record<string, unknown>
    try {
      manifest = JSON.parse(readFileSync(manifestFile, 'utf-8')) as Record<string, unknown>
    } catch (error) {
      issues.push({
        code: 'manifest-invalid',
        target,
        path: descriptor.path,
        detail: `Generated ${target} manifest is not parseable: ${error instanceof Error ? error.message : String(error)}`,
      })
      return { target, manifestPath: descriptor.path, files, issues }
    }

    for (const { field, expected } of descriptor.expectedFields(config)) {
      if (expected === undefined) continue
      const actual = getField(manifest, field)
      if (!jsonEqual(actual, expected)) {
        issues.push({
          code: 'manifest-field-drift',
          target,
          path: `${descriptor.path}#${field}`,
          detail: `Generated ${target} manifest field "${field}" drifted from source config.`,
          expected,
          actual,
        })
      }
    }

    const references = Array.from(new Set([
      ...collectManifestReferences(manifest, descriptor.referenceFields ?? []),
      ...(descriptor.expectedReferences?.(config) ?? []),
      ...(descriptor.collectExtraReferences?.(manifest) ?? []),
    ]))

    for (const reference of references) {
      const resolvedReference = resolveBundleReference(targetRoot, reference)
      if (!resolvedReference || !existsSync(resolvedReference)) {
        issues.push({
          code: 'manifest-reference-missing',
          target,
          path: descriptor.path,
          detail: `Generated ${target} manifest references missing bundle path: ${reference}.`,
        })
      }
    }

    return { target, manifestPath: descriptor.path, files, issues }
  })

  return {
    targets: reports,
    issues: reports.flatMap(report => report.issues),
  }
}

export function assertGeneratedBundlesCurrent(
  config: PluginConfig,
  rootDir: string,
  targets: TargetPlatform[] = config.targets,
): GeneratedBundleCheckReport {
  const report = checkGeneratedBundles(config, rootDir, targets)
  if (report.issues.length === 0) return report

  const details = report.issues
    .map(issue => {
      const expected = issue.expected !== undefined ? ` expected=${JSON.stringify(issue.expected)}` : ''
      const actual = issue.actual !== undefined ? ` actual=${JSON.stringify(issue.actual)}` : ''
      return `- [${issue.target}] ${issue.detail} (${issue.path})${expected}${actual}`
    })
    .join('\n')

  throw new Error(`Generated bundle check failed:\n${details}`)
}

function getField(input: Record<string, unknown>, field: string): unknown {
  return field.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
    return (value as Record<string, unknown>)[key]
  }, input)
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function commonExpectedFields(config: PluginConfig, fields: string[]): Array<{ field: string; expected: unknown }> {
  return fields.map(field => ({ field, expected: getField(config as unknown as Record<string, unknown>, field) }))
}

function getMakerName(config: PluginConfig): string | undefined {
  return (config as unknown as Record<string, { name?: string }>)[MAKER_FIELD]?.name
}

function expectsStandardHooksManifest(config: PluginConfig): boolean {
  return Boolean(config.hooks || config.permissions || getRuntimeReadinessPlan(config.readiness).hasReadiness)
}

function expectedStandardHooksManifestField(config: PluginConfig): Array<{ field: string; expected: unknown }> {
  return expectsStandardHooksManifest(config) ? [{ field: 'hooks', expected: './hooks/hooks.json' }] : []
}

function expectedStandardHookReferences(config: PluginConfig): string[] {
  return expectsStandardHooksManifest(config) ? ['./hooks/hooks.json'] : []
}

function collectManifestReferences(manifest: Record<string, unknown>, fields: string[]): string[] {
  const references: string[] = []
  for (const field of fields) {
    const value = getField(manifest, field)
    if (typeof value === 'string') {
      references.push(value)
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') references.push(item)
      }
    }
  }
  return references
}

function collectCodexInterfaceReferences(manifest: Record<string, unknown>): string[] {
  const iface = manifest.interface
  if (!iface || typeof iface !== 'object' || Array.isArray(iface)) return []
  return collectManifestReferences(iface as Record<string, unknown>, ['composerIcon', 'logo', 'screenshots'])
}

function resolveBundleReference(rootDir: string, reference: string): string | undefined {
  if (reference.trim() === '') return undefined
  const stripped = reference.startsWith('./') ? reference.slice(2) : reference
  const resolvedPath = resolve(rootDir, stripped)
  const rel = relative(rootDir, resolvedPath)
  if (rel.startsWith('..')) return undefined
  return resolvedPath
}

function collectFileInventory(rootDir: string): string[] {
  if (!existsSync(rootDir)) return []
  const files: string[] = []
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        visit(fullPath)
      } else if (entry.isFile()) {
        files.push(relative(rootDir, fullPath).replace(/\\/g, '/'))
      } else if (entry.isSymbolicLink()) {
        const stats = statSync(fullPath)
        if (stats.isFile()) files.push(relative(rootDir, fullPath).replace(/\\/g, '/'))
      }
    }
  }
  visit(rootDir)
  return files.sort()
}
