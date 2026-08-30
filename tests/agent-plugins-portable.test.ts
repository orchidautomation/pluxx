import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import {
  AGENT_PLUGINS_MCP_SCHEMA,
  AGENT_PLUGINS_PLUGIN_SCHEMA,
  inspectAgentPluginsDiscovery,
  validateAgentPluginsPackage,
} from '../src/agent-plugins'
import { checkGeneratedBundles } from '../src/bundle-check'
import { installPlugin, planInstallPlugin } from '../src/cli/install'
import { lintProject } from '../src/cli/lint'
import { planPublish } from '../src/cli/publish'
import { verifyInstall } from '../src/cli/verify-install'
import { build } from '../src/generators'
import type { PluginConfig } from '../src/schema'

const ROOT = resolve(import.meta.dir, '.agent-plugins-portable')
const OUT = resolve(ROOT, 'dist/agent-plugins')

function config(overrides: Partial<PluginConfig> = {}): PluginConfig {
  return {
    name: 'portable-fixture',
    version: '1.2.3',
    description: 'Portable fixture',
    author: { name: 'Orchid', url: 'https://example.com' },
    repository: 'https://github.com/orchidautomation/portable-fixture',
    license: 'MIT',
    keywords: ['portable'],
    skills: './skills',
    targets: ['agent-plugins'],
    outDir: './dist',
    ...overrides,
  }
}

function writeProject(skillFrontmatter = 'name: portable-skill\ndescription: Use this skill for portable fixture work.'): void {
  mkdirSync(resolve(ROOT, 'skills/portable-skill/scripts'), { recursive: true })
  writeFileSync(resolve(ROOT, 'skills/portable-skill/SKILL.md'), `---\n${skillFrontmatter}\n---\n\n# Portable skill\n`)
  writeFileSync(resolve(ROOT, 'skills/portable-skill/scripts/server.mjs'), '#!/usr/bin/env node\n')
  writeFileSync(resolve(ROOT, 'pluxx.config.ts'), `export default ${JSON.stringify(config(), null, 2)}\n`)
}

beforeEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
  mkdirSync(ROOT, { recursive: true })
  writeProject()
})

afterEach(() => rmSync(ROOT, { recursive: true, force: true }))

