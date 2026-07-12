import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import {
  removeCodexAgentRegistration,
  syncCodexAgentRegistration,
  verifyCodexAgentRegistration,
} from '../src/codex-agent-install'

const roots: string[] = []

function createFixture(pluginName = 'sendlens'): {
  root: string
  consumerRoot: string
  codexHome: string
  sourceAgentPath: string
} {
  const root = mkdtempSync(resolve(tmpdir(), 'pluxx-codex-agent-install-'))
  roots.push(root)
  const consumerRoot = resolve(root, 'consumer')
  const codexHome = resolve(root, 'codex-home')
  const sourceAgentPath = resolve(consumerRoot, '.codex/agents/campaign-strategist.toml')

  mkdirSync(resolve(consumerRoot, '.codex-plugin'), { recursive: true })
  mkdirSync(resolve(sourceAgentPath, '..'), { recursive: true })
  writeFileSync(
    resolve(consumerRoot, '.codex-plugin/plugin.json'),
    JSON.stringify({ name: pluginName, version: '1.2.3' }, null, 2),
  )
  writeFileSync(
    sourceAgentPath,
    [
      'name = "campaign-strategist"',
      'description = "Turns evidence into a campaign strategy."',
      'developer_instructions = """',
      'Use validated SendLens evidence.',
      '"""',
      '',
    ].join('\n'),
  )

  return { root, consumerRoot, codexHome, sourceAgentPath }
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('Codex agent registration', () => {
  it('syncs bundled agents into a plugin-owned user agent directory and verifies them', () => {
    const { consumerRoot, codexHome } = createFixture()

    const result = syncCodexAgentRegistration({ consumerRoot, codexHome })
    const installedPath = resolve(codexHome, 'agents/sendlens/campaign-strategist.toml')

    expect(result.changed).toBe(true)
    expect(result.installed).toEqual(['campaign-strategist'])
    expect(existsSync(installedPath)).toBe(true)
    expect(readFileSync(installedPath, 'utf-8')).toContain('name = "campaign-strategist"')
    expect(existsSync(resolve(codexHome, 'pluxx/agent-installs/sendlens.json'))).toBe(true)
    expect(verifyCodexAgentRegistration({ consumerRoot, codexHome })).toMatchObject({
      ok: true,
      required: 1,
      issues: [],
    })
  })

  it('plans a dry-run without writing active Codex state', () => {
    const { consumerRoot, codexHome } = createFixture()

    const result = syncCodexAgentRegistration({ consumerRoot, codexHome, dryRun: true })

    expect(result.changed).toBe(true)
    expect(result.installed).toEqual(['campaign-strategist'])
    expect(existsSync(resolve(codexHome, 'agents'))).toBe(false)
    expect(existsSync(result.ownershipPath)).toBe(false)
  })

  it('rejects a duplicate runtime name owned outside the target plugin directory', () => {
    const { consumerRoot, codexHome } = createFixture()
    const conflictingPath = resolve(codexHome, 'agents/another-plugin/strategist.toml')
    mkdirSync(resolve(conflictingPath, '..'), { recursive: true })
    writeFileSync(
      conflictingPath,
      [
        'name = "campaign-strategist"',
        'description = "Conflicting agent."',
        'developer_instructions = "Do something else."',
        '',
      ].join('\n'),
    )

    expect(() => syncCodexAgentRegistration({ consumerRoot, codexHome })).toThrow(
      'Codex agent name collision for "campaign-strategist"',
    )
    expect(existsSync(resolve(codexHome, 'agents/sendlens'))).toBe(false)
  })

  it('moves an unchanged owned agent when its bundled path changes', () => {
    const { consumerRoot, codexHome, sourceAgentPath } = createFixture()
    syncCodexAgentRegistration({ consumerRoot, codexHome })
    const oldInstalledPath = resolve(codexHome, 'agents/sendlens/campaign-strategist.toml')
    const movedSourcePath = resolve(consumerRoot, '.codex/agents/strategy/campaign-strategist.toml')
    mkdirSync(resolve(movedSourcePath, '..'), { recursive: true })
    writeFileSync(movedSourcePath, readFileSync(sourceAgentPath, 'utf-8'))
    rmSync(sourceAgentPath)

    const result = syncCodexAgentRegistration({ consumerRoot, codexHome })
    const movedInstalledPath = resolve(codexHome, 'agents/sendlens/strategy/campaign-strategist.toml')

    expect(result.installed).toEqual(['campaign-strategist'])
    expect(result.removed).toEqual(['campaign-strategist'])
    expect(existsSync(oldInstalledPath)).toBe(false)
    expect(existsSync(movedInstalledPath)).toBe(true)
    expect(verifyCodexAgentRegistration({ consumerRoot, codexHome }).ok).toBe(true)
  })

  it('reports missing and stale active registrations', () => {
    const { consumerRoot, codexHome, sourceAgentPath } = createFixture()
    syncCodexAgentRegistration({ consumerRoot, codexHome })
    const installedPath = resolve(codexHome, 'agents/sendlens/campaign-strategist.toml')

    rmSync(installedPath)
    const missing = verifyCodexAgentRegistration({ consumerRoot, codexHome })
    expect(missing.ok).toBe(false)
    expect(missing.issues[0]?.code).toBe('codex-agent-registration-missing')

    mkdirSync(resolve(installedPath, '..'), { recursive: true })
    writeFileSync(installedPath, readFileSync(sourceAgentPath, 'utf-8').replace('validated', 'unvalidated'))
    const stale = verifyCodexAgentRegistration({ consumerRoot, codexHome })
    expect(stale.ok).toBe(false)
    expect(stale.issues[0]?.code).toBe('codex-agent-registration-stale')
  })

  it('removes unchanged owned agents but preserves user-edited registrations', () => {
    const first = createFixture('sendlens-clean')
    syncCodexAgentRegistration({ consumerRoot: first.consumerRoot, codexHome: first.codexHome })
    const cleanPath = resolve(first.codexHome, 'agents/sendlens-clean/campaign-strategist.toml')

    const cleanRemoval = removeCodexAgentRegistration({ pluginName: 'sendlens-clean', codexHome: first.codexHome })
    expect(cleanRemoval.removed).toEqual(['campaign-strategist'])
    expect(existsSync(cleanPath)).toBe(false)

    const edited = createFixture('sendlens-edited')
    syncCodexAgentRegistration({ consumerRoot: edited.consumerRoot, codexHome: edited.codexHome })
    const editedPath = resolve(edited.codexHome, 'agents/sendlens-edited/campaign-strategist.toml')
    writeFileSync(editedPath, `${readFileSync(editedPath, 'utf-8')}# user customization\n`)

    const editedRemoval = removeCodexAgentRegistration({ pluginName: 'sendlens-edited', codexHome: edited.codexHome })
    expect(editedRemoval.removed).toEqual([])
    expect(editedRemoval.preserved).toEqual(['campaign-strategist'])
    expect(existsSync(editedPath)).toBe(true)
    expect(existsSync(editedRemoval.ownershipPath)).toBe(false)
  })

  it('rejects unsafe paths in a tampered ownership record', () => {
    const { root, codexHome } = createFixture('sendlens-tampered')
    const sentinelPath = resolve(root, 'sentinel.toml')
    const ownershipPath = resolve(codexHome, 'pluxx/agent-installs/sendlens-tampered.json')
    writeFileSync(sentinelPath, 'do not delete\n')
    mkdirSync(resolve(ownershipPath, '..'), { recursive: true })
    writeFileSync(
      ownershipPath,
      JSON.stringify({
        schema: 'pluxx.codex-agent-install.v1',
        pluginName: 'sendlens-tampered',
        agents: [{
          name: 'malicious',
          relativePath: '../../../sentinel.toml',
          sha256: '0'.repeat(64),
        }],
      }),
    )

    expect(() => removeCodexAgentRegistration({ pluginName: 'sendlens-tampered', codexHome })).toThrow(
      'invalid owned agent entry',
    )
    expect(existsSync(sentinelPath)).toBe(true)
  })
})
