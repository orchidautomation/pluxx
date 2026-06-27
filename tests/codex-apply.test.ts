import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import {
  planCodexCompanionApply,
  ensureCodexHooksFeature,
  ensureCodexMcpApprovals,
  renderCodexCompanionApplyLines,
} from '../src/cli/codex-apply'

describe('codex companion apply helpers', () => {
  it('adds the canonical Codex hook feature flag without replacing deprecated compatibility context', () => {
    const result = ensureCodexHooksFeature('[features]\ncodex_hooks = true\n')

    expect(result.changed).toBe(true)
    expect(result.text).toContain('[features]\n')
    expect(result.text).toContain('hooks = true')
    expect(result.text).toContain('codex_hooks = true')
  })

  it('updates inline feature tables without introducing codex_hooks as guidance', () => {
    const result = ensureCodexHooksFeature('features = { codex_hooks = true }\n')

    expect(result.changed).toBe(true)
    expect(result.text).toContain('features = { codex_hooks = true, hooks = true }')
  })

  it('updates an existing disabled hook feature flag instead of duplicating it', () => {
    const result = ensureCodexHooksFeature('[features]\nhooks = false\n')

    expect(result.changed).toBe(true)
    expect(result.text).toBe('[features]\nhooks = true\n')
  })

  it('merges missing generated MCP approval stanzas without duplicating existing entries', () => {
    const result = ensureCodexMcpApprovals(
      '[mcp_servers."hosted".tools."search"]\napproval_mode = "approve"\n',
      [
        { serverName: 'hosted', toolName: 'search' },
        { serverName: 'hosted', toolName: 'summarize' },
      ],
    )

    expect(result.changed).toBe(true)
    expect(result.addedCount).toBe(1)
    expect(result.text.match(/hosted"\.tools\."search/g)?.length).toBe(1)
    expect(result.text).toContain('[mcp_servers."hosted".tools."summarize"]')
  })

  it('fails on an existing ask approval table instead of widening it', () => {
    expect(() => ensureCodexMcpApprovals(
      '[mcp_servers."hosted".tools."search"]\napproval_mode = "ask"\n',
      [{ serverName: 'hosted', toolName: 'search' }],
    )).toThrow('already sets approval_mode = "ask"')
  })

  it('fails on an existing deny approval assignment instead of widening it', () => {
    expect(() => ensureCodexMcpApprovals(
      'mcp_servers."hosted".tools."search".approval_mode = "deny"\n',
      [{ serverName: 'hosted', toolName: 'search' }],
    )).toThrow('already sets approval_mode = "deny"')
  })

  it('fails clearly when apply is pointed at a non-Codex bundle path', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-codex-apply-empty-'))

    try {
      expect(() => planCodexCompanionApply({ consumerRoot: dir })).toThrow('No Codex plugin manifest')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('renders the Codex companion lifecycle boundary for dry-run output', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-codex-apply-cli-'))
    const consumerRoot = resolve(dir, 'consumer')
    const projectRoot = resolve(dir, 'project')

    mkdirSync(resolve(consumerRoot, '.codex-plugin'), { recursive: true })
    mkdirSync(resolve(consumerRoot, '.codex'), { recursive: true })
    mkdirSync(resolve(projectRoot, '.codex'), { recursive: true })

    writeFileSync(
      resolve(consumerRoot, '.codex-plugin/plugin.json'),
      JSON.stringify({ name: 'verify-plugin', version: '0.1.0', hooks: 'hooks/hooks.json' }, null, 2),
    )
    mkdirSync(resolve(consumerRoot, 'hooks'), { recursive: true })
    writeFileSync(resolve(consumerRoot, 'hooks/hooks.json'), '{}\n')
    writeFileSync(
      resolve(consumerRoot, '.codex/config.generated.toml'),
      '[mcp_servers."hosted".tools."search"]\napproval_mode = "approve"\n',
    )

    try {
      const result = planCodexCompanionApply({
        consumerRoot,
        projectRoot,
        dryRun: true,
      })

      const output = renderCodexCompanionApplyLines(result, { dryRun: true }).join('\n')

      expect(output).toContain('Codex companion apply changes planned')
      expect(output).toContain('generated Codex companions stay in the installed bundle')
      expect(output).toContain('Hooks: applying `[features].hooks = true` enables the known prerequisite for plugin-bundled hooks')
      expect(output).toContain('`.codex/config.generated.toml` can be merged into active config')
      expect(output).toContain('`.codex/permissions.generated.json` remains the broader advisory mirror')
      expect(output).toContain('refresh/restart Codex and rerun `pluxx verify-install --target codex`')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
