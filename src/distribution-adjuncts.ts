import { createHash } from 'crypto'
import {
  existsSync,
  lstatSync,
  readFileSync,
} from 'fs'
import { relative, resolve } from 'path'
import { z } from 'zod'
import {
  CORE_FOUR_INSTALL_DISCOVERY_CAPABILITIES,
  getHostInstallDiscoveryCapability,
  type CoreFourTargetPlatform,
} from './distribution-lifecycle'
import {
  applyFileMutations,
  assertNoSymlinkComponents,
  resolveWithinRoot,
  type FileMutation,
  type MutationHooks,
} from './fs-transaction'
import { stableStringify } from './stable-json'
import { PLUXX_COMPILER_BUCKETS, PluginNameSchema } from './compiler-contract'

export const DISTRIBUTION_ADJUNCT_RECEIPT_PATH = 'distribution/adjuncts.receipt.json'

export const DistributionAdjunctKindSchema = z.enum([
  'identity-manifest',
  'registration-catalog',
  'lifecycle-entrypoint',
  'helper-payload',
  'host-native-extension',
  'source-only-evidence',
])

export const DistributionAdjunctOwnerSchema = z.enum(PLUXX_COMPILER_BUCKETS)

const CORE_FOUR_ADJUNCT_PLATFORMS = CORE_FOUR_INSTALL_DISCOVERY_CAPABILITIES
  .map(capability => capability.platform) as [CoreFourTargetPlatform, ...CoreFourTargetPlatform[]]
export const DistributionAdjunctHostSchema = z.enum(CORE_FOUR_ADJUNCT_PLATFORMS)

export const DistributionAdjunctSourcePlatformSchema = z.enum([
  'shared',
  'source-only',
  ...CORE_FOUR_ADJUNCT_PLATFORMS,
])

const SAFE_RELATIVE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[^\0]+$/
const SHA256 = /^[a-f0-9]{64}$/

const DistributionAdjunctItemShape = {
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  kind: DistributionAdjunctKindSchema,
  source: z.string().min(1).regex(SAFE_RELATIVE_PATH),
  target: z.string().min(1).regex(SAFE_RELATIVE_PATH),
  sourcePlatform: DistributionAdjunctSourcePlatformSchema,
  canonicalOwner: DistributionAdjunctOwnerSchema,
  availability: z.enum(['present', 'source-inspected', 'external-unavailable']).default('present'),
  digest: z.string().regex(SHA256).optional(),
  executable: z.boolean().default(false),
  requiredForPublication: z.boolean().default(false),
} as const

function validateDistributionAdjunctItem(
  item: z.infer<z.ZodObject<typeof DistributionAdjunctItemShape>>,
  context: z.RefinementCtx,
): void {
  if (item.availability !== 'external-unavailable' && !item.digest) {
    context.addIssue({ code: 'custom', path: ['digest'], message: 'Present and source-inspected adjuncts require an exact SHA-256 digest.' })
  }
  if (item.availability === 'external-unavailable' && item.digest) {
    context.addIssue({ code: 'custom', path: ['digest'], message: 'Unavailable external adjuncts cannot claim a content digest.' })
  }
  if (item.availability === 'external-unavailable' && item.executable) {
    context.addIssue({ code: 'custom', path: ['executable'], message: 'Unavailable external adjuncts cannot claim an executable mode.' })
  }
}

export const DistributionAdjunctItemSchema = z.object(DistributionAdjunctItemShape).strict()
  .superRefine(validateDistributionAdjunctItem)

export const DistributionAdjunctProvenanceSchema = z.object({
  fixture: PluginNameSchema,
  plugin: PluginNameSchema,
  version: z.string().min(1),
  revision: z.string().min(1),
  digest: z.string().regex(SHA256),
  evidenceTier: z.enum(['fixture-source-inspection', 'migrated-source-tree']).default('fixture-source-inspection'),
}).strict()

export const DistributionAdjunctCompiledPluginSchema = z.object({
  name: PluginNameSchema,
  version: z.string().min(1),
}).strict()

export const DistributionAdjunctSourceSchema = z.object({
  provenance: DistributionAdjunctProvenanceSchema,
  items: z.array(DistributionAdjunctItemSchema),
}).strict()

