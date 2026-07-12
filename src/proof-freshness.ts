import { z } from 'zod'

export const PROOF_TIERS = [
  'unit',
  'bundle-contract',
  'fake-home-install',
  'installed-runtime',
  'real-host-behavior',
] as const

export const ProofTierSchema = z.enum(PROOF_TIERS)
export const ProofFreshnessSchema = z.enum(['current', 'historical'])
export const ProofOutcomeSchema = z.enum(['passed', 'failed', 'not-run'])

export const ProofCommandSchema = z.object({
  command: z.string().min(1),
  outcome: ProofOutcomeSchema,
})

export const ProofTargetSchema = z.object({
  target: z.string().min(1),
  hostVersion: z.string().min(1).nullable(),
  installedPath: z.string().min(1).nullable(),
  sha256: z.string().min(1).nullable(),
  outcome: ProofOutcomeSchema,
  unavailableReason: z.string().min(1).nullable().optional(),
})

export const ProofReceiptSchema = z.object({
  id: z.string().min(1),
  tier: ProofTierSchema,
  freshness: ProofFreshnessSchema,
  commitSha: z.string().min(1),
  packageVersion: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }),
  commands: z.array(ProofCommandSchema).min(1),
  targets: z.array(ProofTargetSchema).min(1),
})

export const ProofClaimSchema = z.object({
  id: z.string().min(1),
  summary: z.string().min(1),
  tier: ProofTierSchema,
  freshness: ProofFreshnessSchema,
  evidencePath: z.string().min(1),
  receiptId: z.string().min(1),
})

export const ProofManifestSchema = z.object({
  schemaVersion: z.literal(1),
  canonicalVersion: z.string().min(1),
  expectedTag: z.string().min(1),
  releaseState: z.enum(['released', 'release-prep']),
  policy: z.object({
    environmentReceiptMaxAgeDays: z.number().int().positive(),
  }),
  claims: z.array(ProofClaimSchema),
  receipts: z.array(ProofReceiptSchema),
})

export const ProofReceiptSpecSchema = ProofReceiptSchema.extend({
  commitSha: z.string().min(1).optional(),
  packageVersion: z.string().min(1).optional(),
  timestamp: z.string().datetime({ offset: true }).optional(),
})

export type ProofTier = z.infer<typeof ProofTierSchema>
export type ProofFreshness = z.infer<typeof ProofFreshnessSchema>
export type ProofOutcome = z.infer<typeof ProofOutcomeSchema>
export type ProofCommand = z.infer<typeof ProofCommandSchema>
export type ProofTarget = z.infer<typeof ProofTargetSchema>
export type ProofReceipt = z.infer<typeof ProofReceiptSchema>
export type ProofClaim = z.infer<typeof ProofClaimSchema>
export type ProofManifest = z.infer<typeof ProofManifestSchema>
export type ProofReceiptSpec = z.infer<typeof ProofReceiptSpecSchema>

export interface ProofValidationContext {
  packageVersion: string
  expectedTagExists: boolean
  now: Date
  isCommitReachable: (sha: string) => boolean
}

export function materializeProofReceipt(
  spec: ProofReceiptSpec,
  defaults: { commitSha: string; packageVersion: string; timestamp: string },
): ProofReceipt {
  return {
    ...spec,
    commitSha: spec.commitSha ?? defaults.commitSha,
    packageVersion: spec.packageVersion ?? defaults.packageVersion,
    timestamp: spec.timestamp ?? defaults.timestamp,
  }
}

export function upsertProofReceipt(manifest: ProofManifest, receipt: ProofReceipt): ProofManifest {
  const index = manifest.receipts.findIndex((candidate) => candidate.id === receipt.id)
  const receipts = [...manifest.receipts]
  if (index === -1) receipts.push(receipt)
  else receipts[index] = receipt
  return { ...manifest, receipts }
}

const ENVIRONMENT_TIERS = new Set<ProofTier>(['installed-runtime', 'real-host-behavior'])

function ageInDays(timestamp: string, now: Date): number | null {
  const observedAt = new Date(timestamp)
  if (Number.isNaN(observedAt.getTime())) return null
  return (now.getTime() - observedAt.getTime()) / 86_400_000
}

