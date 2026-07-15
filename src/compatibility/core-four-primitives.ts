import { PLUXX_COMPILER_BUCKETS, type PluxxCompilerBucket } from '../schema'
import {
  CORE_FOUR_PLATFORMS,
  getCoreFourCompilerBucketCapability,
  type CoreFourPlatform,
  type PrimitiveTranslationMode,
} from '../validation/platform-rules'
import { getFieldTranslationEntries, type FieldTranslationPrimitive } from '../field-translation-registry'
import { ORCHESTRATION_CAPABILITY_FIELDS, ORCHESTRATION_CAPABILITY_REGISTRY } from '../orchestration-capability-registry'
import type { OrchestrationRuntimeProofSummary } from '../orchestration-runtime-proof'

const PLATFORM_LABELS: Record<CoreFourPlatform, string> = {
  'claude-code': 'Claude Code',
  cursor: 'Cursor',
  codex: 'Codex',
  opencode: 'OpenCode',
}

const MODE_LABELS: Record<PrimitiveTranslationMode, string> = {
  preserve: 'preserve',
  translate: 'translate',
  degrade: 'degrade',
  drop: 'drop',
}

export const CORE_FOUR_PRIMITIVE_SECTION_START = '<!-- pluxx:core-four-primitives:start -->'
export const CORE_FOUR_PRIMITIVE_SECTION_END = '<!-- pluxx:core-four-primitives:end -->'

function formatNativeSurfaces(surfaces: string[]): string {
  return surfaces.length > 0 ? surfaces.join(', ') : 'No honest native surface'
}

function formatCapabilityCell(platform: CoreFourPlatform, bucket: PluxxCompilerBucket): string {
  const lookup = getCoreFourCompilerBucketCapability(platform, bucket)
  if (lookup.status === 'unmapped') return '`unmapped` -> Phase 2 host mapping not declared'
  const capability = lookup.capability
  return `\`${MODE_LABELS[capability.mode]}\` -> ${formatNativeSurfaces(capability.nativeSurfaces)}`
}

function formatBucketNotes(bucket: PluxxCompilerBucket): string[] {
  const lines: string[] = []

  for (const platform of CORE_FOUR_PLATFORMS) {
    const lookup = getCoreFourCompilerBucketCapability(platform, bucket)
    if (lookup.status === 'unmapped') continue
    const capability = lookup.capability
    if (!capability.notes) continue
    lines.push(`- ${PLATFORM_LABELS[platform]}: ${capability.notes}`)
  }

  return lines
}

function formatFieldOutcomeCell(entry: ReturnType<typeof getFieldTranslationEntries>[number], platform: CoreFourPlatform): string {
  const outcome = entry.platforms[platform]
  const surfaces = outcome.nativeSurfaces.length > 0 ? outcome.nativeSurfaces.join(', ') : 'omitted'
  return `\`${outcome.mode}\` -> ${surfaces}`
}

function formatFieldTruthSection(primitive: FieldTranslationPrimitive): string[] {
  const lines = [
    `### Audited \`${primitive}\` field outcomes`,
    '',
    '| Field | Claude Code | Cursor | Codex | OpenCode |',
    '|---|---|---|---|---|',
  ]

  for (const entry of getFieldTranslationEntries(primitive)) {
    lines.push(`| \`${entry.field}\` | ${CORE_FOUR_PLATFORMS.map(platform => formatFieldOutcomeCell(entry, platform)).join(' | ')} |`)
  }

  return [...lines, '']
}

function formatOrchestrationFieldTruthSection(proof?: OrchestrationRuntimeProofSummary): string[] {
  const lines = [
    '### Audited `orchestration` field outcomes',
    '',
    proof ? formatOrchestrationProofStatement(proof) : 'Installed/runtime proof is maintained separately from the compiler registry. Every current effective registry outcome remains explicit degradation until mechanism-specific behavioral evidence is validated.',
    '',
    '| Field | Claude Code | Cursor | Codex | OpenCode |',
    '|---|---|---|---|---|',
  ]

  for (const field of ORCHESTRATION_CAPABILITY_FIELDS) {
    const cells = CORE_FOUR_PLATFORMS.map(platform => {
      const row = ORCHESTRATION_CAPABILITY_REGISTRY.find(candidate => candidate.field === field && candidate.platform === platform)
      if (!row) throw new Error(`Missing orchestration registry row for ${field} on ${platform}.`)
      return `\`${row.mode}\` -> ${row.mechanism}<br/>activation: ${row.activationRequirement}; enforcement: ${row.enforcement}; child environment: ${row.childEnvironmentOutcome}; evidence: ${row.evidenceTier}<br/>${row.rationale}`
    })
    lines.push(`| \`${field}\` | ${cells.join(' | ')} |`)
  }

  return [...lines, '']
}

