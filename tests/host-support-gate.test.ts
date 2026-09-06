import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { afterEach, describe, expect, it } from 'bun:test'
import {
  HOST_SUPPORT_CLAIMS,
  HOST_SUPPORT_DIMENSIONS,
  HOST_SUPPORT_RETRIEVED_AT,
  inspectIsolatedHostSupportFixture,
  renderHostSupportGateMarkdown,
  validateHostSupportClaims,
  type HostSupportClaim,
} from '../src/compatibility/host-support-gate'

const temporaryRoots: string[] = []
const fixtureRoot = resolve(process.cwd(), 'test-fixtures/host-support-gate')

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function isolatedFixture(): string {
  const home = mkdtempSync(resolve(tmpdir(), 'pluxx-host-support-'))
  temporaryRoots.push(home)
  const installed = resolve(home, '.cursor/plugins/local/pluxx-host-support-proof')
  cpSync(fixtureRoot, installed, { recursive: true })
  return installed
}

describe('host support claim registry', () => {
  it('is complete, current, first-party sourced, and internally valid', () => {
    expect(validateHostSupportClaims()).toEqual([])
    expect(new Set(HOST_SUPPORT_CLAIMS.map(item => `${item.host}:${item.dimension}`)).size).toBe(5 * HOST_SUPPORT_DIMENSIONS.length)
    expect(new Set(HOST_SUPPORT_CLAIMS.map(item => item.retrievedAt))).toEqual(new Set([HOST_SUPPORT_RETRIEVED_AT]))
  })

  it('keeps portable core closed to skills and declared MCP', () => {
    const invalid: HostSupportClaim = {
      ...HOST_SUPPORT_CLAIMS[0],
      dimension: 'native-commands',
      outcome: 'portable',
      minimumProof: 'schema',
      currentProof: 'schema',
    }
    expect(validateHostSupportClaims([invalid])).toContain('agent-plugins:native-commands: portable core may only claim skills or declared MCP')
  })

  it('keeps Cursor portable proof and Codex portable support truthfully bounded', () => {
    const cursorSkills = HOST_SUPPORT_CLAIMS.find(item => item.host === 'cursor' && item.dimension === 'portable-skills')
    const codexSkills = HOST_SUPPORT_CLAIMS.find(item => item.host === 'codex' && item.dimension === 'portable-skills')
    expect(cursorSkills).toMatchObject({ outcome: 'not-yet-behaviorally-proven', currentProof: 'isolated-installed' })
    expect(codexSkills).toMatchObject({ outcome: 'unsupported', currentProof: 'schema' })
  })

  it('does not overclaim structured MCP content from generic MCP execution proof', () => {
    const structuredRows = HOST_SUPPORT_CLAIMS.filter(item => item.dimension === 'structured-mcp-content' && item.host !== 'agent-plugins')
    expect(structuredRows.every(item => item.outcome === 'not-yet-behaviorally-proven')).toBe(true)
  })

  it('rejects support claims whose proof tier is too weak', () => {
    const invalid: HostSupportClaim = {
      ...HOST_SUPPORT_CLAIMS.find(item => item.host === 'cursor' && item.dimension === 'native-commands')!,
      currentProof: 'generated-fixture',
    }
    expect(validateHostSupportClaims(HOST_SUPPORT_CLAIMS.map(item => item.host === invalid.host && item.dimension === invalid.dimension ? invalid : item)))
      .toContain('cursor:native-commands: native-preserved requires discovered, only generated-fixture is recorded')
  })

  it('requires bounded limitations for negative outcomes', () => {
    const target = HOST_SUPPORT_CLAIMS.find(item => item.host === 'codex' && item.dimension === 'portable-skills')!
    const invalid = { ...target, limitation: undefined }
    expect(validateHostSupportClaims(HOST_SUPPORT_CLAIMS.map(item => item === target ? invalid : item)))
      .toContain('codex:portable-skills: unsupported requires an explicit limitation')
  })

  it('rejects missing, unrecognized, and capability-irrelevant evidence artifacts', () => {
    const target = HOST_SUPPORT_CLAIMS.find(item => item.host === 'claude-code' && item.dimension === 'native-commands')!
    const missing = { ...target, evidence: 'docs/fake-proof.md' }
    expect(validateHostSupportClaims(HOST_SUPPORT_CLAIMS.map(item => item === target ? missing : item)))
      .toContain('claude-code:native-commands: unrecognized evidence artifact docs/fake-proof.md')

    const irrelevant = { ...target, evidence: 'docs/orchid/receipts/2026-08-31-pluxx-0.1.42-release.json' }
    expect(validateHostSupportClaims(HOST_SUPPORT_CLAIMS.map(item => item === target ? irrelevant : item)))
      .toContain('claude-code:native-commands: evidence artifact docs/orchid/receipts/2026-08-31-pluxx-0.1.42-release.json does not cover host')
  })
})

