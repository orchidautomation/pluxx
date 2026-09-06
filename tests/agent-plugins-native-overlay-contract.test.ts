import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  AGENT_PLUGINS_NATIVE_OVERLAY_CONTRACT_DOCUMENT_PATH,
  detectAgentPluginsEmissionNamespaceOwner,
  getAgentPluginsNativeOverlayContractAllowlist,
  getAgentPluginsNativeOverlayContractMatrix,
  getNegativeDecisions,
  hasNegativeDecisions,
  lintUndocumentedAgentPluginsExtensionEmission,
  renderAgentPluginsNativeOverlayContractMarkdown,
  validateAgentPluginsNativeOverlayContract,
  type OverlayContractEntry,
} from '../src/agent-plugins-native-overlay-contract'

const ROOT = resolve(import.meta.dir, '..')

function fullyEvidencedFixtureEntry(
  overrides: Partial<OverlayContractEntry> = {},
): OverlayContractEntry {
  return {
    id: 'synthetic.fixture',
    namespaceOwner: 'cursor',
    directory: 'skills',
    capability: 'skills',
    disposition: 'extension-proven',
    firstPartyCitation: 'https://example.com/cursor/skills',
    retrievedAt: '2026-08-30',
    documentedPaths: ['skills/<name>/SKILL.md'],
    evidenceFixture: {
      tier: 'installed',
      id: 'pluxx:fixture:synthetic-cursor-skills-2026-08',
      description: 'Synthetic Cursor skills fixture proven by an installed client probe.',
    },
    rationale: 'Synthetic fixture used only by policy tests.',
    ...overrides,
  }
}

