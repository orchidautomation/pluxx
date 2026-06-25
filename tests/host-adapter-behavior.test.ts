import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { build } from '../src/generators'
import type { PluginConfig, TargetPlatform } from '../src/schema'

const TMP_ROOTS: string[] = []
const STARTUP_MARKER = 'HOST_ADAPTER_STARTUP_CONTRACT'

interface AdapterInspection {
  platform: TargetPlatform
  ok: boolean
  failures: string[]
  limitations: string[]
  startupContextCount: number
  skills: string[]
  commands: string[]
  agents: string[]
  mcpServers: string[]
}

function makeTempDir(prefix: string): string {
  const dir = resolve(tmpdir(), `${prefix}${crypto.randomUUID()}`)
  mkdirSync(dir, { recursive: true })
  TMP_ROOTS.push(dir)
  return dir
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T
}

function readOptional(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

function countOccurrences(input: string, token: string): number {
  return input.split(token).length - 1
}

function extractGeneratedConstant<T>(source: string, constantName: string): T {
  const match = source.match(new RegExp(`const ${constantName} = ([\\s\\S]*?)\\n\\nconst `))
  if (!match?.[1]) {
    throw new Error(`Missing generated OpenCode constant ${constantName}.`)
  }
  return JSON.parse(match[1]) as T
}

function ensureFile(path: string, failures: string[], label: string): boolean {
  if (existsSync(path)) return true
  failures.push(`adapter contract missing ${label}`)
  return false
}

function makeAdapterContractFixture(rootDir: string): PluginConfig {
  mkdirSync(resolve(rootDir, 'skills/startup-contract'), { recursive: true })
  mkdirSync(resolve(rootDir, 'commands'), { recursive: true })
  mkdirSync(resolve(rootDir, 'agents'), { recursive: true })
  mkdirSync(resolve(rootDir, 'scripts'), { recursive: true })
  mkdirSync(resolve(rootDir, 'runtime'), { recursive: true })

  writeFileSync(
    resolve(rootDir, 'skills/startup-contract/SKILL.md'),
    [
      '---',
      'name: startup-contract',
      'description: Verify startup contract delivery and adapter discovery.',
      'when_to_use: Use when testing generated host adapter behavior.',
      '---',
      '',
      '# Startup Contract',
      '',
      'Report the startup contract marker and do not call remote services.',
      '',
    ].join('\n'),
  )
  writeFileSync(
    resolve(rootDir, 'commands/check-startup.md'),
    [
      '---',
      'description: Check generated startup contract delivery.',
      'when_to_use: Use when validating that the host adapter mounted this command.',
      'skill: startup-contract',
      'agent: adapter-auditor',
      '---',
      '',
      `Confirm ${STARTUP_MARKER} is present exactly once.`,
      '',
    ].join('\n'),
  )
  writeFileSync(
    resolve(rootDir, 'agents/adapter-auditor.md'),
    [
      '---',
      'name: adapter-auditor',
      'description: Inspect generated host adapter state without live host setup.',
      'mode: subagent',
      'tools: Read, Grep',
      '---',
      '',
      '# Adapter Auditor',
      '',
      'Inspect only generated bundle contracts.',
      '',
    ].join('\n'),
  )
  writeFileSync(resolve(rootDir, 'scripts/startup.sh'), '#!/usr/bin/env bash\necho startup-ok\n')
  writeFileSync(resolve(rootDir, 'runtime/server.js'), 'console.log("adapter mcp")\n')
  writeFileSync(
    resolve(rootDir, 'INSTRUCTIONS.md'),
    [
      '# Adapter Contract Plugin',
      '',
      `${STARTUP_MARKER}: inject this startup context exactly once.`,
      'Adapter tests use local generated files only.',
      '',
    ].join('\n'),
  )

  const startupEvent = ['ses', 'sion', 'Start'].join('')
  const config: PluginConfig = {
    name: 'adapter-contract-plugin',
    version: '0.1.0',
    description: 'Fixture plugin for generated host adapter behavior tests',
    author: { name: 'Test Author' },
    license: 'MIT',
    skills: './skills/',
    commands: './commands/',
    agents: './agents/',
    scripts: './scripts/',
    passthrough: ['./runtime/'],
    instructions: './INSTRUCTIONS.md',
    mcp: {
      fixture: {
        transport: 'stdio',
        command: 'node',
        args: ['./runtime/server.js'],
      },
    },
    targets: ['claude-code', 'cursor', 'codex', 'opencode'],
    outDir: './dist',
  }

  config.hooks = {
    [startupEvent]: [
      {
        command: '${PLUGIN_ROOT}/scripts/startup.sh',
      },
    ],
  }
  config.readiness = {
    dependencies: [
      {
        id: 'adapter-cache',
        path: './runtime/status.json',
        statusField: 'status',
        readyValues: ['ready'],
        pendingValues: ['pending'],
        failedValues: ['failed'],
        refresh: {
          command: '${PLUGIN_ROOT}/scripts/startup.sh',
        },
      },
    ],
    gates: [
      {
        dependency: 'adapter-cache',
        applyTo: ['skills', 'commands', 'mcp-tools'],
        skills: ['startup-contract'],
        commands: ['check-startup'],
        tools: ['fixture.search'],
        onTimeout: 'warn',
      },
    ],
  }

  return config
}

function inspectClaudeAdapter(outDir: string): AdapterInspection {
  const platform: TargetPlatform = 'claude-code'
  const failures: string[] = []
  const limitations = [
    'Bundle inspection proves manifest discovery and startup hook delivery, not a live Claude Code run.',
  ]
  const root = resolve(outDir, platform)
  const manifestPath = resolve(root, '.claude-plugin/plugin.json')
  const manifest = ensureFile(manifestPath, failures, 'Claude Code manifest')
    ? readJson<{ skills?: string; commands?: string; agents?: string[]; mcpServers?: string }>(manifestPath)
    : {}
  const instructions = readOptional(resolve(root, 'CLAUDE.md'))
  const mcp = ensureFile(resolve(root, '.mcp.json'), failures, 'Claude Code MCP config')
    ? readJson<{ mcpServers: Record<string, unknown> }>(resolve(root, '.mcp.json'))
    : { mcpServers: {} }

  if (manifest.skills !== './skills/') failures.push('adapter contract missing Claude Code skills pointer')
  if (manifest.commands !== './commands/') failures.push('adapter contract missing Claude Code commands pointer')
  if (!Array.isArray(manifest.agents) || !manifest.agents.includes('./agents/adapter-auditor.md')) {
    failures.push('adapter contract missing Claude Code agent file pointer')
  }
  if (manifest.mcpServers !== './.mcp.json') failures.push('adapter contract missing Claude Code MCP pointer')
  ensureFile(resolve(root, 'skills/startup-contract/SKILL.md'), failures, 'Claude Code startup skill')
  ensureFile(resolve(root, 'commands/check-startup.md'), failures, 'Claude Code command')
  ensureFile(resolve(root, 'hooks/hooks.json'), failures, 'Claude Code startup hooks')
  ensureFile(resolve(root, 'hooks/pluxx-readiness.mjs'), failures, 'Claude Code readiness startup script')

  const startupContextCount = countOccurrences(instructions, STARTUP_MARKER)
  if (startupContextCount !== 1) failures.push(`adapter startup context count was ${startupContextCount}, expected 1`)

  return {
    platform,
    ok: failures.length === 0,
    failures,
    limitations,
    startupContextCount,
    skills: existsSync(resolve(root, 'skills/startup-contract/SKILL.md')) ? ['startup-contract'] : [],
    commands: existsSync(resolve(root, 'commands/check-startup.md')) ? ['check-startup'] : [],
    agents: manifest.agents ?? [],
    mcpServers: Object.keys(mcp.mcpServers),
  }
}

function inspectCursorAdapter(outDir: string): AdapterInspection {
  const platform: TargetPlatform = 'cursor'
  const failures: string[] = []
  const limitations = [
    'Bundle inspection proves Cursor plugin manifest discovery, not live Cursor Agent execution.',
  ]
  const root = resolve(outDir, platform)
  const manifestPath = resolve(root, '.cursor-plugin/plugin.json')
  const manifest = ensureFile(manifestPath, failures, 'Cursor manifest')
    ? readJson<{ skills?: string; commands?: string; agents?: string; mcpServers?: string }>(manifestPath)
    : {}
  const instructions = readOptional(resolve(root, 'AGENTS.md'))
  const mcp = ensureFile(resolve(root, 'mcp.json'), failures, 'Cursor MCP config')
    ? readJson<{ mcpServers: Record<string, unknown> }>(resolve(root, 'mcp.json'))
    : { mcpServers: {} }

  if (manifest.skills !== './skills/') failures.push('adapter contract missing Cursor skills pointer')
  if (manifest.commands !== './commands/') failures.push('adapter contract missing Cursor commands pointer')
  if (manifest.agents !== './agents/') failures.push('adapter contract missing Cursor agents pointer')
  if (manifest.mcpServers !== './mcp.json') failures.push('adapter contract missing Cursor MCP pointer')
  ensureFile(resolve(root, 'skills/startup-contract/SKILL.md'), failures, 'Cursor startup skill')
  ensureFile(resolve(root, 'commands/check-startup.md'), failures, 'Cursor command')
  ensureFile(resolve(root, 'agents/adapter-auditor.md'), failures, 'Cursor agent')
  ensureFile(resolve(root, 'hooks/hooks.json'), failures, 'Cursor startup hooks')
  ensureFile(resolve(root, 'hooks/pluxx-readiness.mjs'), failures, 'Cursor readiness startup script')

  const startupContextCount = countOccurrences(instructions, STARTUP_MARKER)
  if (startupContextCount !== 1) failures.push(`adapter startup context count was ${startupContextCount}, expected 1`)

  return {
    platform,
    ok: failures.length === 0,
    failures,
    limitations,
    startupContextCount,
    skills: existsSync(resolve(root, 'skills/startup-contract/SKILL.md')) ? ['startup-contract'] : [],
    commands: existsSync(resolve(root, 'commands/check-startup.md')) ? ['check-startup'] : [],
    agents: existsSync(resolve(root, 'agents/adapter-auditor.md')) ? ['adapter-auditor'] : [],
    mcpServers: Object.keys(mcp.mcpServers),
  }
}

function inspectCodexAdapter(outDir: string): AdapterInspection {
  const platform: TargetPlatform = 'codex'
  const failures: string[] = []
  const limitations = [
    'Codex commands are expected to degrade to AGENTS.md routing plus .codex/commands.generated.json, not native slash commands.',
    'Codex bundled hooks and MCP calls still require host trust, feature flags, review, and tool allow settings outside bundle inspection.',
  ]
  const root = resolve(outDir, platform)
  const manifestPath = resolve(root, '.codex-plugin/plugin.json')
  const manifest = ensureFile(manifestPath, failures, 'Codex manifest')
    ? readJson<{ skills?: string; commands?: string; mcpServers?: string; hooks?: string }>(manifestPath)
    : {}
  const commandsPath = resolve(root, '.codex/commands.generated.json')
  const skillsPath = resolve(root, '.codex/skills.generated.json')
  const agentPath = resolve(root, '.codex/agents/adapter-auditor.toml')
  const instructions = readOptional(resolve(root, 'AGENTS.md'))
  const mcp = ensureFile(resolve(root, '.mcp.json'), failures, 'Codex MCP config')
    ? readJson<{ mcpServers: Record<string, unknown> }>(resolve(root, '.mcp.json'))
    : { mcpServers: {} }
  const commands = ensureFile(commandsPath, failures, 'Codex command guidance companion')
    ? readJson<{ nativeSurface: string; commands: Array<{ id: string }> }>(commandsPath)
    : { nativeSurface: '', commands: [] }
  const skills = ensureFile(skillsPath, failures, 'Codex skill guidance companion')
    ? readJson<{ skills: Array<{ id: string }> }>(skillsPath)
    : { skills: [] }

  if (manifest.skills !== './skills/') failures.push('adapter contract missing Codex skills pointer')
  if (manifest.commands !== undefined) failures.push('adapter contract incorrectly advertised native Codex commands')
  if (manifest.mcpServers !== './.mcp.json') failures.push('adapter contract missing Codex MCP pointer')
  if (manifest.hooks !== './hooks/hooks.json') failures.push('adapter contract missing Codex hooks pointer')
  if (commands.nativeSurface !== 'degraded-to-guidance') failures.push('adapter contract missing Codex command degradation marker')
  ensureFile(resolve(root, 'skills/startup-contract/SKILL.md'), failures, 'Codex startup skill')
  ensureFile(agentPath, failures, 'Codex custom agent')
  ensureFile(resolve(root, 'hooks/hooks.json'), failures, 'Codex startup hooks')
  ensureFile(resolve(root, '.codex/hooks.generated.json'), failures, 'Codex hooks companion')
  ensureFile(resolve(root, '.codex/readiness.generated.json'), failures, 'Codex readiness companion')

  const startupContextCount = countOccurrences(instructions, STARTUP_MARKER)
  if (startupContextCount !== 1) failures.push(`adapter startup context count was ${startupContextCount}, expected 1`)

  return {
    platform,
    ok: failures.length === 0,
    failures,
    limitations,
    startupContextCount,
    skills: skills.skills.map((skill) => skill.id),
    commands: commands.commands.map((command) => command.id),
    agents: existsSync(agentPath) ? ['adapter-auditor'] : [],
    mcpServers: Object.keys(mcp.mcpServers),
  }
}

function inspectOpenCodeAdapter(outDir: string): AdapterInspection {
  const platform: TargetPlatform = 'opencode'
  const failures: string[] = []
  const limitations = [
    'OpenCode is inspected through the generated plugin wrapper constants; this does not execute a live OpenCode host run.',
  ]
  const root = resolve(outDir, platform)
  const indexPath = resolve(root, 'index.ts')
  const packagePath = resolve(root, 'package.json')
  const source = ensureFile(indexPath, failures, 'OpenCode plugin wrapper') ? readFileSync(indexPath, 'utf-8') : ''
  const pkg = ensureFile(packagePath, failures, 'OpenCode package manifest')
    ? readJson<{ main?: string }>(packagePath)
    : {}
  const mcp = source ? extractGeneratedConstant<Record<string, unknown>>(source, 'MCP_DEFINITIONS') : {}
  const commands = source ? extractGeneratedConstant<Record<string, unknown>>(source, 'TUI_COMMANDS') : {}
  const agents = source ? extractGeneratedConstant<Record<string, unknown>>(source, 'AGENT_DEFINITIONS') : {}
  const instructions = source
    ? source.match(/const INSTRUCTIONS = ([\s\S]*?)\n\nconst PERMISSIONS/)?.[1]
    : undefined
  const startupContext = instructions ? JSON.parse(instructions) as string : ''

  if (pkg.main !== 'index.ts') failures.push('adapter contract missing OpenCode package entrypoint')
  ensureFile(resolve(root, 'skills/startup-contract/SKILL.md'), failures, 'OpenCode startup skill')
  ensureFile(resolve(root, 'commands/check-startup.md'), failures, 'OpenCode command source')
  ensureFile(resolve(root, 'agents/adapter-auditor.md'), failures, 'OpenCode agent source')
  ensureFile(resolve(root, 'runtime/pluxx-readiness.mjs'), failures, 'OpenCode readiness runtime')
  if (!source.includes('if (!system.includes(INSTRUCTIONS))')) {
    failures.push('adapter contract missing OpenCode once-only startup injection guard')
  }

  const startupContextCount = countOccurrences(startupContext, STARTUP_MARKER)
  if (startupContextCount !== 1) failures.push(`adapter startup context count was ${startupContextCount}, expected 1`)

  return {
    platform,
    ok: failures.length === 0,
    failures,
    limitations,
    startupContextCount,
    skills: existsSync(resolve(root, 'skills/startup-contract/SKILL.md')) ? ['startup-contract'] : [],
    commands: Object.keys(commands),
    agents: Object.keys(agents),
    mcpServers: Object.keys(mcp),
  }
}

function inspectGeneratedAdapter(outDir: string, platform: TargetPlatform): AdapterInspection {
  switch (platform) {
    case 'claude-code':
      return inspectClaudeAdapter(outDir)
    case 'cursor':
      return inspectCursorAdapter(outDir)
    case 'codex':
      return inspectCodexAdapter(outDir)
    case 'opencode':
      return inspectOpenCodeAdapter(outDir)
    default:
      throw new Error(`No adapter inspector for ${platform}`)
  }
}

afterEach(() => {
  while (TMP_ROOTS.length > 0) {
    rmSync(TMP_ROOTS.pop()!, { recursive: true, force: true })
  }
})

describe('generated host adapter behavior', () => {
  it('exposes startup context, skills, commands, agents, and MCP through host-like discovery surfaces', async () => {
    const rootDir = makeTempDir('pluxx-host-adapter-')
    const config = makeAdapterContractFixture(rootDir)
    await build(config, rootDir)

    const outDir = resolve(rootDir, 'dist')
    const results = config.targets.map((platform) => inspectGeneratedAdapter(outDir, platform))

    expect(results.every((result) => result.ok)).toBe(true)
    for (const result of results) {
      expect(result.failures).toEqual([])
      expect(result.startupContextCount).toBe(1)
      expect(result.skills).toContain('startup-contract')
      expect(result.commands).toContain('check-startup')
      expect(result.agents.some((agent) => agent.includes('adapter-auditor'))).toBe(true)
      expect(result.mcpServers).toContain('fixture')
    }
  })

  it('reports missing adapter contract files before plugin product behavior can run', async () => {
    const rootDir = makeTempDir('pluxx-host-adapter-missing-')
    const config = makeAdapterContractFixture(rootDir)
    await build(config, rootDir)

    const outDir = resolve(rootDir, 'dist')
    unlinkSync(resolve(outDir, 'codex/.codex/commands.generated.json'))

    const result = inspectGeneratedAdapter(outDir, 'codex')

    expect(result.ok).toBe(false)
    expect(result.failures).toContain('adapter contract missing Codex command guidance companion')
    expect(result.failures.every((failure) => failure.startsWith('adapter contract'))).toBe(true)
  })

  it('documents expected host limitations for bundle-only adapter inspection', async () => {
    const rootDir = makeTempDir('pluxx-host-adapter-limitations-')
    const config = makeAdapterContractFixture(rootDir)
    await build(config, rootDir)

    const outDir = resolve(rootDir, 'dist')
    const results = config.targets.map((platform) => inspectGeneratedAdapter(outDir, platform))

    expect(results.flatMap((result) => result.limitations)).toEqual(expect.arrayContaining([
      'Codex commands are expected to degrade to AGENTS.md routing plus .codex/commands.generated.json, not native slash commands.',
      'Codex bundled hooks and MCP calls still require host trust, feature flags, review, and tool allow settings outside bundle inspection.',
      'OpenCode is inspected through the generated plugin wrapper constants; this does not execute a live OpenCode host run.',
    ]))
  })
})