export type DistributionAdjunctItem = z.infer<typeof DistributionAdjunctItemSchema>
export type DistributionAdjunctSource = z.infer<typeof DistributionAdjunctSourceSchema>
export type DistributionAdjunctKind = z.infer<typeof DistributionAdjunctKindSchema>
export type DistributionAdjunctMode = 'preserve' | 'translate' | 'degrade' | 'drop'

export function computeDistributionAdjunctInventoryDigest(
  items: readonly unknown[],
): string {
  const parsed = z.array(DistributionAdjunctItemSchema).parse(items)
  return sha256(stableStringify([...parsed].sort((left, right) => left.id.localeCompare(right.id))))
}

export const DistributionAdjunctOutcomeSchema = z.object({
  platform: DistributionAdjunctHostSchema,
  adjunctId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  mode: z.enum(['preserve', 'translate', 'degrade', 'drop']),
  mechanism: z.string().min(1),
  rationale: z.string().min(1),
  evidenceTier: z.enum(['fixture-source-inspection', 'migrated-source-tree']),
}).strict()

const DistributionAdjunctReceiptInventoryEntrySchema = z.object({
  ...DistributionAdjunctItemShape,
  outcome: DistributionAdjunctOutcomeSchema,
}).strict().superRefine((entry, context) => validateDistributionAdjunctItem(entry, context))

export const DistributionAdjunctReceiptSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal('pluxx-distribution-adjunct-receipt'),
  proofTier: z.enum(['fixture-source-inspection', 'migrated-source-tree']),
  identity: DistributionAdjunctProvenanceSchema,
  compiledPlugin: DistributionAdjunctCompiledPluginSchema,
  host: DistributionAdjunctHostSchema,
  inventory: z.array(DistributionAdjunctReceiptInventoryEntrySchema),
  ownedOutputs: z.array(z.object({
    path: z.string().min(1).regex(SAFE_RELATIVE_PATH),
    digest: z.string().regex(SHA256),
    executable: z.boolean(),
  }).strict()),
  compilerOutputDigest: z.string().regex(SHA256),
  receiptDigest: z.string().regex(SHA256),
}).strict()

export type DistributionAdjunctOutcome = z.infer<typeof DistributionAdjunctOutcomeSchema>
export type DistributionAdjunctReceipt = z.infer<typeof DistributionAdjunctReceiptSchema>

export function compileDistributionAdjunctInventory(input: unknown): DistributionAdjunctSource {
  const parsed = DistributionAdjunctSourceSchema.parse(input)
  const ids = new Set<string>()
  const ownedTargets = new Set<string>()

  for (const item of parsed.items) {
    if (ids.has(item.id)) throw new Error(`Duplicate adjunct id "${item.id}".`)
    ids.add(item.id)

    if (item.target === DISTRIBUTION_ADJUNCT_RECEIPT_PATH
      || item.target === '.pluxx/transactions'
      || item.target.startsWith('.pluxx/transactions/')) {
      throw new Error(`Adjunct target ${item.target} is reserved for compiler-owned transaction output.`)
    }
    if (item.availability === 'present' && item.sourcePlatform !== 'source-only') {
      if (ownedTargets.has(item.target)) throw new Error(`Unowned adjunct target collision at ${item.target}.`)
      ownedTargets.add(item.target)
    }
  }

  const inventoryDigest = computeDistributionAdjunctInventoryDigest(parsed.items)
  if (parsed.provenance.digest !== inventoryDigest) {
    throw new Error(`Distribution adjunct inventory digest mismatch: expected ${parsed.provenance.digest}, got ${inventoryDigest}.`)
  }

  return {
    provenance: parsed.provenance,
    items: [...parsed.items].sort((a, b) => a.id.localeCompare(b.id)),
  }
}

export function getDistributionAdjunctOutcome(
  platform: CoreFourTargetPlatform,
  input: DistributionAdjunctItem,
): DistributionAdjunctOutcome {
  const item = DistributionAdjunctItemSchema.parse(input)
  const host = getHostInstallDiscoveryCapability(platform)
  return resolveDistributionAdjunctOutcome(platform, item, host.label, 'fixture-source-inspection')
}

