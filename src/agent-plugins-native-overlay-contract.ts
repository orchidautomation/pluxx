/**
 * Native enhancement overlay contract for Agent Plugins packages.
 *
 * Agent Plugins v1 defines exactly two portable component types — skills and MCP
 * servers — and permits reverse-domain client-extension directories under
 * `<namespace-owner>/...`. Those extension directories are client-owned, not
 * portable, and their contents are not guaranteed shared across hosts.
 *
 * This module is the evidence gate PLUXX-347 establishes before any reverse-
 * domain client-extension may be emitted by the agent-plugins portable emitter
 * (PLUXX-346) or surfaced as a portable contract.
 *
 * Policy: fail-closed.
 *
 * - Every emitted extension must have a client-owned namespace owner.
 * - Every emitted extension path or field must be cited in a first-party
 *   schema that the namespace owner publishes.
 * - Every emitted extension contract must have installed-client evidence.
 *   Portable core rows may instead carry an explicitly labelled contract
 *   fixture that proves package shape without claiming real-client execution.
 * - The allowlist may be empty; an empty allowlist keeps the portable core
 *   package valid and useful when every extension is degraded or omitted.
 *
 * Any violation produces a deterministic `OverlayContractDiagnostic` so callers
 * (lint, the portable emitter, and downstream tests) can surface the failure
 * instead of silently emitting the file.
 */

/**
 * Stable disposition values for a (client, capability) pair.
 */
export type OverlayDisposition =
  | 'portable'
  | 'native'
  | 'extension-proven'
  | 'degraded'
  | 'unsupported'

/**
 * First-party client owner. Matches the convention Agent Plugins uses for
 * reverse-domain extension directories: `<owner>/...`.
 */
export type OverlayNamespaceOwner =
  | 'cursor'
  | 'openai'
  | 'anthropic'
  | 'opencode'
  | 'agent-plugins'

/**
 * Capability surface covered by the matrix. Kept stable; new surfaces must be
 * added with a first-party schema citation.
 */
export type OverlayCapability =
  | 'skills'
  | 'hooks'
  | 'agents'
  | 'commands'
  | 'metadata'
  | 'permissions'
  | 'install'

/**
 * One allowlisted client-extension contract entry. Every field is required
 * unless documented as optional; missing required fields cause validation to
 * fail.
 */
export interface OverlayContractEntry {
  /**
   * Stable id. Used for deterministic diagnostics and to keep the allowlist
   * referentially stable over edits.
   */
  id: string

  /** Client owner of the extension namespace, e.g. `cursor` for `com.cursor`. */
  namespaceOwner: OverlayNamespaceOwner

  /**
   * Reverse-domain directory basename as documented by the namespace owner,
   * e.g. `hooks` under `com.cursor/hooks.json` or `skills/<x>/SKILL.md` under
   * the Agent Plugins portable floor.
   */
  directory: string

  /** Capability the contract covers. */
  capability: OverlayCapability

  /** Final disposition for `directory` against `namespaceOwner`. */
  disposition: OverlayDisposition

  /**
   * First-party schema or contract citation URL. Must point at documentation
   * the namespace owner publishes; mirrors of the docs do not qualify.
   */
  firstPartyCitation: string

  /**
   * ISO date the citation page was retrieved. The matrix and the policy
   * diagnostic include this so a later refresh can detect stale evidence.
   */
  retrievedAt: string

  /**
   * Documented paths or field names that the owner publishes under
   * `directory`. Empty array means "the directory name itself is the entire
   * contract"; non-empty arrays are checked against any candidate emission
   * paths or fields the emitter would write.
   */
  documentedPaths: string[]

  /**
   * Identity and proof tier of the evidence fixture. `extension-proven` rows
   * require an `installed` fixture. Portable spec rows may use a `contract`
   * fixture, which validates package semantics but is not installed-client proof.
   */
  evidenceFixture?: {
    tier: 'contract' | 'installed'
    /** Stable fixture id, e.g. `pluxx:fixture:agent-plugins-skills-contract-2026-08`. */
    id: string
    /** One-line description captured during authoring. */
    description: string
  }

  /**
   * Explicit negative decision. When `true`, the entry records that Pluxx
   * must not emit this namespace/schema even though the namespace exists.
   */
  negativeDecision?: boolean