export function validateProofManifest(
  manifest: ProofManifest,
  context: ProofValidationContext,
): string[] {
  const problems: string[] = []
  const expectedTag = `v${context.packageVersion}`

  if (manifest.schemaVersion !== 1) problems.push(`Unsupported proof manifest schema ${String(manifest.schemaVersion)}.`)
  if (manifest.canonicalVersion !== context.packageVersion) {
    problems.push(`Manifest canonicalVersion is ${manifest.canonicalVersion}; expected ${context.packageVersion}.`)
  }
  if (manifest.expectedTag !== expectedTag) {
    problems.push(`Manifest expectedTag is ${manifest.expectedTag}; expected ${expectedTag}.`)
  }
  if (context.expectedTagExists && manifest.releaseState !== 'released') {
    problems.push(`Manifest releaseState is ${manifest.releaseState} but tag ${expectedTag} exists; use released.`)
  }
  if (!context.expectedTagExists && manifest.releaseState !== 'release-prep') {
    problems.push(`Manifest releaseState is ${manifest.releaseState} but tag ${expectedTag} does not exist; use release-prep.`)
  }

  const receipts = new Map<string, ProofReceipt>()
  for (const receipt of manifest.receipts) {
    if (receipts.has(receipt.id)) problems.push(`Duplicate receipt id ${receipt.id}.`)
    receipts.set(receipt.id, receipt)

    if (!PROOF_TIERS.includes(receipt.tier)) problems.push(`Receipt ${receipt.id} has unknown tier ${receipt.tier}.`)
    if (receipt.commands.length === 0) problems.push(`Receipt ${receipt.id} must name at least one command.`)
    if (receipt.targets.length === 0) problems.push(`Receipt ${receipt.id} must name at least one target.`)
    const receiptAge = ageInDays(receipt.timestamp, context.now)
    if (receiptAge === null) problems.push(`Receipt ${receipt.id} has an invalid timestamp.`)
    else if (receiptAge < -(5 / 1_440)) problems.push(`Receipt ${receipt.id} timestamp is in the future.`)

    for (const target of receipt.targets) {
      const missingEnvironmentEvidence = !target.hostVersion || !target.installedPath || !target.sha256
      if (ENVIRONMENT_TIERS.has(receipt.tier) && receipt.freshness === 'current' && missingEnvironmentEvidence) {
        problems.push(`Current receipt ${receipt.id} target ${target.target} must capture hostVersion, installedPath, and sha256.`)
      } else if (ENVIRONMENT_TIERS.has(receipt.tier) && missingEnvironmentEvidence && !target.unavailableReason) {
        problems.push(`Receipt ${receipt.id} target ${target.target} must capture hostVersion, installedPath, and sha256 or explain why they are unavailable.`)
      }
    }

    if (receipt.freshness !== 'current') continue
    if (receipt.packageVersion !== context.packageVersion) {
      problems.push(`Current receipt ${receipt.id} uses package ${receipt.packageVersion}; expected ${context.packageVersion}.`)
    }
    if (!context.isCommitReachable(receipt.commitSha)) {
      problems.push(`Current receipt ${receipt.id} commit ${receipt.commitSha} is not reachable from the current branch.`)
    }
    if (receipt.commands.some((command) => command.outcome !== 'passed')) {
      problems.push(`Current receipt ${receipt.id} has a non-passing command outcome.`)
    }
    if (receipt.targets.some((target) => target.outcome !== 'passed')) {
      problems.push(`Current receipt ${receipt.id} has a non-passing target outcome.`)
    }
    const age = ageInDays(receipt.timestamp, context.now)
    if (ENVIRONMENT_TIERS.has(receipt.tier) && age !== null && age > manifest.policy.environmentReceiptMaxAgeDays) {
      problems.push(`Current receipt ${receipt.id} is older than the ${manifest.policy.environmentReceiptMaxAgeDays}-day environment-proof window.`)
    }
  }

  const claimIds = new Set<string>()
  for (const claim of manifest.claims) {
    if (claimIds.has(claim.id)) problems.push(`Duplicate claim id ${claim.id}.`)
    claimIds.add(claim.id)
    const receipt = receipts.get(claim.receiptId)
    if (!receipt) {
      problems.push(`Claim ${claim.id} references missing receipt ${claim.receiptId}.`)
      continue
    }
    if (claim.tier !== receipt.tier) problems.push(`Claim ${claim.id} tier ${claim.tier} does not match receipt ${receipt.id} tier ${receipt.tier}.`)
    if (claim.freshness !== receipt.freshness) {
      problems.push(`Claim ${claim.id} freshness ${claim.freshness} does not match receipt ${receipt.id} freshness ${receipt.freshness}.`)
    }
  }

  return problems
}

const VERSION_CLAIM = /(?:prepar(?:e|ing)|current|latest|released|release(?:d)?\s+package).*?v?0\.\d+\.\d+|v?0\.\d+\.\d+.*?(?:prepar(?:e|ing)|current|latest|released|release(?:d)?\s+package)/i

export function findCanonicalDocProblems(
  documents: Record<string, string>,
  packageVersion: string,
): string[] {
  const problems: string[] = []

  for (const [path, content] of Object.entries(documents)) {
    content.split(/\r?\n/).forEach((line, index) => {
      if (/\bhistorical\b/i.test(line)) return
      const versions = line.match(/\bv?0\.\d+\.\d+\b/g) ?? []
      if (versions.length === 0 || !VERSION_CLAIM.test(line)) return
      const stale = versions.find((version) => version.replace(/^v/, '') !== packageVersion)
      if (stale) problems.push(`${path}:${index + 1} makes an obsolete canonical version claim (${stale}); expected ${packageVersion} or an explicit historical label.`)
    })
  }

  return problems
}
