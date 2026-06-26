import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import {
  applyCodexCompanion,
  planCodexCompanionApply,
  ensureCodexHooksFeature,
  ensureCodexMcpApprovals,
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

  it('reapplies idempotently without disturbing unrelated config', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-codex-apply-idempotent-'))

    try {
      const consumerRoot = resolve(dir, 'consumer')
      const projectRoot = resolve(dir, 'project')
      mkdirSync(resolve(consumerRoot, '.codex-plugin'), { recursive: true })
      mkdirSync(resolve(consumerRoot, '.codex'), { recursive: true })
      mkdirSync(resolve(consumerRoot, 'hooks'), { recursive: true })
      mkdirSync(resolve(projectRoot, '.codex'), { recursive: true })

      writeFileSync(
        resolve(consumerRoot, '.codex-plugin/plugin.json'),
        JSON.stringify({ name: 'fixture', version: '0.1.0', hooks: './hooks/hooks.json' }),
      )
      writeFileSync(resolve(consumerRoot, 'hooks/hooks.json'), JSON.stringify({ version: 1, hooks: {} }))
      writeFileSync(
        resolve(consumerRoot, '.codex/config.generated.toml'),
        '[mcp_servers."hosted".tools."search"]\napproval_mode = "approve"\n',
      )
      writeFileSync(
        resolve(projectRoot, '.codex/config.toml'),
        '[sandbox_workspace_write]\nnetwork_access = false\n',
      )

      const first = applyCodexCompanion({ consumerRoot, projectRoot })
      const second = applyCodexCompanion({ consumerRoot, projectRoot })
      const finalConfig = readFileSync(resolve(projectRoot, '.codex/config.toml'), 'utf-8')

      expect(first.changed).toBe(true)
      expect(second.changed).toBe(false)
      expect(finalConfig).toContain('[sandbox_workspace_write]\nnetwork_access = false')
      expect(finalConfig).toContain('[features]\nhooks = true')
      expect(finalConfig.match(/approval_mode = "approve"/g)?.length).toBe(1)
      expect(finalConfig.match(/\[features\]/g)?.length).toBe(1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('surfaces advisory readiness and unsupported permission mirrors in the apply summary', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-codex-apply-summary-'))

    try {
      const consumerRoot = resolve(dir, 'consumer')
      mkdirSync(resolve(consumerRoot, '.codex-plugin'), { recursive: true })
      mkdirSync(resolve(consumerRoot, '.codex'), { recursive: true })
      mkdirSync(resolve(consumerRoot, 'hooks'), { recursive: true })

      writeFileSync(
        resolve(consumerRoot, '.codex-plugin/plugin.json'),
        JSON.stringify({ name: 'fixture', version: '0.1.0', hooks: './hooks/hooks.json' }),
      )
      writeFileSync(resolve(consumerRoot, 'hooks/hooks.json'), JSON.stringify({ version: 1, hooks: {} }))
      writeFileSync(
        resolve(consumerRoot, '.codex/readiness.generated.json'),
        JSON.stringify({
          model: 'pluxx.readiness.v1',
          translatedHooks: {
            sessionStart: 'node "${CODEX_PLUGIN_ROOT}/.codex/pluxx-readiness.mjs" session-start',
          },
        }),
      )
      writeFileSync(
        resolve(consumerRoot, '.codex/permissions.generated.json'),
        JSON.stringify({
          model: 'pluxx.permissions.v1',
          rules: [
            { action: 'allow', kind: 'MCP', pattern: 'hosted.*' },
            { action: 'deny', kind: 'Bash', pattern: '*' },
          ],
          skillPolicies: [{ skillDir: 'hello', permissions: { allow: ['Read(*)'] } }],
        }),
      )

      const result = planCodexCompanionApply({ consumerRoot, includeMcpApprovals: true })

      expect(result.actions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: 'readiness-companion',
          status: 'skipped',
        }),
        expect.objectContaining({
          kind: 'permissions-companion',
          status: 'unsupported',
        }),
      ]))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('fails clearly on malformed generated companions before writing config', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-codex-apply-malformed-'))

    try {
      const consumerRoot = resolve(dir, 'consumer')
      const projectRoot = resolve(dir, 'project')
      mkdirSync(resolve(consumerRoot, '.codex-plugin'), { recursive: true })
      mkdirSync(resolve(consumerRoot, '.codex'), { recursive: true })
      mkdirSync(resolve(projectRoot, '.codex'), { recursive: true })

      writeFileSync(
        resolve(consumerRoot, '.codex-plugin/plugin.json'),
        JSON.stringify({ name: 'fixture', version: '0.1.0' }),
      )
      writeFileSync(resolve(consumerRoot, '.codex/permissions.generated.json'), '{not json}\n')
      writeFileSync(resolve(projectRoot, '.codex/config.toml'), '[sandbox_workspace_write]\nnetwork_access = false\n')

      expect(() => applyCodexCompanion({ consumerRoot, projectRoot })).toThrow('.codex/permissions.generated.json is malformed')
      expect(readFileSync(resolve(projectRoot, '.codex/config.toml'), 'utf-8')).toBe('[sandbox_workspace_write]\nnetwork_access = false\n')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('flags stale companion models as unsupported instead of trusting them silently', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-codex-apply-stale-'))

    try {
      const consumerRoot = resolve(dir, 'consumer')
      mkdirSync(resolve(consumerRoot, '.codex-plugin'), { recursive: true })
      mkdirSync(resolve(consumerRoot, '.codex'), { recursive: true })
      mkdirSync(resolve(consumerRoot, 'hooks'), { recursive: true })

      writeFileSync(
        resolve(consumerRoot, '.codex-plugin/plugin.json'),
        JSON.stringify({ name: 'fixture', version: '0.1.0', hooks: './hooks/hooks.json' }),
      )
      writeFileSync(resolve(consumerRoot, 'hooks/hooks.json'), JSON.stringify({ version: 1, hooks: {} }))
      writeFileSync(
        resolve(consumerRoot, '.codex/hooks.generated.json'),
        JSON.stringify({ model: 'pluxx.codex-hooks.v0', hooks: {} }),
      )

      const result = planCodexCompanionApply({ consumerRoot, includeMcpApprovals: false })

      expect(result.actions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: 'hooks-companion',
          status: 'unsupported',
        }),
      ]))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