  /**
   * Free-form rationale. Required when `negativeDecision` is true; optional
   * otherwise.
   */
  rationale?: string
}

/**
 * Stripped-down candidate emission spec the policy validates. Lives here so
 * PLUXX-346's portable emitter (and lint) can hand a candidate over without
 * pulling the full entry shape into their build pipelines.
 */
export interface OverlayEmissionCandidate {
  namespaceOwner: OverlayNamespaceOwner
  directory: string
  paths: string[]
}

/**
 * Stable diagnostic produced by `validateOverlayContract`. Callers
 * (lint, portability tests) format these into degradation reports.
 */
export interface OverlayContractDiagnostic {
  /** Stable error code. Callers can map these to lint severity. */
  code:
    | 'overlay.namespace.unknown'
    | 'overlay.entry.missing-citation'
    | 'overlay.entry.stale-citation'
    | 'overlay.entry.missing-fixture'
    | 'overlay.entry.undocumented-path'
    | 'overlay.entry.undocumented-field'
    | 'overlay.disposition.negative-decision'
    | 'overlay.negative-decision-missing-rationale'
  /** Severity. Anything that gates emission is `error`. */
  level: 'error' | 'warning'
  /** Entry id the diagnostic is about when known. */
  entryId?: string
  /** Human-readable summary. Callers render this verbatim. */
  message: string
  /**
   * Suggested action. Callers can render this verbatim next to the message so
   * the degradation report tells authors what to do instead of just what
   * failed.
   */
  suggestion: string
}

const KNOWN_NAMESPACE_OWNERS = new Set<OverlayNamespaceOwner>([
  'cursor',
  'openai',
  'anthropic',
  'opencode',
  'agent-plugins',
])

const SEMVER_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * Reads `input` and returns a frozen allowlist. Pure function with no I/O so
 * callers can serialize the result or stub it in tests.
 */
export function getOverlayContractAllowlist(
  input: OverlayContractEntry[] = [],
): readonly OverlayContractEntry[] {
  return Object.freeze([...input])
}

/**
 * Returns `true` if the allowlist contains an entry whose `negativeDecision`
 * is set. Used by lint and the portable emitter to refuse emission even when
 * an emitter accidentally registers the entry as legitimate.
 */
export function hasNegativeDecisions(
  allowlist: readonly OverlayContractEntry[],
): boolean {
  return allowlist.some((entry) => entry.negativeDecision === true)
}

/**
 * Returns the negative-decision entries, if any. Used to render the
 * authoritative matrix and to drive explicit lint errors.
 */
export function getNegativeDecisions(
  allowlist: readonly OverlayContractEntry[],
): readonly OverlayContractEntry[] {
  return allowlist.filter((entry) => entry.negativeDecision === true)
}

/**
 * Validate a candidate emission against the allowlist. Returns an empty array
 * if the candidate is allowed; otherwise returns one or more diagnostics that
 * describe exactly why the candidate is not allowed.
 *
 * The policy is fail-closed: an unknown namespace, a missing citation, a
 * missing fixture, an undocumented path, or an undocumented field will all
 * produce an error diagnostic.
 */