function resolveDistributionAdjunctOutcome(
  platform: CoreFourTargetPlatform,
  item: DistributionAdjunctItem,
  hostLabel: string,
  evidenceTier: 'fixture-source-inspection' | 'migrated-source-tree',
): DistributionAdjunctOutcome {
  let mode: DistributionAdjunctMode
  let rationale: string

  if (item.sourcePlatform === 'source-only' || item.kind === 'source-only-evidence') {
    mode = 'drop'
    rationale = 'Source-repository release or maintenance evidence is accounted for but is not a consumer-host payload.'
  } else if (item.availability === 'external-unavailable') {
    mode = item.sourcePlatform === platform ? 'degrade' : 'drop'
    rationale = item.sourcePlatform === platform
      ? 'The pinned fixture names this host adjunct but does not own pinned bytes, so publication cannot preserve it.'
      : 'The unavailable host-specific adjunct has no target-native representation on this host.'
  } else if (item.availability === 'source-inspected') {
    mode = item.kind === 'identity-manifest' ? 'translate' : 'degrade'
    rationale = mode === 'translate'
      ? `Pinned source identity informs ${hostLabel}'s generated manifest without copying source manifest bytes.`
      : 'The pinned fixture proves the source bytes, but the bounded fixture does not vendor a publishable payload for this host.'
  } else if (item.sourcePlatform === 'shared') {
    mode = item.kind === 'helper-payload' ? 'preserve' : 'translate'
    rationale = item.kind === 'helper-payload'
      ? 'The exact support payload is portable when its relative path, digest, and executable mode remain owned.'
      : `Shared adjunct intent is translated through ${hostLabel}'s existing install and discovery surface.`
  } else if (item.sourcePlatform === platform) {
    mode = 'preserve'
    rationale = `The pinned fixture proves an exact ${hostLabel} native adjunct at this path.`
  } else if (item.kind === 'identity-manifest') {
    mode = 'translate'
    rationale = `Only common identity and supported branding fields translate into ${hostLabel}'s native manifest.`
  } else if (item.kind === 'helper-payload') {
    mode = 'preserve'
    rationale = 'The helper payload remains portable, but its execution semantics require separate runtime evidence.'
  } else {
    mode = 'drop'
    rationale = `A sibling-host adjunct is not copied into ${hostLabel}'s bundle.`
  }

  return {
    platform,
    adjunctId: item.id,
    mode,
    mechanism: `${platform}:${item.kind}:${mode}`,
    rationale,
    evidenceTier,
  }
}

export function buildDistributionAdjunctOutcomes(
  source: DistributionAdjunctSource,
  platform: CoreFourTargetPlatform,
): DistributionAdjunctOutcome[] {
  const compiled = compileDistributionAdjunctInventory(source)
  return buildCompiledDistributionAdjunctOutcomes(compiled, platform)
}

function buildCompiledDistributionAdjunctOutcomes(
  source: DistributionAdjunctSource,
  platform: CoreFourTargetPlatform,
): DistributionAdjunctOutcome[] {
  const hostLabel = getHostInstallDiscoveryCapability(platform).label
  return source.items.map(item => resolveDistributionAdjunctOutcome(
    platform,
    item,
    hostLabel,
    source.provenance.evidenceTier,
  ))
}