describe('Agent Plugins 1.0.0 portable target', () => {
  it('emits only the closed portable core and preserves representable MCP deterministically', async () => {
    const portable = config({
      mcp: {
        local: {
          transport: 'stdio',
          command: '${PLUGIN_ROOT}/skills/portable-skill/scripts/server.mjs',
          args: ['--data', '${PLUGIN_DATA}/local'],
          env: { CONFIG: '${PLUGIN_ROOT}/skills/portable-skill/config.json' },
        },
        remote: { transport: 'http', url: 'https://example.com/mcp' },
      },
      hooks: { sessionStart: [{ type: 'command', command: 'echo native-only' }] },
      agents: './agents',
      commands: './commands',
    })
    await build(portable, ROOT)

    expect(JSON.parse(readFileSync(resolve(OUT, 'plugin.json'), 'utf-8'))).toEqual({
      $schema: AGENT_PLUGINS_PLUGIN_SCHEMA,
      name: 'portable-fixture',
      version: '1.2.3',
      description: 'Portable fixture',
      author: { name: 'Orchid', url: 'https://example.com' },
      repository: 'https://github.com/orchidautomation/portable-fixture',
      license: 'MIT',
      keywords: ['portable'],
    })
    expect(JSON.parse(readFileSync(resolve(OUT, 'mcp.json'), 'utf-8'))).toEqual({
      $schema: AGENT_PLUGINS_MCP_SCHEMA,
      mcpServers: {
        local: {
          type: 'stdio',
          command: './skills/portable-skill/scripts/server.mjs',
          args: ['--data', '${PLUGIN_DATA}/local'],
          env: { CONFIG: '${PLUGIN_ROOT}/skills/portable-skill/config.json' },
        },
        remote: { type: 'streamable-http', url: 'https://example.com/mcp' },
      },
    })
    expect(existsSync(resolve(OUT, 'hooks'))).toBe(false)
    expect(existsSync(resolve(OUT, 'agents'))).toBe(false)
    expect(existsSync(resolve(OUT, 'commands'))).toBe(false)
    expect(validateAgentPluginsPackage(OUT)).toEqual([
      'mcp.json',
      'plugin.json',
      'skills/portable-skill/SKILL.md',
      'skills/portable-skill/scripts/server.mjs',
    ])
    expect(checkGeneratedBundles(portable, ROOT).issues).toEqual([])
  })

  it('binds isolated Cursor and Codex discovery fixtures to the same artifact hash', async () => {
    await build(config({ mcp: { public: { transport: 'http', url: 'https://example.com/mcp' } } }), ROOT)
    const cursor = inspectAgentPluginsDiscovery(OUT, 'cursor', 'fixture-contract-1.0.0')
    const codex = inspectAgentPluginsDiscovery(OUT, 'codex', 'fixture-contract-1.0.0')
    expect(cursor.skills).toEqual(['portable-skill'])
    expect(cursor.mcpServers).toEqual(['public'])
    expect(codex.skills).toEqual(cursor.skills)
    expect(codex.mcpServers).toEqual(cursor.mcpServers)
    expect(codex.artifactSha256).toBe(cursor.artifactSha256)
  })

  it('fails closed on auth, unsafe URLs, unknown placeholders, and missing portable commands', async () => {
    const cases: PluginConfig[] = [
      config({ mcp: { bad: { transport: 'http', url: 'https://example.com/mcp', auth: { type: 'bearer', envVar: 'TOKEN', headerName: 'Authorization', headerTemplate: 'Bearer ${value}' } } } }),
      config({ mcp: { bad: { transport: 'http', url: 'http://example.com/mcp' } } }),
      config({ mcp: { bad: { transport: 'stdio', command: 'node', args: ['${TOKEN}'] } } }),
      config({ mcp: { bad: { transport: 'stdio', command: '${PLUGIN_ROOT}/scripts/missing.mjs' } } }),
      config({ mcp: { bad: { transport: 'http', url: 'https://example.com/mcp', args: ['not-portable'] } } }),
      config({ mcp: { bad: { transport: 'sse', url: 'https://example.com/sse', env: { TOKEN: 'public' } } } }),
    ]
    for (const candidate of cases) await expect(build(candidate, ROOT)).rejects.toThrow()
  })

  it('keeps the previous portable bundle when staged validation fails', async () => {
    await build(config(), ROOT)
    const before = readFileSync(resolve(OUT, 'plugin.json'), 'utf-8')
    await expect(build(config({
      version: '9.9.9',
      mcp: { bad: { transport: 'stdio', command: '${PLUGIN_ROOT}/scripts/missing.mjs' } },
    }), ROOT)).rejects.toThrow('missing regular command path')
    expect(readFileSync(resolve(OUT, 'plugin.json'), 'utf-8')).toBe(before)
  })

  it('keeps shared-runtime metadata native-only in a mixed native and portable build', async () => {
    mkdirSync(resolve(ROOT, 'scripts'), { recursive: true })
    writeFileSync(resolve(ROOT, 'scripts/bootstrap-runtime.sh'), '#!/usr/bin/env bash\nexit 0\n')
    writeFileSync(resolve(ROOT, 'scripts/package-lock.json'), '{}\n')
    const mixed = config({
      targets: ['cursor', 'agent-plugins'],
      scripts: './scripts',
      sharedRuntime: {
        bootstrap: 'scripts/bootstrap-runtime.sh',
        inputs: ['scripts/package-lock.json'],
        output: 'node_modules',
      },
    })
    await build(mixed, ROOT)
    expect(existsSync(resolve(ROOT, 'dist/cursor/.pluxx-runtime.json'))).toBe(true)
    expect(existsSync(resolve(OUT, '.pluxx-runtime.json'))).toBe(false)
    expect(validateAgentPluginsPackage(OUT)).not.toContain('.pluxx-runtime.json')
  })

  it('rejects malformed post-build MCP cwd, headers, variants, and extension namespaces', async () => {
    await build(config({ mcp: { public: { transport: 'http', url: 'https://example.com/mcp' } } }), ROOT)
    const mcpPath = resolve(OUT, 'mcp.json')
    const cases: Array<Record<string, unknown>> = [
      { type: 'stdio', command: 'node', cwd: '${PLUGIN_DATA}/../escape' },
      { type: 'stdio', command: 'node', cwd: '${PLUGIN_DATA}/bad\\path' },
      { type: 'streamable-http', url: 'https://example.com/mcp', headers: { 'Bad Header': 'x' } },
      { type: 'streamable-http', url: 'https://example.com/mcp', headers: { Authorization: 'x', authorization: 'y' } },
      { type: 'streamable-http', url: 'https://example.com/mcp', args: [] },
    ]
    for (const server of cases) {
      writeFileSync(mcpPath, JSON.stringify({ $schema: AGENT_PLUGINS_MCP_SCHEMA, mcpServers: { bad: server } }))
      expect(() => validateAgentPluginsPackage(OUT)).toThrow()
    }

    rmSync(mcpPath)
    const manifestPath = resolve(OUT, 'plugin.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    writeFileSync(manifestPath, JSON.stringify({ ...manifest, extensions: { cursor: {} } }))
    expect(() => validateAgentPluginsPackage(OUT)).toThrow('reverse-domain')
    writeFileSync(manifestPath, JSON.stringify({ ...manifest, extensions: { 'com.cursor.plugin': {} } }))
    expect(() => validateAgentPluginsPackage(OUT)).toThrow()
  })

  it('requires optional Agent Skill license to retain its portable string shape', async () => {
    writeProject('name: portable-skill\ndescription: Use this skill.\nlicense:\n  name: MIT')
    await expect(build(config(), ROOT)).rejects.toThrow('license must be a string')
  })

  it('rejects nested skills, non-portable frontmatter, source symlinks, and client extensions', async () => {
    mkdirSync(resolve(ROOT, 'skills/portable-skill/nested'), { recursive: true })
    writeFileSync(resolve(ROOT, 'skills/portable-skill/nested/SKILL.md'), '---\nname: nested\ndescription: nested\n---\n')
    await expect(build(config(), ROOT)).rejects.toThrow('nested SKILL.md')

    rmSync(resolve(ROOT, 'skills/portable-skill/nested'), { recursive: true, force: true })
    writeProject('name: portable-skill\ndescription: Use this skill.\nhooks: {}')
    await expect(build(config(), ROOT)).rejects.toThrow('non-portable frontmatter')

    writeProject()
    symlinkSync(resolve(ROOT, 'skills/portable-skill/SKILL.md'), resolve(ROOT, 'skills/portable-skill/linked.md'))
    await expect(build(config(), ROOT)).rejects.toThrow('refuses symlink')

    rmSync(resolve(ROOT, 'skills/portable-skill/linked.md'))
    await build(config(), ROOT)
    mkdirSync(resolve(OUT, 'com.cursor/hooks'), { recursive: true })
    writeFileSync(resolve(OUT, 'com.cursor/hooks/hooks.json'), '{}')
    expect(() => validateAgentPluginsPackage(OUT)).toThrow(/negative decision|unproven client extension|No allowlisted extension/)
  })

  it('rejects undocumented skills-root entries and skill directories without SKILL.md', async () => {
    writeFileSync(resolve(ROOT, 'skills/README.md'), '# Not a discoverable skill\n')
    await expect(build(config(), ROOT)).rejects.toThrow('only immediate child skill directories')

    rmSync(resolve(ROOT, 'skills/README.md'))
    mkdirSync(resolve(ROOT, 'skills/missing-skill'), { recursive: true })
    await expect(build(config(), ROOT)).rejects.toThrow('requires a regular immediate-child SKILL.md')
  })

  it('surfaces deterministic degradation and rejects unrepresentable MCP during lint', async () => {
    const source = config({
      hooks: { sessionStart: [{ type: 'command', command: 'echo native' }] },
      agents: './agents',
      commands: './commands',
      permissions: { allow: ['Bash(git:*)'] },
      mcp: {
        private: { transport: 'http', url: 'https://example.com/mcp', auth: { type: 'platform', mode: 'oauth' } },
        unsafe: { transport: 'http', url: 'http://example.com/mcp' },
      },
    })
    writeFileSync(resolve(ROOT, 'pluxx.config.ts'), `export default ${JSON.stringify(source, null, 2)}\n`)
    const result = await lintProject(ROOT)
    expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
      'agent-plugins-drop-agents',
      'agent-plugins-drop-commands',
      'agent-plugins-drop-hooks',
      'agent-plugins-drop-permissions',
      'agent-plugins-mcp-unrepresentable',
    ]))
    expect(result.issues.filter(issue => issue.code === 'agent-plugins-mcp-unrepresentable').map(issue => issue.message)).toEqual([
      expect.stringContaining('private'),
      expect.stringContaining('unsafe'),
    ])
  })

  it('builds an MDP-shaped portable consumer while dropping native-only hooks', async () => {
    const mdpShaped = config({
      name: 'message-decision-packs',
      description: 'Message decision pack skills with an optional public MCP server.',
      hooks: { sessionStart: [{ type: 'command', command: 'echo native bootstrap' }] },
      permissions: { allow: ['Bash(git:*)'] },
      mcp: { publicResearch: { transport: 'http', url: 'https://example.com/mcp' } },
    })
    await build(mdpShaped, ROOT)
    expect(validateAgentPluginsPackage(OUT)).toContain('skills/portable-skill/SKILL.md')
    expect(JSON.parse(readFileSync(resolve(OUT, 'mcp.json'), 'utf-8')).mcpServers.publicResearch.type).toBe('streamable-http')
    expect(existsSync(resolve(OUT, 'hooks'))).toBe(false)
    expect(existsSync(resolve(OUT, 'permissions.json'))).toBe(false)
  })

  it('plans client-managed installation, refuses a fake native install, and archives without an installer', async () => {
    await build(config(), ROOT)
    const installPlan = planInstallPlugin(resolve(ROOT, 'dist'), 'portable-fixture', ['agent-plugins'])
    expect(installPlan).toHaveLength(1)
    expect(installPlan[0].description).toContain('client-managed/manual')
    await expect(installPlugin(resolve(ROOT, 'dist'), 'portable-fixture', ['agent-plugins'])).rejects.toThrow('client-managed')
    await expect(verifyInstall(config(), { rootDir: ROOT, targets: ['agent-plugins'] })).rejects.toThrow('client-managed')

    const publish = planPublish(config(), {
      rootDir: ROOT,
      requestedChannels: ['github-release'],
      dryRun: true,
      allowDirty: true,
      runCommand: (command, args) => {
        if (command === 'gh' && args[0] === 'auth') return { status: 0, stdout: '', stderr: '' }
        if (command === 'git' && args[0] === 'remote') return { status: 0, stdout: 'git@github.com:orchidautomation/portable-fixture.git\n', stderr: '' }
        return { status: 0, stdout: '', stderr: '' }
      },
    })
    const names = publish.channels.githubRelease.assets.map(asset => asset.name)
    expect(names).toContain('portable-fixture-agent-plugins-v1.2.3.tar.gz')
    expect(names).toContain('portable-fixture-agent-plugins-latest.tar.gz')
    expect(names).not.toContain('install-agent-plugins.sh')
    expect(names).not.toContain('install.sh')
  })
})