export function validateOverlayContract(
  candidate: OverlayEmissionCandidate,
  allowlist: readonly OverlayContractEntry[],
): OverlayContractDiagnostic[] {
  const diagnostics: OverlayContractDiagnostic[] = []

  if (!KNOWN_NAMESPACE_OWNERS.has(candidate.namespaceOwner)) {
    diagnostics.push({
      code: 'overlay.namespace.unknown',
      level: 'error',
      message: `Unknown extension namespace owner "${candidate.namespaceOwner}".`,
      suggestion:
        'Add the owner to OverlayNamespaceOwner only after a first-party namespace citation and an installed fixture are available.',
    })
    return diagnostics
  }

  const matchingEntries = allowlist.filter(
    (entry) =>
      entry.namespaceOwner === candidate.namespaceOwner &&
      entry.directory === candidate.directory,
  )

  if (matchingEntries.length === 0) {
    diagnostics.push({
      code: 'overlay.namespace.unknown',
      level: 'error',
      message: `No allowlisted extension contract for ${candidate.namespaceOwner}/${candidate.directory}.`,
      suggestion:
        'PLUXX-347 forbids assumed reverse-domain extension emission. Record a first-party schema citation and installed fixture, or omit the emission and surface the capability through the native bundle.',
    })
    return diagnostics
  }

  for (const entry of matchingEntries) {
    if (entry.negativeDecision === true) {
      diagnostics.push({
        code: 'overlay.disposition.negative-decision',
        level: 'error',
        entryId: entry.id,
        message: `Extension ${candidate.namespaceOwner}/${candidate.directory} is recorded as a negative decision (${entry.id}).`,
        suggestion:
          entry.rationale ??
          'Continue to emit the capability through the native bundle; do not add an Agent Plugins reverse-domain extension for this owner.',
      })
      if (!entry.rationale || entry.rationale.trim().length === 0) {
        diagnostics.push({
          code: 'overlay.negative-decision-missing-rationale',
          level: 'error',
          entryId: entry.id,
          message: `Negative-decision entry ${entry.id} must include a rationale.`,
          suggestion:
            'Cite the first-party page that contradicts portability and record the decision date.',
        })
      }
      continue
    }

    if (!entry.firstPartyCitation || entry.firstPartyCitation.trim().length === 0) {
      diagnostics.push({
        code: 'overlay.entry.missing-citation',
        level: 'error',
        entryId: entry.id,
        message: `Extension entry ${entry.id} is missing a first-party citation.`,
        suggestion:
          'Add the namespace owner’s published schema URL and the retrieval date.',
      })
    } else if (
      !entry.retrievedAt ||
      !SEMVER_REGEX.test(entry.retrievedAt) ||
      Date.parse(entry.retrievedAt) > Date.now() + 24 * 60 * 60 * 1000
    ) {
      diagnostics.push({
        code: 'overlay.entry.stale-citation',
        level: 'error',
        entryId: entry.id,
        message: `Extension entry ${entry.id} has a missing or future-dated retrieval timestamp (${entry.retrievedAt ?? 'unset'}).`,
        suggestion: 'Re-fetch the citation and record today’s ISO date.',
      })
    }

    const missingRequiredFixture =
      (entry.disposition === 'portable' && !entry.evidenceFixture) ||
      (entry.disposition === 'extension-proven' && entry.evidenceFixture?.tier !== 'installed')
    if (missingRequiredFixture) {
      diagnostics.push({
        code: 'overlay.entry.missing-fixture',
        level: 'error',
        entryId: entry.id,
        message: entry.disposition === 'extension-proven'
          ? `Extension entry ${entry.id} claims extension-proven but has no installed-client evidence fixture.`
          : `Portable entry ${entry.id} has no package-contract evidence fixture.`,
        suggestion:
          entry.disposition === 'extension-proven'
            ? 'Add an installed-client evidence fixture id and a one-line description proving the behavior ran against the documented client.'
            : 'Add a contract fixture, or an installed-client fixture when real execution evidence exists.',
      })
    }

    const documentedPaths = new Set(entry.documentedPaths)
    for (const path of candidate.paths) {
      const isDocumented =
        documentedPaths.has(path) ||
        Array.from(documentedPaths).some((allowed) => pathMatchesTemplate(path, allowed))
      if (!isDocumented) {
        diagnostics.push({
          code: entry.documentedPaths.length === 0
            ? 'overlay.entry.undocumented-path'
            : 'overlay.entry.undocumented-field',
          level: 'error',
          entryId: entry.id,
          message:
            entry.documentedPaths.length === 0
              ? `Extension entry ${entry.id} documents no paths and cannot accept ${path}.`
              : `Path "${path}" is not documented under ${candidate.namespaceOwner}/${candidate.directory} by the namespace owner.`,
          suggestion:
            'Remove the path, or extend the entry’s documentedPaths with the first-party citation that introduces the path.',
        })
      }
    }
  }

  return diagnostics
}

/**
 * Walk an emitted output tree and report any reverse-domain client-extension
 * directory that is not allowlisted. This is the lint rule / design guard the
 * plan requires "preventing undocumented extension emission".
 *
 * `emittedPaths` is expected to be an array of paths relative to the package
 * root. Each path is split on `/` and the first segment is interpreted as the
 * Client Namespace directory.
 */