describe('agent-plugins native overlay contract policy', () => {
  it('treats an empty allowlist as valid and rejects any candidate namespace', () => {
    const diagnostics = validateAgentPluginsNativeOverlayContract(
      { namespaceOwner: 'cursor', directory: 'hooks', paths: ['hooks/hooks.json'] },
      [],
    )
    expect(diagnostics.length).toBeGreaterThan(0)
    expect(diagnostics[0].code).toBe('overlay.namespace.unknown')
  })

  it('rejects an unknown namespace owner without consulting the allowlist', () => {
    const diagnostics = validateAgentPluginsNativeOverlayContract(
      { namespaceOwner: 'pluxx-private', directory: 'skills', paths: [] },
      [fullyEvidencedFixtureEntry({ namespaceOwner: 'pluxx-private' })],
    )
    expect(diagnostics.length).toBe(1)
    expect(diagnostics[0].code).toBe('overlay.namespace.unknown')
  })

  it('rejects an allowlisted entry that lacks a first-party citation', () => {
    const entry = fullyEvidencedFixtureEntry({ firstPartyCitation: '' })
    const diagnostics = validateAgentPluginsNativeOverlayContract(
      { namespaceOwner: 'cursor', directory: 'skills', paths: ['skills/x/SKILL.md'] },
      [entry],
    )
    expect(diagnostics.find((d) => d.code === 'overlay.entry.missing-citation')).toBeTruthy()
  })

  it('rejects an extension-proven entry without an installed evidence fixture', () => {
    const entry = fullyEvidencedFixtureEntry({ evidenceFixture: undefined })
    const diagnostics = validateAgentPluginsNativeOverlayContract(
      { namespaceOwner: 'cursor', directory: 'skills', paths: ['skills/x/SKILL.md'] },
      [entry],
    )
    expect(diagnostics.find((d) => d.code === 'overlay.entry.missing-fixture')).toBeTruthy()
  })

  it('accepts a portable contract fixture without treating it as installed proof', () => {
    const entry = fullyEvidencedFixtureEntry({
      namespaceOwner: 'agent-plugins',
      disposition: 'portable',
      evidenceFixture: {
        tier: 'contract',
        id: 'pluxx:fixture:portable-contract',
        description: 'Package-contract fixture only.',
      },
    })
    expect(validateAgentPluginsNativeOverlayContract(
      { namespaceOwner: 'agent-plugins', directory: 'skills', paths: ['skills/x/SKILL.md'] },
      [entry],
    )).toEqual([])
  })

  it('rejects contract-only evidence for an extension-proven claim', () => {
    const entry = fullyEvidencedFixtureEntry({
      evidenceFixture: {
        tier: 'contract',
        id: 'pluxx:fixture:not-installed',
        description: 'Does not prove installed behavior.',
      },
    })
    expect(validateAgentPluginsNativeOverlayContract(
      { namespaceOwner: 'cursor', directory: 'skills', paths: ['skills/x/SKILL.md'] },
      [entry],
    ).some((diagnostic) => diagnostic.code === 'overlay.entry.missing-fixture')).toBe(true)
  })

  it('rejects an undocumented path even when the entry is fully evidenced', () => {
    const diagnostics = validateAgentPluginsNativeOverlayContract(
      {
        namespaceOwner: 'cursor',
        directory: 'skills',
        paths: ['skills/x/SKILL.md', 'skills/x/secret.txt'],
        },
      [fullyEvidencedFixtureEntry()],
    )
    expect(diagnostics.find((d) => d.code === 'overlay.entry.undocumented-field')).toBeTruthy()
  })

  it('rejects an entry whose retrieval date is missing or future-dated', () => {
    const diagnostics = validateAgentPluginsNativeOverlayContract(
      { namespaceOwner: 'cursor', directory: 'skills', paths: ['skills/x/SKILL.md'] },
      [fullyEvidencedFixtureEntry({ retrievedAt: '2099-01-01' })],
    )
    expect(diagnostics.find((d) => d.code === 'overlay.entry.stale-citation')).toBeTruthy()
  })

  it('accepts a fully evidenced synthetic fixture without granting any real client an extension claim', () => {
    const entry = fullyEvidencedFixtureEntry()
    const diagnostics = validateAgentPluginsNativeOverlayContract(
      { namespaceOwner: 'cursor', directory: 'skills', paths: ['skills/x/SKILL.md'] },
      [entry],
    )
    expect(diagnostics).toEqual([])
  })

  it('treats every negative-decision matrix row as policy-refusing even when allowlisted', () => {
    const allowlist = getAgentPluginsNativeOverlayContractAllowlist()
    expect(hasNegativeDecisions(allowlist)).toBe(true)
    const negatives = getNegativeDecisions(allowlist)
    expect(negatives.length).toBeGreaterThan(0)

    for (const negative of negatives) {
      const diagnostics = validateAgentPluginsNativeOverlayContract(
        { namespaceOwner: negative.namespaceOwner, directory: negative.directory, paths: ['anything'] },
        allowlist,
      )
      expect(
        diagnostics.some((d) => d.code === 'overlay.disposition.negative-decision'),
      ).toBe(true)
    }
  })

  it('rejects a `com.cursor/hooks` emission with the explicit negative decision', () => {
    const diagnostics = validateAgentPluginsNativeOverlayContract(
      {
        namespaceOwner: 'cursor',
        directory: 'hooks',
        paths: ['hooks/hooks.json'],
      },
      getAgentPluginsNativeOverlayContractAllowlist(),
    )
    expect(diagnostics.find((d) => d.code === 'overlay.disposition.negative-decision')).toBeTruthy()
    expect(diagnostics.find((d) => d.message.includes('com.cursor/hooks') || d.message.includes('cursor/hooks'))).toBeTruthy()
  })

  it('rejects a `com.openai/hooks` emission with the explicit negative decision', () => {
    const diagnostics = validateAgentPluginsNativeOverlayContract(
      {
        namespaceOwner: 'openai',
        directory: 'hooks',
        paths: ['hooks/hooks.json'],
      },
      getAgentPluginsNativeOverlayContractAllowlist(),
    )
    expect(diagnostics.find((d) => d.code === 'overlay.disposition.negative-decision')).toBeTruthy()
  })

  it('rejects a negative-decision entry that loses its rationale', () => {
    const entry = fullyEvidencedFixtureEntry({
      id: 'synthetic.negative',
      namespaceOwner: 'cursor',
      directory: 'hooks',
      disposition: 'unsupported',
      negativeDecision: true,
      rationale: undefined,
      documentedPaths: [],
      evidenceFixture: undefined,
    })
    const diagnostics = validateAgentPluginsNativeOverlayContract(
      { namespaceOwner: 'cursor', directory: 'hooks', paths: ['hooks/hooks.json'] },
      [entry],
    )
    expect(
      diagnostics.find((d) => d.code === 'overlay.negative-decision-missing-rationale'),
    ).toBeTruthy()
  })

  it('rejects an empty allowlist candidate while allowing a portable skill emission', () => {
    const allowlist = getAgentPluginsNativeOverlayContractAllowlist()
    const portableSkillEntry = allowlist.find(
      (e) => e.id === 'agent-plugins.skills',
    )
    expect(portableSkillEntry).toBeTruthy()
    const diagnostics = validateAgentPluginsNativeOverlayContract(
      {
        namespaceOwner: 'agent-plugins',
        directory: 'skills',
        paths: ['skills/example/SKILL.md'],
      },
      allowlist,
    )
    expect(diagnostics).toEqual([])
  })
})

