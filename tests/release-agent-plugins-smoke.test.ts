import { afterEach, describe, expect, it } from 'bun:test'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import {
  inspectAgentPluginsDiscovery,
  validateAgentPluginsPackage,
} from '../src/agent-plugins'
import { build } from '../src/generators'
import type { PluginConfig } from '../src/schema'

const PACKAGE_VERSION = JSON.parse(readFileSync(resolve(import.meta.dir, '../package.json'), 'utf-8')).version as string
const EXPECTED_ARTIFACT_SHA256 = '02d7437b7c3a144a18ff55e8cb8f824f277b6ce72bc6686e481e880e10c6ae77'
const roots: string[] = []

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'pluxx-agent-plugins-release-'))
  roots.push(root)
  return root
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true })
})

describe('Agent Plugins release-prep isolated fixture proof', () => {
  it('copies one strict portable artifact into clean Cursor and Codex fixture homes and discovers identical skills and MCP', async () => {
    const root = temporaryRoot()
    const sourceRoot = resolve(root, 'source')
    const fakeHome = resolve(root, 'fake-home')
    mkdirSync(resolve(sourceRoot, 'skills/release-portable'), { recursive: true })
    writeFileSync(
      resolve(sourceRoot, 'skills/release-portable/SKILL.md'),
      '---\nname: release-portable\ndescription: Release-prep portable discovery fixture.\n---\n\n# Release portable\n',
    )

    const config: PluginConfig = {
      name: 'pluxx-release-portable-fixture',
      version: PACKAGE_VERSION,
      description: 'Strict Agent Plugins release-prep fixture.',
      author: { name: 'Orchid Automation' },
      skills: './skills',
      targets: ['agent-plugins'],
      outDir: './dist',
      mcp: {
        publicDocs: {
          transport: 'http',
          url: 'https://example.com/mcp',
        },
      },
      hooks: {
        sessionStart: [{ type: 'command', command: 'echo native-only' }],
      },
    }

    await build(config, sourceRoot)
    const artifact = resolve(sourceRoot, 'dist/agent-plugins')
    const cursorFixture = resolve(fakeHome, '.cursor/plugins/local/pluxx-release-portable-fixture')
    // Codex does not currently document a native Agent Plugins local-import path.
    // This is a clean compatible-client contract fixture, not an active Codex install.
    const codexFixture = resolve(fakeHome, 'compatible-client-fixtures/codex/pluxx-release-portable-fixture')
    cpSync(artifact, cursorFixture, { recursive: true })
    cpSync(artifact, codexFixture, { recursive: true })

    const cursor = inspectAgentPluginsDiscovery(cursorFixture, 'cursor', 'release-fixture-contract-1.0.0')
    const codex = inspectAgentPluginsDiscovery(codexFixture, 'codex', 'release-fixture-contract-1.0.0')

    expect(cursor.skills).toEqual(['release-portable'])
    expect(cursor.mcpServers).toEqual(['publicDocs'])
    expect(codex.skills).toEqual(cursor.skills)
    expect(codex.mcpServers).toEqual(cursor.mcpServers)
    expect(codex.artifactSha256).toBe(cursor.artifactSha256)
    expect(cursor.artifactSha256).toBe(EXPECTED_ARTIFACT_SHA256)
    expect(validateAgentPluginsPackage(cursorFixture)).toEqual([
      'mcp.json',
      'plugin.json',
      'skills/release-portable/SKILL.md',
    ])
    expect(validateAgentPluginsPackage(codexFixture)).toEqual(validateAgentPluginsPackage(cursorFixture))
  })
})