export function lintUndocumentedExtensionEmission(
  emittedPaths: readonly string[],
  allowlist: readonly OverlayContractEntry[],
): OverlayContractDiagnostic[] {
  const diagnostics: OverlayContractDiagnostic[] = []
  const seenCandidates = new Set<string>()

  for (const emitted of emittedPaths) {
    const trimmed = emitted.replace(/^\.\//, '').replace(/^\/+/, '')
    if (trimmed.length === 0) continue
    const firstSegment = trimmed.split('/', 1)[0]
    if (!looksLikeClientNamespaceDirectory(firstSegment)) continue

    const rest = trimmed.slice(firstSegment.length + 1)
    const directory = rest.length === 0 ? '' : rest.split('/', 1)[0]
    const candidate: OverlayEmissionCandidate = {
      namespaceOwner: firstSegment.replace(/^com\./, '') as OverlayNamespaceOwner,
      directory,
      paths: rest.length === 0 ? [] : collectEmittedSubpaths(rest),
    }

    const key = `${candidate.namespaceOwner}|${candidate.directory}|${candidate.paths.join('|')}`
    if (seenCandidates.has(key)) continue
    seenCandidates.add(key)

    const entryDiagnostics = validateOverlayContract(candidate, allowlist)
    for (const diagnostic of entryDiagnostics) {
      diagnostics.push({
        ...diagnostic,
        message: `${diagnostic.message} Saw emission "${emitted}".`,
        suggestion: diagnostic.suggestion,
      })
    }
  }

  return diagnostics
}

/**
 * Returns the aliased owner name for a path's first segment if the segment
 * matches the reverse-domain Agent Plugins convention.
 *
 * Examples:
 *
 * - `com.cursor/hooks/hooks.json` → `cursor`
 * - `com.openai/hooks/hooks.json` → `openai`
 * - `skills/foo/SKILL.md` → no namespace owner, returns null
 */
export function detectEmissionNamespaceOwner(
  emittedPath: string,
): OverlayNamespaceOwner | null {
  const trimmed = emittedPath.replace(/^\.\//, '').replace(/^\/+/, '')
  if (trimmed.length === 0) return null
  const firstSegment = trimmed.split('/', 1)[0]
  if (!looksLikeClientNamespaceDirectory(firstSegment)) return null
  return firstSegment.replace(/^com\./, '') as OverlayNamespaceOwner
}

function looksLikeClientNamespaceDirectory(segment: string): boolean {
  if (!segment.startsWith('com.')) return false
  const owner = segment.slice('com.'.length)
  if (owner.length === 0) return false
  return KNOWN_NAMESPACE_OWNERS.has(owner as OverlayNamespaceOwner)
}

function pathMatchesTemplate(path: string, template: string): boolean {
  const pathSegments = path.split('/').filter((s) => s.length > 0)
  const templateSegments = template.split('/').filter((s) => s.length > 0)
  if (pathSegments.length !== templateSegments.length) {
    return pathSegments.length > templateSegments.length && pathMatchesTemplate(pathSegments.slice(0, templateSegments.length).join('/'), template)
  }
  for (let index = 0; index < templateSegments.length; index++) {
    const t = templateSegments[index]
    if (/^<.+>$/.test(t)) continue
    if (t !== pathSegments[index]) return false
  }
  return true
}

function collectEmittedSubpaths(rest: string): string[] {
  const parts = rest.split('/').filter((part) => part.length > 0)
  const result: string[] = []
  for (let index = parts.length; index > 0; index--) {
    result.push(parts.slice(0, index).join('/'))
  }
  return result
}

/**
 * Stable path, relative to the repository root, for the authoritative matrix
 * document. The lint "doc in sync" tests reference this so a renamed file is
 * surfaced as a CI error rather than a stale doc.
 */
export const AGENT_PLUGINS_NATIVE_OVERLAY_CONTRACT_DOCUMENT_PATH =
  'docs/agent-plugins-native-overlay-contract.md'

/** Owner label used by the matrix renderer. */
const OWNER_LABELS: Record<OverlayNamespaceOwner, string> = {
  cursor: 'Cursor',
  openai: 'OpenAI / Codex',
  anthropic: 'Anthropic / Claude Code',
  opencode: 'OpenCode',
  'agent-plugins': 'Agent Plugins (portable spec)',
}

/** Capability label used by the matrix renderer. */
const CAPABILITY_LABELS: Record<OverlayCapability, string> = {
  skills: 'Skills',
  hooks: 'Hooks',
  agents: 'Agents / subagents',
  commands: 'Commands',
  metadata: 'Metadata',
  permissions: 'Permissions',
  install: 'Install mechanics',
}

/**
 * Curated lookup of the contract matrix the policy consults. The contents are
 * captured here so the matrix-renderer test, the lint doc-sync test, and the
 * portable emitter can share one source of truth.
 *
 * The matrix records what is known, what is proved, and what is a deliberate
 * negative decision. A row whose disposition is `extension-proven` or
 * `portable` is also a potential allowlist entry, but only after it carries the
 * evidence tier required for that disposition.
 */
export const AGENT_PLUGINS_NATIVE_OVERLAY_CONTRACT_MATRIX: OverlayContractEntry[] = [
  {
    id: 'agent-plugins.skills',
    namespaceOwner: 'agent-plugins',
    directory: 'skills',
    capability: 'skills',
    disposition: 'portable',
    firstPartyCitation:
      'https://github.com/vercel-labs/open-plugin-spec/blob/main/spec/1.0.0.md',
    retrievedAt: '2026-08-30',
    documentedPaths: ['skills/<name>/SKILL.md'],
    evidenceFixture: {
      tier: 'contract',
      id: 'pluxx:fixture:agent-plugins-skills-contract-2026-08',
      description:
        'A deterministic package-contract fixture validates every immediate-child skill entry. It is not installed Cursor or Codex proof.',
    },
  },
  {
    id: 'agent-plugins.mcp',
    namespaceOwner: 'agent-plugins',
    directory: 'mcp.json',
    capability: 'install',
    disposition: 'portable',
    firstPartyCitation:
      'https://github.com/vercel-labs/open-plugin-spec/blob/main/spec/1.0.0.md',
    retrievedAt: '2026-08-30',
    documentedPaths: ['mcp.json'],
    evidenceFixture: {
      tier: 'contract',
      id: 'pluxx:fixture:agent-plugins-mcp-contract-2026-08',
      description:
        'A deterministic package-contract fixture validates portable `mcp.json`. It is not installed Cursor or Codex proof.',
    },
  },
  {
    id: 'cursor.hooks.negative',
    namespaceOwner: 'cursor',
    directory: 'hooks',
    capability: 'hooks',
    disposition: 'unsupported',
    negativeDecision: true,
    firstPartyCitation:
      'https://cursor.com/docs/reference/plugins',
    retrievedAt: '2026-08-30',
    documentedPaths: [],
    rationale:
      'Cursor ships a native Cursor Plugins surface (hooks/hooks.json) and a portable Agent Plugins surface for skills + MCP. Pluxx does not assert a `com.cursor/hooks` Agent Plugins extension; hooks remain a native Cursor bundle capability. Re-evaluate only if Cursor publishes a reverse-domain Agent Plugins hooks schema and an installed fixture proves it.',
  },
  {
    id: 'openai.hooks.negative',
    namespaceOwner: 'openai',
    directory: 'hooks',
    capability: 'hooks',
    disposition: 'unsupported',
    negativeDecision: true,
    firstPartyCitation:
      'https://learn.chatgpt.com/docs/hooks',
    retrievedAt: '2026-08-30',
    documentedPaths: [],
    rationale:
      'Codex loads native plugin hooks from `hooks/hooks.json`; that is not evidence for a `com.openai/hooks` Agent Plugins reverse-domain extension. Pluxx must not emit a `com.openai/hooks` directory; hooks stay in the native Codex bundle until OpenAI publishes an Agent Plugins extension contract and an installed fixture proves it.',
  },
  {
    id: 'cursor.agents.negative',
    namespaceOwner: 'cursor',
    directory: 'agents',
    capability: 'agents',
    disposition: 'unsupported',
    negativeDecision: true,
    firstPartyCitation:
      'https://cursor.com/docs/reference/plugins',
    retrievedAt: '2026-08-30',
    documentedPaths: [],
    rationale:
      'Cursor ships native plugin agents under its Cursor Plugins surface. There is no documented Agent Plugins `com.cursor/agents` extension at retrieval time; native output is the only path until Cursor publishes a reverse-domain extension contract.',
  },
  {
    id: 'anthropic.skills.portable',
    namespaceOwner: 'anthropic',
    directory: 'skills',
    capability: 'skills',
    disposition: 'native',
    firstPartyCitation:
      'https://docs.anthropic.com/en/docs/claude-code/plugins',
    retrievedAt: '2026-08-30',
    documentedPaths: ['skills/<name>/SKILL.md'],
    rationale:
      'Claude Code reads skills through its native plugin bundle, not through a reverse-domain Agent Plugins extension. Native output is the documented and proven path.',
  },
  {
    id: 'opencode.skills.portable',
    namespaceOwner: 'opencode',
    directory: 'skills',
    capability: 'skills',
    disposition: 'native',
    firstPartyCitation:
      'https://opencode.ai/docs/plugins/',
    retrievedAt: '2026-08-30',
    documentedPaths: ['skills/<name>/SKILL.md'],
    rationale:
      'OpenCode reads skills through its native plugin surface and config; no Agent Plugins reverse-domain extension is published at retrieval time.',
  },
]

/**
 * Returns the canonical overlay contract matrix. Pure function so callers
 * (renderer, capability-matrix work item, portable emitter) share one source.
 */
export function getAgentPluginsNativeOverlayContractMatrix(): readonly OverlayContractEntry[] {
  return Object.freeze([...AGENT_PLUGINS_NATIVE_OVERLAY_CONTRACT_MATRIX])
}

/**
 * Returns the allowlist the policy enforces. Today every entry with
 * `extension-proven` or `portable` disposition is allowlisted; entries with
 * `negativeDecision: true` are also tracked so the policy can surface an
 * explicit error on attempted emission rather than silently failing.
 *
 * The allowlist is intentionally editable: an empty allowlist is a valid
 * policy state and produces zero diagnostics for any otherwise-disallowed
 * emission.
 */
export function getAgentPluginsNativeOverlayContractAllowlist(): readonly OverlayContractEntry[] {
  return Object.freeze([...AGENT_PLUGINS_NATIVE_OVERLAY_CONTRACT_MATRIX])
}

/**
 * Renders the authoritative matrix as markdown. The committed doc and any
 * downstream surface (capability-matrix work item, site docs) must be
 * byte-identical to this rendering so reviewers can spot drift.
 */
export function renderAgentPluginsNativeOverlayContractMarkdown(): string {
  const entries = AGENT_PLUGINS_NATIVE_OVERLAY_CONTRACT_MATRIX
  const header = [
    '# Agent Plugins Native Enhancement Overlay Contract',
    '',
    'Last updated: 2026-08-30',
    '',
    '## Purpose',
    '',
    'Agent Plugins v1 defines exactly two portable component types — skills and MCP servers —',
    'and permits reverse-domain client-extension directories under `<namespace-owner>/...`.',
    'Those directories are client-owned, not portable, and their contents are not guaranteed to',
    'be shared across hosts. This document is the authoritative table Pluxx consults before',
    'emitting any client extension; every row carries either a first-party citation with an',
    'explicitly tiered evidence-fixture identity or an explicit negative decision with a rationale.',
    '',
    '## Dispositions',
    '',
    'Five stable values describe each (client, capability) pair:',
    '',
    '- `portable` — the Agent Plugins v1 specification publishes the contract; a package-contract fixture exists, while installed proof is tracked separately.',
    '- `native` — the host bundles the capability through its own native path; no portable extension is published.',
    '- `extension-proven` — the namespace owner publishes a reverse-domain extension; installed proof exists.',
    '- `degraded` — limited support with a deliberate degradation path; documented separately.',
    '- `unsupported` — no first-party contract at retrieval time; Pluxx must omit or record a negative decision.',
    '',
    '## Matrix',
    '',
    '| Client | Namespace owner | Capability | Directory / schema | Disposition | First-party source | Retrieved | Evidence fixture | Decision |',
    '|---|---|---|---|---|---|---|---|---|',
  ]

  const docLinks = [
    '## Doc Links',
    '',
    '- Role: authoritative client-extension contract and machine-enforced policy for the Agent Plugins portable floor',
    '- Related:',
    '  - [docs/core-four-primitive-matrix.md](./core-four-primitive-matrix.md)',
    '  - [docs/core-four-provider-docs-audit.md](./core-four-provider-docs-audit.md)',
    '  - [docs/compatibility.md](./compatibility.md)',
    '  - [src/agent-plugins-native-overlay-contract.ts](../src/agent-plugins-native-overlay-contract.ts)',
    '  - [tests/agent-plugins-native-overlay-contract.test.ts](../tests/agent-plugins-native-overlay-contract.test.ts)',
    '  - [docs/orchid/plans/2026-08-30-pluxx-347-agent-plugins-native-overlay-contract.md](./orchid/plans/2026-08-30-pluxx-347-agent-plugins-native-overlay-contract.md)',
    '- Update together:',
    '  - [docs/core-four-primitive-matrix.md](./core-four-primitive-matrix.md) (only when a row’s native or portable disposition changes)',
    '  - [src/agent-plugins-native-overlay-contract.ts](../src/agent-plugins-native-overlay-contract.ts) (matrix and allowlist are the same source)',
    '  - [tests/agent-plugins-native-overlay-contract.test.ts](../tests/agent-plugins-native-overlay-contract.test.ts) (policy and doc-sync tests)',
    '  - Linear issue `PLUXX-347`',
    '',
  ]

  // Doc Links block goes between the H1 title and the rest of the body
  const title = header[0]
  const body = header.slice(1)
  header.length = 0
  header.push(title, '', ...docLinks, ...body)

  const rows = entries.map((entry) => {
    const ownerLabel = OWNER_LABELS[entry.namespaceOwner]
    const capabilityLabel = CAPABILITY_LABELS[entry.capability]
    const directoryCell = entry.directory.length === 0
      ? '(package root)'
      : `\`${entry.namespaceOwner}/${entry.directory}\``
    const pathSnippet = entry.documentedPaths.length === 0
      ? '—'
      : entry.documentedPaths.map((p) => `\`${p}\``).join(', ')
    const fixtureCell = entry.evidenceFixture
      ? `\`${entry.evidenceFixture.tier}: ${entry.evidenceFixture.id}\``
      : '— (negative decision or native-only)'
    const decision = entry.negativeDecision
      ? `Negative: ${entry.rationale ?? '(missing rationale, fail closed)'}`
      : entry.rationale
        ? entry.rationale
        : entry.disposition === 'portable' || entry.disposition === 'extension-proven'
          ? `Allowlisted via ${entry.id}.`
          : 'Native output path.'
    return `| ${ownerLabel} | \`${entry.namespaceOwner}\` | ${capabilityLabel} | ${directoryCell} (${pathSnippet}) | \`${entry.disposition}\` | ${entry.firstPartyCitation} | ${entry.retrievedAt} | ${fixtureCell} | ${decision} |`
  })

  return `${header.join('\n')}\n${rows.join('\n')}\n`
}

/**
 * Convenience alias of `validateOverlayContract` so PLUXX-346 and any lint
 * surface reads in domain language.
 */
export function validateAgentPluginsNativeOverlayContract(
  candidate: OverlayEmissionCandidate,
  allowlist: readonly OverlayContractEntry[] = getAgentPluginsNativeOverlayContractAllowlist(),
): OverlayContractDiagnostic[] {
  return validateOverlayContract(candidate, allowlist)
}

/**
 * Convenience alias of `lintUndocumentedExtensionEmission` so PLUXX-346 and
 * any lint surface reads in domain language.
 */
export function lintUndocumentedAgentPluginsExtensionEmission(
  emittedPaths: readonly string[],
  allowlist: readonly OverlayContractEntry[] = getAgentPluginsNativeOverlayContractAllowlist(),
): OverlayContractDiagnostic[] {
  return lintUndocumentedExtensionEmission(emittedPaths, allowlist)
}

/**
 * Convenience alias of `detectEmissionNamespaceOwner` so PLUXX-346 and any
 * lint surface reads in domain language.
 */
export function detectAgentPluginsEmissionNamespaceOwner(
  emittedPath: string,
): OverlayNamespaceOwner | null {
  return detectEmissionNamespaceOwner(emittedPath)
}