function formatOrchestrationProofStatement(proof: OrchestrationRuntimeProofSummary): string {
  if (proof.receiptCount !== 12 || proof.generatedProven !== 12 || proof.installedProven !== 12
    || proof.discoveryProven !== 0 || proof.discoveryEnvironmentUnavailable !== 12
    || proof.activationUnsupported !== 12 || proof.behavioralEnvironmentUnavailable !== 12
    || proof.fieldOutcomeCount !== 324 || proof.degradedOutcomeCount !== 324
    || proof.adjunctReceiptCount !== 12 || proof.adjunctInventoryCount !== 176
    || proof.adjunctOwnershipProven !== 12) {
    throw new Error(`Core-four orchestration proof summary is incomplete: ${JSON.stringify(proof)}`)
  }
  return 'Phase 5 maintains 12 validated deterministic `fake-home-install` receipts under `tests/fixtures/orchestration-runtime-receipts`, now bound to 176 pinned fixture adjunct inventory rows and install ownership. Exact source identity, revision, digest, host outcome policy, compiler output digest, and receipt digest are validated for Claude Code, Cursor, Codex, and OpenCode. Generated registration artifacts remain isolated evidence only: real-host discovery is environment-unavailable in all 12 cases, activation is unsupported, behavioral evidence is environment-unavailable, and all 324 orchestration outcomes remain explicit degradation.'
}

export function renderCoreFourPrimitiveMatrixSection(proof?: OrchestrationRuntimeProofSummary): string {
  const lines = [
    CORE_FOUR_PRIMITIVE_SECTION_START,
    '<!-- Generated by `npm run generate:compatibility`. Do not edit this block by hand. -->',
    '',
    '| Bucket | Claude Code | Cursor | Codex | OpenCode |',
    '|---|---|---|---|---|',
  ]

  for (const bucket of PLUXX_COMPILER_BUCKETS) {
    lines.push(`| \`${bucket}\` | ${CORE_FOUR_PLATFORMS.map(platform => formatCapabilityCell(platform, bucket)).join(' | ')} |`)
  }

  lines.push(
    '',
    'Registry notes:',
    '',
  )

  for (const bucket of PLUXX_COMPILER_BUCKETS) {
    const bucketNotes = formatBucketNotes(bucket)
    if (bucketNotes.length === 0) continue

    lines.push(`#### \`${bucket}\``, '')
    lines.push(...bucketNotes, '')
  }

  lines.push('## Field-level translation truth', '')
  lines.push('Primitive labels above are derived from these audited field outcomes. A primitive is only `preserve` when every audited field preserves.', '')
  lines.push(...formatFieldTruthSection('skills'))
  lines.push(...formatFieldTruthSection('hooks'))
  lines.push(...formatOrchestrationFieldTruthSection(proof))

  lines.push(CORE_FOUR_PRIMITIVE_SECTION_END)

  return lines.join('\n')
}

export function replaceGeneratedCoreFourPrimitiveSection(
  source: string,
  proof?: OrchestrationRuntimeProofSummary,
): string {
  const start = source.indexOf(CORE_FOUR_PRIMITIVE_SECTION_START)
  const end = source.indexOf(CORE_FOUR_PRIMITIVE_SECTION_END)

  if (start !== -1 && end !== -1 && end > start) {
    const sectionEnd = end + CORE_FOUR_PRIMITIVE_SECTION_END.length
    return `${source.slice(0, start)}${renderCoreFourPrimitiveMatrixSection(proof)}${source.slice(sectionEnd)}`
  }

  const heading = '## Mapping Rules\n\n'
  const nextHeading = '\n## Practical Consequences'
  const headingStart = source.indexOf(heading)
  const nextHeadingStart = source.indexOf(nextHeading)

  if (headingStart === -1 || nextHeadingStart === -1 || nextHeadingStart < headingStart) {
    throw new Error('Missing generated core-four primitive section markers.')
  }

  const contentStart = headingStart + heading.length
  return `${source.slice(0, contentStart)}${renderCoreFourPrimitiveMatrixSection(proof)}${source.slice(nextHeadingStart)}`
}