export function publishDistributionAdjuncts(
  input: DistributionAdjunctSource,
  platform: CoreFourTargetPlatform,
  rootDir: string,
  outDir: string,
  compiledPlugin?: { name: string; version: string },
  mutationHooks: MutationHooks = {},
): DistributionAdjunctReceipt {
  const source = compileDistributionAdjunctInventory(input)
  const compiledIdentity = DistributionAdjunctCompiledPluginSchema.parse(compiledPlugin ?? {
    name: source.provenance.plugin,
    version: source.provenance.version,
  })
  const outcomes = new Map(buildCompiledDistributionAdjunctOutcomes(source, platform).map(outcome => [outcome.adjunctId, outcome]))
  const publications: Array<{ item: DistributionAdjunctItem; content: Buffer; mode: number }> = []

  for (const item of source.items) {
    const outcome = outcomes.get(item.id)!
    if (item.availability !== 'present') {
      if (item.requiredForPublication && (item.sourcePlatform === platform || item.sourcePlatform === 'shared')) {
        throw new Error(`Required adjunct ${item.id} is unavailable in the pinned fixture; refusing publication.`)
      }
      continue
    }
    if (outcome.mode !== 'preserve') continue

    assertNoSymlinkComponents(rootDir, item.source)
    const sourcePath = resolveInside(rootDir, item.source, `adjunct ${item.id} source`)
    const { content, mode: sourceMode } = readRequiredAdjunctFile(sourcePath, item.source)
    const digest = sha256(content)
    if (digest !== item.digest) throw new Error(`Adjunct ${item.id} digest mismatch: expected ${item.digest}, got ${digest}.`)
    const sourceExecutable = (sourceMode & 0o111) !== 0
    if (item.executable !== sourceExecutable) {
      throw new Error(`Adjunct ${item.id} executable declaration does not match its exact source mode.`)
    }

    assertNoSymlinkComponents(outDir, item.target)
    const targetPath = resolveInside(outDir, item.target, `adjunct ${item.id} target`)
    let output: Buffer = Buffer.from(content)
    if (existsSync(targetPath)) {
      if (item.kind === 'identity-manifest' && item.target.endsWith('.json')) {
        output = mergeNativeManifest(content, readFileSync(targetPath), source.provenance)
      } else {
        throw new Error(`Adjunct target ${item.target} is already compiler-owned; refusing competing ownership.`)
      }
    }
    publications.push({ item, content: output, mode: item.executable ? 0o755 : 0o644 })
  }

  const ownedOutputs = publications.map(publication => ({
    path: publication.item.target,
    digest: sha256(publication.content),
    executable: (publication.mode & 0o111) !== 0,
  })).sort((left, right) => left.path.localeCompare(right.path))
  const inventory = source.items.map(item => ({ ...item, outcome: outcomes.get(item.id)! }))
  const withoutReceiptDigest = {
    schemaVersion: 1 as const,
    kind: 'pluxx-distribution-adjunct-receipt' as const,
    proofTier: source.provenance.evidenceTier,
    identity: source.provenance,
    compiledPlugin: compiledIdentity,
    host: platform,
    inventory,
    ownedOutputs,
    compilerOutputDigest: sha256(stableStringify({
      compiledPlugin: compiledIdentity,
      outcomes: inventory.map(entry => entry.outcome),
      ownedOutputs,
    })),
  }
  const receipt = {
    ...withoutReceiptDigest,
    receiptDigest: sha256(stableStringify(withoutReceiptDigest)),
  }
  const receiptContent = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`)
  const mutations: FileMutation[] = publications.map(publication => ({
    path: publication.item.target,
    action: existsSync(resolveInside(outDir, publication.item.target, `adjunct ${publication.item.id} target`))
      ? 'update'
      : 'create',
    content: publication.content,
    mode: publication.mode,
  }))
  mutations.push({
    path: DISTRIBUTION_ADJUNCT_RECEIPT_PATH,
    action: existsSync(resolveInside(outDir, DISTRIBUTION_ADJUNCT_RECEIPT_PATH, 'adjunct receipt target'))
      ? 'update'
      : 'create',
    content: receiptContent,
    mode: 0o644,
  })
  applyFileMutations(outDir, mutations, mutationHooks)
  return receipt
}

export function validateDistributionAdjunctReceipt(value: unknown): DistributionAdjunctReceipt {
  const receipt = DistributionAdjunctReceiptSchema.parse(value)
  const source = compileDistributionAdjunctInventory({
    provenance: receipt.identity,
    items: (receipt.inventory ?? []).map(({ outcome: _outcome, ...item }) => item),
  })
  const outcomes = new Map(buildCompiledDistributionAdjunctOutcomes(source, receipt.host).map(outcome => [outcome.adjunctId, outcome]))
  if (receipt.inventory.some((entry, index) => entry.id !== source.items[index]?.id)) {
    throw new Error('Distribution adjunct receipt inventory is not in canonical order.')
  }
  for (const entry of receipt.inventory) {
    if (stableStringify(entry.outcome) !== stableStringify(outcomes.get(entry.id))) {
      throw new Error(`Distribution adjunct receipt is stale against registry policy for ${entry.id}.`)
    }
  }
  const expectedOwnedOutputPaths = receipt.inventory
    .filter(entry => entry.availability === 'present' && entry.outcome.mode === 'preserve')
    .map(entry => entry.target)
    .sort()
  if (stableStringify(receipt.ownedOutputs.map(output => output.path)) !== stableStringify(expectedOwnedOutputPaths)) {
    throw new Error('Distribution adjunct receipt owned output paths do not match its inventory policy.')
  }
  const expectedCompilerOutputDigest = sha256(stableStringify({
    compiledPlugin: receipt.compiledPlugin,
    outcomes: receipt.inventory.map(entry => entry.outcome),
    ownedOutputs: receipt.ownedOutputs,
  }))
  if (receipt.compilerOutputDigest !== expectedCompilerOutputDigest) {
    throw new Error('Distribution adjunct receipt compiler output digest does not match its compiled outcomes.')
  }
  const { receiptDigest, ...withoutDigest } = receipt
  if (sha256(stableStringify(withoutDigest)) !== receiptDigest) {
    throw new Error('Distribution adjunct receipt digest does not match its contents.')
  }
  return receipt
}

function readRequiredAdjunctFile(path: string, source: string): { content: Buffer; mode: number } {
  try {
    const stats = lstatSync(path)
    if (!stats.isFile()) throw new Error(`Required adjunct source ${source} is not a file.`)
    return { content: readFileSync(path), mode: stats.mode }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Required adjunct source ${source} is missing.`)
    }
    throw error
  }
}