describe('isolated maintained fixture', () => {
  it('proves only an isolated install inventory, never real-host behavior', () => {
    const result = inspectIsolatedHostSupportFixture(isolatedFixture())
    expect(result).toMatchObject({
      proofTier: 'isolated-installed',
      client: 'cursor',
      pluginName: 'pluxx-host-support-proof',
      skills: ['support-proof'],
      mcpDeclared: false,
    })
    expect(result.artifactSha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('reports a valid empty MCP configuration as declared', () => {
    const installed = isolatedFixture()
    writeFileSync(resolve(installed, 'mcp.json'), '{"$schema":"https://agent-plugins.org/schemas/1.0.0/mcp.schema.json","mcpServers":{}}\n')
    expect(inspectIsolatedHostSupportFixture(installed)).toMatchObject({
      mcpDeclared: true,
    })
  })

  it('rejects native-only portable payloads', () => {
    const installed = isolatedFixture()
    writeFileSync(resolve(installed, 'hooks.json'), '{}\n')
    expect(() => inspectIsolatedHostSupportFixture(installed)).toThrow('undocumented top-level entry: hooks.json')
  })

  it('rejects invalid manifest, skill frontmatter, and MCP schema', () => {
    const invalidManifest = isolatedFixture()
    const manifest = JSON.parse(readFileSync(resolve(invalidManifest, 'plugin.json'), 'utf8'))
    writeFileSync(resolve(invalidManifest, 'plugin.json'), `${JSON.stringify({ ...manifest, invented: true }, null, 2)}\n`)
    expect(() => inspectIsolatedHostSupportFixture(invalidManifest)).toThrow('unknown field(s): invented')

    const invalidSkill = isolatedFixture()
    writeFileSync(resolve(invalidSkill, 'skills/support-proof/SKILL.md'), '# Missing frontmatter\n')
    expect(() => inspectIsolatedHostSupportFixture(invalidSkill)).toThrow('requires valid YAML frontmatter')

    const invalidMcp = isolatedFixture()
    writeFileSync(resolve(invalidMcp, 'mcp.json'), '{"mcpServers":{}}\n')
    expect(() => inspectIsolatedHostSupportFixture(invalidMcp)).toThrow('must contain the 1.0.0 $schema')
  })

  it('rejects external symlinks for portable files', () => {
    const installed = isolatedFixture()
    const external = resolve(temporaryRoots[temporaryRoots.length - 1], 'outside.md')
    writeFileSync(external, '---\nname: support-proof\ndescription: outside\n---\n')
    rmSync(resolve(installed, 'skills/support-proof/SKILL.md'))
    symlinkSync(external, resolve(installed, 'skills/support-proof/SKILL.md'))
    expect(() => inspectIsolatedHostSupportFixture(installed)).toThrow('refuses symlink')

    const mcpInstalled = isolatedFixture()
    const externalMcpDir = mkdtempSync(resolve(tmpdir(), 'pluxx-host-support-mcp-'))
    temporaryRoots.push(externalMcpDir)
    const externalMcp = resolve(externalMcpDir, 'mcp.json')
    writeFileSync(externalMcp, '{"$schema":"https://agent-plugins.org/schemas/1.0.0/mcp.schema.json","mcpServers":{}}\n')
    mkdirSync(resolve(mcpInstalled), { recursive: true })
    symlinkSync(externalMcp, resolve(mcpInstalled, 'mcp.json'))
    expect(() => inspectIsolatedHostSupportFixture(mcpInstalled)).toThrow('refuses symlink')
  })
})

describe('generated support gate', () => {
  it('stays byte-identical to the checked-in public document', () => {
    expect(readFileSync(resolve(process.cwd(), 'docs/new-host-support-gate.md'), 'utf8')).toBe(renderHostSupportGateMarkdown())
  })

  it('states the evidence boundary and current Codex decision', () => {
    const rendered = renderHostSupportGateMarkdown()
    expect(rendered).toContain('Generated files are not runtime proof.')
    expect(rendered).toContain('Codex has no documented generic Agent Plugins root import path.')
    expect(rendered).toContain('not-yet-behaviorally-proven')
  })
})