describe('agent-plugins native overlay contract lint guard', () => {
  it('flags an undocumented `com.cursor/hooks.json` emission path', () => {
    const diagnostics = lintUndocumentedAgentPluginsExtensionEmission(
      ['com.cursor/hooks/hooks.json'],
      getAgentPluginsNativeOverlayContractAllowlist(),
    )
    expect(diagnostics.length).toBeGreaterThan(0)
    expect(
      diagnostics.find((d) => d.code === 'overlay.disposition.negative-decision'),
    ).toBeTruthy()
  })

  it('flags an undocumented `com.openai/hooks.json` emission path', () => {
    const diagnostics = lintUndocumentedAgentPluginsExtensionEmission(
      ['com.openai/hooks/hooks.json'],
      getAgentPluginsNativeOverlayContractAllowlist(),
    )
    expect(
      diagnostics.find((d) => d.code === 'overlay.disposition.negative-decision'),
    ).toBeTruthy()
  })

  it('does not flag portable skill and MCP emissions emitted directly under the Agent Plugins root', () => {
    const diagnostics = lintUndocumentedAgentPluginsExtensionEmission(
      ['skills/example/SKILL.md', 'mcp.json'],
      getAgentPluginsNativeOverlayContractAllowlist(),
    )
    expect(diagnostics).toEqual([])
  })

  it('detects the namespace owner for any com.<client> emission path', () => {
    expect(detectAgentPluginsEmissionNamespaceOwner('com.cursor/hooks/hooks.json')).toBe(
      'cursor',
    )
    expect(detectAgentPluginsEmissionNamespaceOwner('com.openai/hooks/hooks.json')).toBe(
      'openai',
    )
    expect(detectAgentPluginsEmissionNamespaceOwner('skills/x/SKILL.md')).toBeNull()
    expect(detectAgentPluginsEmissionNamespaceOwner('mcp.json')).toBeNull()
  })
})

describe('agent-plugins native overlay contract matrix', () => {
  it('keeps the curated matrix in sync with the allowlist', () => {
    const matrix = getAgentPluginsNativeOverlayContractMatrix()
    const allowlist = getAgentPluginsNativeOverlayContractAllowlist()
    expect(allowlist.length).toBe(matrix.length)
    for (const entry of matrix) {
      expect(allowlist.find((e) => e.id === entry.id)?.id).toBe(entry.id)
    }
  })

  it('uses the published specification and classifies portable MCP separately from install mechanics', () => {
    const matrix = getAgentPluginsNativeOverlayContractMatrix()
    const skills = matrix.find((entry) => entry.id === 'agent-plugins.skills')
    const mcp = matrix.find((entry) => entry.id === 'agent-plugins.mcp')
    expect(skills?.firstPartyCitation).toBe('https://agent-plugins.org/specification')
    expect(mcp?.firstPartyCitation).toBe('https://agent-plugins.org/specification')
    expect(mcp?.capability).toBe('mcp')
    expect(renderAgentPluginsNativeOverlayContractMarkdown()).toContain('| MCP |')
  })

  it('renders an authoritative matrix that distinguishes portable, native, extension-proven, degraded, and unsupported', () => {
    const matrix = getAgentPluginsNativeOverlayContractMatrix()
    const rendered = renderAgentPluginsNativeOverlayContractMarkdown()

    const dispositions = new Set(matrix.map((e) => e.disposition))
    expect(dispositions.has('portable')).toBe(true)
    expect(dispositions.has('native')).toBe(true)
    expect(dispositions.has('unsupported')).toBe(true)

    for (const entry of matrix) {
      expect(rendered).toContain(`\`${entry.disposition}\``)
      expect(rendered).toContain(entry.firstPartyCitation)
    }
  })

  it('keeps the committed overlay contract doc byte-identical to the renderer', () => {
    const rendered = renderAgentPluginsNativeOverlayContractMarkdown()
    const committed = readFileSync(
      resolve(ROOT, AGENT_PLUGINS_NATIVE_OVERLAY_CONTRACT_DOCUMENT_PATH),
      'utf-8',
    )
    expect(committed).toBe(rendered)
  })
})