function mergeNativeManifest(
  sourceContent: Buffer,
  generatedContent: Buffer,
  provenance: DistributionAdjunctSource['provenance'],
): Buffer {
  let source: Record<string, unknown>
  let generated: Record<string, unknown>
  try {
    source = JSON.parse(sourceContent.toString('utf-8')) as Record<string, unknown>
    generated = JSON.parse(generatedContent.toString('utf-8')) as Record<string, unknown>
  } catch {
    throw new Error('Native adjunct manifest merge requires valid JSON objects.')
  }
  for (const [field, expected] of [['name', provenance.plugin], ['version', provenance.version]] as const) {
    const values = [source[field], generated[field]].filter(value => value !== undefined)
    if (values.some(value => value !== expected)) {
      throw new Error(`Ambiguous manifest ${field}: expected ${expected}.`)
    }
  }
  for (const field of Object.keys(source)) {
    if (field === 'name' || field === 'version' || generated[field] === undefined) continue
    if (field === 'keywords' && Array.isArray(source[field]) && Array.isArray(generated[field])) {
      const generatedKeywords = new Set(generated[field])
      if (source[field].every(keyword => generatedKeywords.has(keyword))) continue
    }
    if (field === 'interface' && isJsonObjectSubset(source[field], generated[field])) continue
    if (stableStringify(source[field]) !== stableStringify(generated[field])) {
      throw new Error(`Ambiguous manifest field ${field}; refusing to overwrite host-native source truth.`)
    }
  }
  return Buffer.from(`${JSON.stringify({ ...source, ...generated }, null, 2)}\n`)
}

function isJsonObjectSubset(source: unknown, generated: unknown): boolean {
  if (!source || typeof source !== 'object' || Array.isArray(source)
    || !generated || typeof generated !== 'object' || Array.isArray(generated)) return false
  return Object.entries(source as Record<string, unknown>).every(([key, value]) => {
    const generatedValue = (generated as Record<string, unknown>)[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return isJsonObjectSubset(value, generatedValue)
    }
    return stableStringify(value) === stableStringify(generatedValue)
  })
}

function resolveInside(root: string, path: string, label: string): string {
  const absolute = resolveWithinRoot(root, path)
  if (relative(resolve(root), absolute) === '') throw new Error(`${label} must name a file below its root.`)
  return absolute
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}
