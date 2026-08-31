import { existsSync, lstatSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { inspectAgentPluginsDiscovery } from '../agent-plugins'

export const HOST_SUPPORT_RETRIEVED_AT = '2026-08-31' as const

export const HOST_SUPPORT_PROOF_TIERS = [
  'schema',
  'generated-fixture',
  'isolated-installed',
  'discovered',
  'behavioral',
] as const

export type HostSupportProofTier = (typeof HOST_SUPPORT_PROOF_TIERS)[number]
export type HostSupportLayer = 'portable-core' | 'native-overlay'
export type HostSupportMaintenanceTier = 'primary' | 'beta' | 'portable'
export type HostSupportOutcome =
  | 'portable'
  | 'native-preserved'
  | 'translated'
  | 'degraded'
  | 'unsupported'
  | 'not-yet-behaviorally-proven'

export const HOST_SUPPORT_DIMENSIONS = [
  'startup-context-delivery',
  'portable-skills',
  'declared-mcp',
  'native-commands',
  'specialist-agents',
  'structured-mcp-content',
  'background-processes',
  'local-file-script-permissions',
  'package-install-update-uninstall',
] as const

export type HostSupportDimension = (typeof HOST_SUPPORT_DIMENSIONS)[number]
export type HostSupportHost = 'agent-plugins' | 'claude-code' | 'cursor' | 'codex' | 'opencode'

export interface HostSupportSource {
  label: string
  url: string
}

export interface HostSupportClaim {
  host: HostSupportHost
  maintenanceTier: HostSupportMaintenanceTier
  dimension: HostSupportDimension
  layer: HostSupportLayer
  outcome: HostSupportOutcome
  minimumProof: HostSupportProofTier
  currentProof: HostSupportProofTier
  evidence: string
  limitation?: string
  sources: readonly HostSupportSource[]
  retrievedAt: typeof HOST_SUPPORT_RETRIEVED_AT
}

const SOURCE = {
  agentPlugins: {
    label: 'Agent Plugins 1.0.0 specification',
    url: 'https://agent-plugins.org/specification',
  },
  claudePlugins: { label: 'Claude Code plugins', url: 'https://code.claude.com/docs/en/plugins' },
  claudeHooks: { label: 'Claude Code hooks', url: 'https://code.claude.com/docs/en/hooks' },
  claudeAgents: { label: 'Claude Code subagents', url: 'https://code.claude.com/docs/en/sub-agents' },
  claudeMcp: { label: 'Claude Code MCP', url: 'https://code.claude.com/docs/en/mcp' },
  claudePermissions: { label: 'Claude Code permissions', url: 'https://code.claude.com/docs/en/permissions' },
  claudeMarketplaces: { label: 'Claude Code marketplaces', url: 'https://code.claude.com/docs/en/plugin-marketplaces' },
  cursorPlugins: { label: 'Cursor plugins', url: 'https://cursor.com/docs/plugins' },
  cursorHooks: { label: 'Cursor hooks', url: 'https://cursor.com/docs/hooks' },
  cursorAgents: { label: 'Cursor subagents', url: 'https://cursor.com/docs/subagents' },
  cursorMcp: { label: 'Cursor MCP', url: 'https://cursor.com/docs/mcp' },
  cursorPermissions: { label: 'Cursor CLI permissions', url: 'https://cursor.com/docs/cli/reference/permissions' },
  codexPlugins: { label: 'Codex plugins', url: 'https://developers.openai.com/codex/plugins' },
  codexHooks: { label: 'Codex hooks', url: 'https://developers.openai.com/codex/hooks' },
  codexSkills: { label: 'Codex skills', url: 'https://developers.openai.com/codex/skills' },
  codexAgents: { label: 'Codex subagents', url: 'https://developers.openai.com/codex/subagents' },
  codexMcp: { label: 'Codex MCP', url: 'https://developers.openai.com/codex/mcp' },
  codexSecurity: { label: 'Codex approvals and security', url: 'https://developers.openai.com/codex/agent-approvals-security' },
  openCodePlugins: { label: 'OpenCode plugins', url: 'https://opencode.ai/docs/plugins/' },
  openCodeSkills: { label: 'OpenCode skills', url: 'https://opencode.ai/docs/skills/' },
  openCodeCommands: { label: 'OpenCode commands', url: 'https://opencode.ai/docs/commands/' },
  openCodeAgents: { label: 'OpenCode agents', url: 'https://opencode.ai/docs/agents/' },
  openCodeMcp: { label: 'OpenCode MCP', url: 'https://opencode.ai/docs/mcp-servers/' },
  openCodePermissions: { label: 'OpenCode permissions', url: 'https://opencode.ai/docs/permissions/' },
} as const

const claim = (
  value: Omit<HostSupportClaim, 'retrievedAt'>,
): HostSupportClaim => ({ ...value, retrievedAt: HOST_SUPPORT_RETRIEVED_AT })

const portableEvidence = 'docs/orchid/receipts/2026-08-31-pluxx-0.1.42-release.json'
const nativeProof = 'docs/core-four-primitive-proof-ledger.md'
const runtimeGaps = 'docs/core-four-reliability-register.md'

export const HOST_SUPPORT_CLAIMS: readonly HostSupportClaim[] = [
  claim({ host: 'agent-plugins', maintenanceTier: 'portable', dimension: 'portable-skills', layer: 'portable-core', outcome: 'portable', minimumProof: 'generated-fixture', currentProof: 'isolated-installed', evidence: portableEvidence, sources: [SOURCE.agentPlugins] }),
  claim({ host: 'agent-plugins', maintenanceTier: 'portable', dimension: 'declared-mcp', layer: 'portable-core', outcome: 'portable', minimumProof: 'generated-fixture', currentProof: 'isolated-installed', evidence: portableEvidence, sources: [SOURCE.agentPlugins] }),
  ...(['startup-context-delivery', 'native-commands', 'specialist-agents', 'structured-mcp-content', 'background-processes', 'local-file-script-permissions', 'package-install-update-uninstall'] as const).map(dimension => claim({ host: 'agent-plugins', maintenanceTier: 'portable', dimension, layer: 'native-overlay', outcome: 'unsupported', minimumProof: 'behavioral', currentProof: 'schema', evidence: 'docs/agent-plugins-native-overlay-contract.md', limitation: 'Agent Plugins v1 does not define this native-host capability; it requires a separately proven native overlay.', sources: [SOURCE.agentPlugins] })),

  claim({ host: 'claude-code', maintenanceTier: 'primary', dimension: 'portable-skills', layer: 'portable-core', outcome: 'unsupported', minimumProof: 'discovered', currentProof: 'schema', evidence: 'docs/core-four-provider-docs-audit.md', limitation: 'Claude documents Agent Skills and Claude plugins, not a generic Agent Plugins package import contract.', sources: [SOURCE.claudePlugins, SOURCE.agentPlugins] }),
  claim({ host: 'claude-code', maintenanceTier: 'primary', dimension: 'declared-mcp', layer: 'portable-core', outcome: 'unsupported', minimumProof: 'discovered', currentProof: 'schema', evidence: 'docs/core-four-provider-docs-audit.md', limitation: 'Claude documents native MCP configuration but not generic Agent Plugins mcp.json package loading.', sources: [SOURCE.claudeMcp, SOURCE.agentPlugins] }),
  claim({ host: 'claude-code', maintenanceTier: 'primary', dimension: 'startup-context-delivery', layer: 'native-overlay', outcome: 'native-preserved', minimumProof: 'behavioral', currentProof: 'behavioral', evidence: nativeProof, sources: [SOURCE.claudeHooks] }),
  claim({ host: 'claude-code', maintenanceTier: 'primary', dimension: 'native-commands', layer: 'native-overlay', outcome: 'native-preserved', minimumProof: 'discovered', currentProof: 'discovered', evidence: nativeProof, sources: [SOURCE.claudePlugins] }),
  claim({ host: 'claude-code', maintenanceTier: 'primary', dimension: 'specialist-agents', layer: 'native-overlay', outcome: 'native-preserved', minimumProof: 'discovered', currentProof: 'behavioral', evidence: nativeProof, sources: [SOURCE.claudeAgents] }),
  claim({ host: 'claude-code', maintenanceTier: 'primary', dimension: 'structured-mcp-content', layer: 'native-overlay', outcome: 'not-yet-behaviorally-proven', minimumProof: 'behavioral', currentProof: 'isolated-installed', evidence: runtimeGaps, limitation: 'MCP wiring and tool execution are proven, but no maintained receipt isolates structured content-block fidelity.', sources: [SOURCE.claudeMcp] }),
  claim({ host: 'claude-code', maintenanceTier: 'primary', dimension: 'background-processes', layer: 'native-overlay', outcome: 'not-yet-behaviorally-proven', minimumProof: 'behavioral', currentProof: 'generated-fixture', evidence: runtimeGaps, limitation: 'Background agent fields are documented, but this exact generated behavior lacks a current maintained runtime receipt.', sources: [SOURCE.claudeAgents] }),
  claim({ host: 'claude-code', maintenanceTier: 'primary', dimension: 'local-file-script-permissions', layer: 'native-overlay', outcome: 'not-yet-behaviorally-proven', minimumProof: 'behavioral', currentProof: 'isolated-installed', evidence: runtimeGaps, limitation: 'Generated permission hooks execute in verifier fixtures; end-to-end host enforcement is not isolated as a current behavioral receipt.', sources: [SOURCE.claudePermissions, SOURCE.claudeHooks] }),
  claim({ host: 'claude-code', maintenanceTier: 'primary', dimension: 'package-install-update-uninstall', layer: 'native-overlay', outcome: 'native-preserved', minimumProof: 'isolated-installed', currentProof: 'isolated-installed', evidence: nativeProof, sources: [SOURCE.claudeMarketplaces, SOURCE.claudePlugins] }),

  claim({ host: 'cursor', maintenanceTier: 'primary', dimension: 'portable-skills', layer: 'portable-core', outcome: 'not-yet-behaviorally-proven', minimumProof: 'behavioral', currentProof: 'isolated-installed', evidence: portableEvidence, limitation: 'Cursor documents Agent Plugins loading, but this VPS has no real Cursor binary discovery receipt for the 0.1.42 artifact.', sources: [SOURCE.cursorPlugins, SOURCE.agentPlugins] }),
  claim({ host: 'cursor', maintenanceTier: 'primary', dimension: 'declared-mcp', layer: 'portable-core', outcome: 'not-yet-behaviorally-proven', minimumProof: 'behavioral', currentProof: 'isolated-installed', evidence: portableEvidence, limitation: 'The package contract and local path are proven in fixtures; real Cursor MCP discovery/execution remains unrecorded.', sources: [SOURCE.cursorPlugins, SOURCE.cursorMcp, SOURCE.agentPlugins] }),
  claim({ host: 'cursor', maintenanceTier: 'primary', dimension: 'startup-context-delivery', layer: 'native-overlay', outcome: 'not-yet-behaviorally-proven', minimumProof: 'behavioral', currentProof: 'isolated-installed', evidence: runtimeGaps, limitation: 'Installed hook shape is validated, but a current clean-session startup/context-delivery transcript is not recorded.', sources: [SOURCE.cursorHooks] }),
  claim({ host: 'cursor', maintenanceTier: 'primary', dimension: 'native-commands', layer: 'native-overlay', outcome: 'native-preserved', minimumProof: 'discovered', currentProof: 'behavioral', evidence: nativeProof, sources: [SOURCE.cursorPlugins] }),
  claim({ host: 'cursor', maintenanceTier: 'primary', dimension: 'specialist-agents', layer: 'native-overlay', outcome: 'translated', minimumProof: 'behavioral', currentProof: 'behavioral', evidence: nativeProof, sources: [SOURCE.cursorAgents] }),
  claim({ host: 'cursor', maintenanceTier: 'primary', dimension: 'structured-mcp-content', layer: 'native-overlay', outcome: 'not-yet-behaviorally-proven', minimumProof: 'behavioral', currentProof: 'isolated-installed', evidence: runtimeGaps, limitation: 'MCP configuration and workflow use are proven, but structured content-block fidelity lacks a maintained isolated receipt.', sources: [SOURCE.cursorMcp] }),
  claim({ host: 'cursor', maintenanceTier: 'primary', dimension: 'background-processes', layer: 'native-overlay', outcome: 'not-yet-behaviorally-proven', minimumProof: 'behavioral', currentProof: 'generated-fixture', evidence: runtimeGaps, limitation: 'Cursor documents background subagent metadata, but this exact generated behavior lacks a current maintained runtime receipt.', sources: [SOURCE.cursorAgents] }),
  claim({ host: 'cursor', maintenanceTier: 'primary', dimension: 'local-file-script-permissions', layer: 'native-overlay', outcome: 'not-yet-behaviorally-proven', minimumProof: 'behavioral', currentProof: 'isolated-installed', evidence: runtimeGaps, limitation: 'Generated permission-hook decisions are verifier-tested; current host-side enforcement behavior is not separately receipted.', sources: [SOURCE.cursorPermissions, SOURCE.cursorHooks] }),
  claim({ host: 'cursor', maintenanceTier: 'primary', dimension: 'package-install-update-uninstall', layer: 'native-overlay', outcome: 'native-preserved', minimumProof: 'isolated-installed', currentProof: 'discovered', evidence: nativeProof, sources: [SOURCE.cursorPlugins] }),

  claim({ host: 'codex', maintenanceTier: 'primary', dimension: 'portable-skills', layer: 'portable-core', outcome: 'unsupported', minimumProof: 'discovered', currentProof: 'schema', evidence: 'docs/core-four-provider-docs-audit.md', limitation: 'No first-party Codex documentation defines a generic root Agent Plugins import path; Codex stays on its native plugin/skills path.', sources: [SOURCE.codexPlugins, SOURCE.codexSkills, SOURCE.agentPlugins] }),
  claim({ host: 'codex', maintenanceTier: 'primary', dimension: 'declared-mcp', layer: 'portable-core', outcome: 'unsupported', minimumProof: 'discovered', currentProof: 'schema', evidence: 'docs/core-four-provider-docs-audit.md', limitation: 'Codex documents native MCP configuration but not importing Agent Plugins mcp.json as a generic package root.', sources: [SOURCE.codexMcp, SOURCE.agentPlugins] }),
  claim({ host: 'codex', maintenanceTier: 'primary', dimension: 'startup-context-delivery', layer: 'native-overlay', outcome: 'not-yet-behaviorally-proven', minimumProof: 'behavioral', currentProof: 'isolated-installed', evidence: runtimeGaps, limitation: 'Generated and installed hook shape is proven, but maintained headless and interactive probes still do not prove hook execution.', sources: [SOURCE.codexHooks, SOURCE.codexPlugins] }),
  claim({ host: 'codex', maintenanceTier: 'primary', dimension: 'native-commands', layer: 'native-overlay', outcome: 'degraded', minimumProof: 'discovered', currentProof: 'discovered', evidence: nativeProof, limitation: 'Codex has no documented plugin-packaged custom command directory equivalent; Pluxx routes through skills, AGENTS.md, and companion metadata.', sources: [SOURCE.codexPlugins, SOURCE.codexSkills] }),
  claim({ host: 'codex', maintenanceTier: 'primary', dimension: 'specialist-agents', layer: 'native-overlay', outcome: 'translated', minimumProof: 'behavioral', currentProof: 'behavioral', evidence: nativeProof, sources: [SOURCE.codexAgents] }),
  claim({ host: 'codex', maintenanceTier: 'primary', dimension: 'structured-mcp-content', layer: 'native-overlay', outcome: 'not-yet-behaviorally-proven', minimumProof: 'behavioral', currentProof: 'discovered', evidence: runtimeGaps, limitation: 'Approved MCP tool calls are proven, but structured content-block fidelity is not isolated in a maintained receipt.', sources: [SOURCE.codexMcp] }),
  claim({ host: 'codex', maintenanceTier: 'primary', dimension: 'background-processes', layer: 'native-overlay', outcome: 'not-yet-behaviorally-proven', minimumProof: 'behavioral', currentProof: 'generated-fixture', evidence: runtimeGaps, limitation: 'Subagents are proven, but a separately controlled background-process support contract is not documented or maintained here.', sources: [SOURCE.codexAgents] }),
  claim({ host: 'codex', maintenanceTier: 'primary', dimension: 'local-file-script-permissions', layer: 'native-overlay', outcome: 'translated', minimumProof: 'behavioral', currentProof: 'behavioral', evidence: runtimeGaps, limitation: 'Approvals and sandbox controls are native, but current custom-agent read-only sandbox probes show a runtime mismatch that remains explicitly bounded.', sources: [SOURCE.codexSecurity, SOURCE.codexAgents] }),
  claim({ host: 'codex', maintenanceTier: 'primary', dimension: 'package-install-update-uninstall', layer: 'native-overlay', outcome: 'native-preserved', minimumProof: 'isolated-installed', currentProof: 'behavioral', evidence: nativeProof, sources: [SOURCE.codexPlugins] }),

  claim({ host: 'opencode', maintenanceTier: 'primary', dimension: 'portable-skills', layer: 'portable-core', outcome: 'unsupported', minimumProof: 'discovered', currentProof: 'schema', evidence: 'docs/core-four-provider-docs-audit.md', limitation: 'OpenCode documents compatible skill directories but not a generic Agent Plugins package import contract.', sources: [SOURCE.openCodeSkills, SOURCE.agentPlugins] }),
  claim({ host: 'opencode', maintenanceTier: 'primary', dimension: 'declared-mcp', layer: 'portable-core', outcome: 'unsupported', minimumProof: 'discovered', currentProof: 'schema', evidence: 'docs/core-four-provider-docs-audit.md', limitation: 'OpenCode documents config-native MCP, not generic Agent Plugins mcp.json package loading.', sources: [SOURCE.openCodeMcp, SOURCE.agentPlugins] }),
  claim({ host: 'opencode', maintenanceTier: 'primary', dimension: 'startup-context-delivery', layer: 'native-overlay', outcome: 'translated', minimumProof: 'behavioral', currentProof: 'behavioral', evidence: nativeProof, sources: [SOURCE.openCodePlugins] }),
  claim({ host: 'opencode', maintenanceTier: 'primary', dimension: 'native-commands', layer: 'native-overlay', outcome: 'native-preserved', minimumProof: 'discovered', currentProof: 'behavioral', evidence: nativeProof, sources: [SOURCE.openCodeCommands] }),
  claim({ host: 'opencode', maintenanceTier: 'primary', dimension: 'specialist-agents', layer: 'native-overlay', outcome: 'translated', minimumProof: 'behavioral', currentProof: 'behavioral', evidence: nativeProof, sources: [SOURCE.openCodeAgents] }),
  claim({ host: 'opencode', maintenanceTier: 'primary', dimension: 'structured-mcp-content', layer: 'native-overlay', outcome: 'not-yet-behaviorally-proven', minimumProof: 'behavioral', currentProof: 'isolated-installed', evidence: runtimeGaps, limitation: 'Config-native MCP behavior is proven broadly, but structured content-block fidelity lacks a maintained isolated receipt.', sources: [SOURCE.openCodeMcp] }),
  claim({ host: 'opencode', maintenanceTier: 'primary', dimension: 'background-processes', layer: 'native-overlay', outcome: 'not-yet-behaviorally-proven', minimumProof: 'behavioral', currentProof: 'generated-fixture', evidence: runtimeGaps, limitation: 'Plugin event handlers are documented, but Pluxx has no separately maintained background-process lifecycle receipt.', sources: [SOURCE.openCodePlugins, SOURCE.openCodeAgents] }),
  claim({ host: 'opencode', maintenanceTier: 'primary', dimension: 'local-file-script-permissions', layer: 'native-overlay', outcome: 'not-yet-behaviorally-proven', minimumProof: 'behavioral', currentProof: 'isolated-installed', evidence: runtimeGaps, limitation: 'Permission maps are generated and install-validated; current host enforcement is not isolated as a maintained behavioral receipt.', sources: [SOURCE.openCodePermissions] }),
  claim({ host: 'opencode', maintenanceTier: 'primary', dimension: 'package-install-update-uninstall', layer: 'native-overlay', outcome: 'translated', minimumProof: 'isolated-installed', currentProof: 'behavioral', evidence: nativeProof, sources: [SOURCE.openCodePlugins] }),
]

const FIRST_PARTY_HOSTS: Record<HostSupportHost, readonly string[]> = {
  'agent-plugins': ['agent-plugins.org'],
  'claude-code': ['code.claude.com', 'agent-plugins.org'],
  cursor: ['cursor.com', 'agent-plugins.org'],
  codex: ['developers.openai.com', 'agent-plugins.org'],
  opencode: ['opencode.ai', 'agent-plugins.org'],
}

interface HostSupportEvidenceArtifact {
  kind: 'release-receipt' | 'proof-ledger' | 'reliability-register' | 'provider-audit' | 'overlay-policy'
  hosts: readonly HostSupportHost[]
  dimensions: readonly HostSupportDimension[]
}

const CORE_HOSTS = ['claude-code', 'cursor', 'codex', 'opencode'] as const
const PORTABLE_DIMENSIONS = ['portable-skills', 'declared-mcp'] as const
const NATIVE_DIMENSIONS = HOST_SUPPORT_DIMENSIONS.filter(dimension => !PORTABLE_DIMENSIONS.includes(dimension as typeof PORTABLE_DIMENSIONS[number]))

const HOST_SUPPORT_EVIDENCE_ARTIFACTS: Readonly<Record<string, HostSupportEvidenceArtifact>> = {
  [portableEvidence]: { kind: 'release-receipt', hosts: ['agent-plugins', 'cursor'], dimensions: PORTABLE_DIMENSIONS },
  [nativeProof]: { kind: 'proof-ledger', hosts: CORE_HOSTS, dimensions: NATIVE_DIMENSIONS },
  [runtimeGaps]: { kind: 'reliability-register', hosts: CORE_HOSTS, dimensions: NATIVE_DIMENSIONS },
  'docs/core-four-provider-docs-audit.md': { kind: 'provider-audit', hosts: CORE_HOSTS, dimensions: PORTABLE_DIMENSIONS },
  'docs/agent-plugins-native-overlay-contract.md': { kind: 'overlay-policy', hosts: ['agent-plugins'], dimensions: NATIVE_DIMENSIONS },
}

const proofRank = (tier: HostSupportProofTier): number => HOST_SUPPORT_PROOF_TIERS.indexOf(tier)

export function validateHostSupportClaims(claims: readonly HostSupportClaim[] = HOST_SUPPORT_CLAIMS): string[] {
  const errors: string[] = []
  const seen = new Set<string>()

  for (const item of claims) {
    const key = `${item.host}:${item.dimension}`
    if (seen.has(key)) errors.push(`${key}: duplicate claim`)
    seen.add(key)

    if (item.retrievedAt !== HOST_SUPPORT_RETRIEVED_AT) errors.push(`${key}: stale retrieval date`)
    if (!item.evidence.trim()) errors.push(`${key}: missing evidence or limitation reference`)
    if (item.sources.length === 0) errors.push(`${key}: missing first-party source`)

    const artifact = HOST_SUPPORT_EVIDENCE_ARTIFACTS[item.evidence]
    const evidencePath = resolve(process.cwd(), item.evidence)
    if (!artifact) {
      errors.push(`${key}: unrecognized evidence artifact ${item.evidence}`)
    } else {
      if (!artifact.hosts.includes(item.host)) errors.push(`${key}: evidence artifact ${item.evidence} does not cover host`)
      if (!artifact.dimensions.includes(item.dimension)) errors.push(`${key}: evidence artifact ${item.evidence} does not cover capability`)
      if (!existsSync(evidencePath) || !lstatSync(evidencePath).isFile() || lstatSync(evidencePath).isSymbolicLink()) {
        errors.push(`${key}: evidence artifact is missing or not a regular file: ${item.evidence}`)
      } else if (artifact.kind === 'release-receipt') {
        try {
          const receipt = JSON.parse(readFileSync(evidencePath, 'utf8')) as { schema?: unknown; states?: Array<{ name?: unknown; evidence?: unknown }> }
          const receiptEvidence = receipt.states?.map(state => state.evidence).filter((value): value is string => typeof value === 'string').join('\n') ?? ''
          if (receipt.schema !== 'orchid.release.receipt/v1' || !/compatible-client fixture/i.test(receiptEvidence) || !/strict agent-plugins target/i.test(receiptEvidence)) {
            errors.push(`${key}: release receipt lacks compatible-client fixture proof`)
          }
        } catch {
          errors.push(`${key}: release receipt is not valid JSON`)
        }
      }
    }

    for (const source of item.sources) {
      let hostname = ''
      try { hostname = new URL(source.url).hostname }
      catch { errors.push(`${key}: invalid source URL ${source.url}`); continue }
      if (!FIRST_PARTY_HOSTS[item.host].includes(hostname)) errors.push(`${key}: non-first-party source ${source.url}`)
    }

    if (item.layer === 'portable-core' && !['portable-skills', 'declared-mcp'].includes(item.dimension)) {
      errors.push(`${key}: portable core may only claim skills or declared MCP`)
    }

    if (['portable', 'native-preserved', 'translated'].includes(item.outcome) && proofRank(item.currentProof) < proofRank(item.minimumProof)) {
      errors.push(`${key}: ${item.outcome} requires ${item.minimumProof}, only ${item.currentProof} is recorded`)
    }

    if (['degraded', 'unsupported', 'not-yet-behaviorally-proven'].includes(item.outcome) && !item.limitation?.trim()) {
      errors.push(`${key}: ${item.outcome} requires an explicit limitation`)
    }

    if (item.currentProof === 'behavioral' && !/(proof|reliability|receipt|transcript|runtime)/i.test(item.evidence)) {
      errors.push(`${key}: behavioral evidence must reference a maintained proof, receipt, transcript, or runtime artifact`)
    }
  }

  for (const host of Object.keys(FIRST_PARTY_HOSTS) as HostSupportHost[]) {
    for (const dimension of HOST_SUPPORT_DIMENSIONS) {
      if (!seen.has(`${host}:${dimension}`)) errors.push(`${host}:${dimension}: missing claim`)
    }
  }

  return errors
}

export interface HostSupportFixtureResult {
  proofTier: 'isolated-installed'
  client: 'cursor'
  pluginName: string
  skills: string[]
  mcpDeclared: boolean
  artifactSha256: string
}

export function inspectIsolatedHostSupportFixture(root: string): HostSupportFixtureResult {
  const receipt = inspectAgentPluginsDiscovery(root, 'cursor', 'fixture-contract-only')
  const manifest = JSON.parse(readFileSync(resolve(root, 'plugin.json'), 'utf8')) as { name: string }
  return {
    proofTier: 'isolated-installed',
    client: 'cursor',
    pluginName: manifest.name,
    skills: receipt.skills,
    mcpDeclared: receipt.mcpServers.length > 0,
    artifactSha256: receipt.artifactSha256,
  }
}

const HOST_LABEL: Record<HostSupportHost, string> = {
  'agent-plugins': 'Agent Plugins v1',
  'claude-code': 'Claude Code',
  cursor: 'Cursor',
  codex: 'Codex',
  opencode: 'OpenCode',
}

function formatEvidenceReference(reference: string): string {
  if (!reference.startsWith('docs/')) return reference
  const relative = reference.slice('docs/'.length)
  return `[${reference}](./${relative})`
}

export function renderHostSupportGateMarkdown(): string {
  const errors = validateHostSupportClaims()
  if (errors.length > 0) throw new Error(`Invalid host support registry:\n${errors.join('\n')}`)

  const lines = [
    '<!-- Generated by `npm run generate:host-support-gate`. Do not edit by hand. -->',
    '# New-host support gate',
    '',
    '## Doc Links',
    '',
    '- Role: reusable host-support acceptance policy and evidence matrix',
    '- Related:',
    '  - [Core-Four Provider Docs Audit](./core-four-provider-docs-audit.md)',
    '  - [Core-Four Primitive Matrix](./core-four-primitive-matrix.md)',
    '  - [Compatibility Matrix](./compatibility.md)',
    '  - [Core-Four Primitive Proof Ledger](./core-four-primitive-proof-ledger.md)',
    '  - [Agent Plugins Native Enhancement Overlay Contract](./agent-plugins-native-overlay-contract.md)',
    '- Update together:',
    '  - [Core-Four Provider Docs Audit](./core-four-provider-docs-audit.md)',
    '  - [Compatibility Matrix](./compatibility.md)',
    '  - [Start Here](./start-here.md)',
    '  - [Pluxx Queue](./todo/queue.md)',
    '  - [Master Backlog](./todo/master-backlog.md)',
    '  - [Roadmap](./roadmap.md)',
    '',
    `First-party documentation retrieved: ${HOST_SUPPORT_RETRIEVED_AT}.`,
    '',
    'This is the reusable release gate for host support claims. Generated files are not runtime proof.',
    '',
    '## Evidence ladder',
    '',
    '1. `schema`: the package/config shape is documented and validates.',
    '2. `generated-fixture`: deterministic generation and package validation pass.',
    '3. `isolated-installed`: an isolated or fake home accepts the package without touching an active home.',
    '4. `discovered`: a real host or documented compatible-client harness lists the installed component.',
    '5. `behavioral`: a clean-session transcript or structured runtime log proves the claimed behavior.',
    '',
    'A higher tier includes the lower tiers. Presence on disk never satisfies `discovered` or `behavioral`.',
    '',
    '## Required checklist',
    '',
    '- Identify the claim as portable core or native overlay.',
    '- Link current first-party documentation and record its retrieval date.',
    '- Validate deterministic generation and closed package inventory.',
    '- Install only in an isolated/fake home unless active-home mutation is separately authorized.',
    '- Require host listing/discovery output before claiming discovery.',
    '- Require a clean-session transcript or structured runtime log before claiming behavior.',
    '- Prove startup/context delivery separately when the host exposes it.',
    '- Prove commands, agents, MCP, background behavior, and permissions only where declared.',
    '- Document unsupported, degraded, and not-yet-behaviorally-proven outcomes before release.',
    '- Keep portable Agent Plugins skills/MCP separate from host-native hooks, agents, commands, and policy.',
    '',
    '## Capability and evidence matrix',
    '',
    '| Host | Tier | Layer | Capability | Outcome | Required proof | Current proof | Evidence / limitation |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ]

  for (const item of HOST_SUPPORT_CLAIMS) {
    const evidence = formatEvidenceReference(item.evidence)
    const detail = item.limitation ? `${evidence} — ${item.limitation}` : evidence
    lines.push(`| ${HOST_LABEL[item.host]} | ${item.maintenanceTier} | ${item.layer} | ${item.dimension} | ${item.outcome} | ${item.minimumProof} | ${item.currentProof} | ${detail} |`)
  }

  lines.push('', '## First-party source inventory', '')
  const sources = new Map<string, HostSupportSource>()
  for (const item of HOST_SUPPORT_CLAIMS) for (const source of item.sources) sources.set(source.url, source)
  for (const source of [...sources.values()].sort((a, b) => a.label.localeCompare(b.label))) lines.push(`- [${source.label}](${source.url})`)

  lines.push(
    '',
    '## Current bounded decision',
    '',
    '- Cursor first-party docs explicitly support Agent Plugins and document local loading, but Pluxx still lacks a real Cursor binary receipt for the current portable artifact.',
    '- Codex has no documented generic Agent Plugins root import path. Codex remains on the proven native Pluxx path.',
    '- Claude Code and OpenCode expose strong native plugin/skill/MCP surfaces, but no generic Agent Plugins package import is claimed.',
    '- Agent Plugins v1 remains a strict skills-and-declared-MCP floor. Native hooks, commands, agents, permissions, scripts, and background behavior require separate host evidence.',
    '',
    '## Promotion rule',
    '',
    'A beta host may become primary only when every claimed row passes this validator and the release lane records the required proof. A missing primitive remains `unsupported`, `degraded`, or `not-yet-behaviorally-proven`; it is never converted to support by prose.',
  )
  return `${lines.join('\n')}\n`
}
