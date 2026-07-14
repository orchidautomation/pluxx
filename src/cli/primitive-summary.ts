import { getConfiguredCompilerBuckets, type PluginConfig, type PluxxCompilerBucket, type TargetPlatform } from '../schema'
import {
  CORE_FOUR_PLATFORMS,
  getCoreFourCompilerBucketCapability,
  type CoreFourPlatform,
  type PrimitiveCapabilityStatus,
  type PrimitiveTranslationMode,
} from '../validation/platform-rules'

const TARGET_LABELS: Record<CoreFourPlatform, string> = {
  'claude-code': 'claude',
  cursor: 'cursor',
  codex: 'codex',
  opencode: 'open',
}
const MODE_LABELS: Record<PrimitiveTranslationMode, string> = {
  preserve: 'keep',
  translate: 'xlat',
  degrade: 'weak',
  drop: 'drop',
}
const STATUS_LABELS: Record<PrimitiveCapabilityStatus, string> = { ...MODE_LABELS, unmapped: 'none' }

export interface PrimitiveSummaryRow {
  bucket: PluxxCompilerBucket
  modes: Partial<Record<CoreFourPlatform, PrimitiveCapabilityStatus>>
}

export interface PrimitiveTranslationSummary {
  targets: CoreFourPlatform[]
  rows: PrimitiveSummaryRow[]
  allPreserve: boolean
}

export function buildPrimitiveTranslationSummary(
  config: PluginConfig,
  targets: TargetPlatform[] = config.targets,
): PrimitiveTranslationSummary | undefined {
  const selectedTargets = CORE_FOUR_PLATFORMS.filter((target) => targets.includes(target))
  if (selectedTargets.length === 0) return undefined

  const configuredBuckets = getConfiguredCompilerBuckets({
    ...config,
    targets,
  })

  const rows: PrimitiveSummaryRow[] = []
  for (const bucket of configuredBuckets) {
    const modes: Partial<Record<CoreFourPlatform, PrimitiveCapabilityStatus>> = {}
    let hasInterestingDelta = false

    for (const target of selectedTargets) {
      const lookup = getCoreFourCompilerBucketCapability(target, bucket)
      const mode = lookup.status === 'mapped' ? lookup.capability.mode : 'unmapped'
      modes[target] = mode
      if (mode !== 'preserve') {
        hasInterestingDelta = true
      }
    }

    if (hasInterestingDelta) {
      rows.push({ bucket, modes })
    }
  }

  return {
    targets: selectedTargets,
    rows,
    allPreserve: rows.length === 0,
  }
}

export function renderPrimitiveTranslationSummary(
  summary: PrimitiveTranslationSummary | undefined,
): string[] {
  if (!summary) return []

  if (summary.allPreserve) {
    return ['Core-four mapping: all active buckets preserve on selected targets.']
  }

  const bucketWidth = Math.max(
    'bucket'.length,
    ...summary.rows.map((row) => row.bucket.length),
  )
  const targetHeaders = summary.targets.map((target) => TARGET_LABELS[target].padEnd(6, ' '))

  const lines = [
    'Core-four mapping:',
    `  ${'bucket'.padEnd(bucketWidth, ' ')}  ${targetHeaders.join('  ')}`,
  ]

  for (const row of summary.rows) {
    const cells = summary.targets.map((target) => STATUS_LABELS[row.modes[target] ?? 'unmapped'].padEnd(6, ' '))
    lines.push(`  ${row.bucket.padEnd(bucketWidth, ' ')}  ${cells.join('  ')}`)
  }

  lines.push('  legend: keep=preserve xlat=translate weak=degrade drop=drop none=unmapped')

  const detailLines: string[] = []
  for (const row of summary.rows) {
    for (const target of summary.targets) {
      const mode = row.modes[target]
      if (!mode || mode === 'preserve') continue

      const lookup = getCoreFourCompilerBucketCapability(target, row.bucket)
      if (lookup.status === 'unmapped') {
        detailLines.push(`  - ${row.bucket} on ${TARGET_LABELS[target]}: Phase 2 host mapping not declared.`)
        continue
      }
      const capability = lookup.capability
      const verb = mode === 'translate'
        ? 're-expressed via'
        : mode === 'degrade'
          ? 'weakened to'
          : 'omitted; nearest surface would be'
      const suffix = capability.notes ? ` ${capability.notes}` : ''
      detailLines.push(`  - ${row.bucket} on ${TARGET_LABELS[target]}: ${verb} ${capability.nativeSurfaces.join(', ')}.${suffix}`)
    }
  }

  if (detailLines.length > 0) {
    lines.push('  details:')
    lines.push(...detailLines)
  }
  return lines
}
