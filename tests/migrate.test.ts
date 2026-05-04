import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { migrate } from '../src/cli/migrate'
import { planAgentPrepare } from '../src/cli/agent'
import { runEvalSuite } from '../src/cli/eval'
import { loadConfig } from '../src/config/load'
import { build } from '../src/generators'

const TEST_DIR = resolve(import.meta.dir, '.migrate-fixture')

function writeJson(path: string, data: unknown) {
  return Bun.write(path, JSON.stringify(data, null, 2) + '\n')
}

async function setupMegamindSource(platform: 'claude' | 'cursor' | 'codex' | 'opencode') {
  const sourceDir = resolve(TEST_DIR, `source-${platform}`)
  mkdirSync(sourceDir, { recursive: true })

  const manifest = {
    name: 'megamind',
    version: '1.0.3',
    description: 'Client intelligence tools powered by Megamind.',
    author: {
      name: 'The Kiln',
      url: 'https://thekiln.com',
    },
    repository: 'https://github.com/The-Kiln-Dev/projectmegamind',
    license: 'MIT',
    keywords: ['client-intelligence', 'slack'],
  }

  if (platform === 'claude') {
    mkdirSync(resolve(sourceDir, '.claude-plugin'), { recursive: true })
    await writeJson(resolve(sourceDir, '.claude-plugin/plugin.json'), manifest)
  }
  if (platform === 'cursor') {
    mkdirSync(resolve(sourceDir, '.cursor-plugin'), { recursive: true })
    await writeJson(resolve(sourceDir, '.cursor-plugin/plugin.json'), manifest)
  }
  if (platform === 'codex') {
    mkdirSync(resolve(sourceDir, '.codex-plugin'), { recursive: true })
    await writeJson(resolve(sourceDir, '.codex-plugin/plugin.json'), manifest)
  }
  if (platform === 'opencode') {
    await writeJson(resolve(sourceDir, 'package.json'), {
      ...manifest,
      type: 'module',
      dependencies: {
        '@opencode-ai/plugin': '^0.0.1',
      },
    })
  }

  await writeJson(resolve(sourceDir, '.mcp.json'), {
    mcpServers: {
      megamind: {
        url: 'https://megamind.up.railway.app/mcp',
        headers: {
          Authorization: 'Bearer ${MEGAMIND_API_KEY}',
        },
      },
    },
  })

  const hooksPath = platform === 'codex'
    ? resolve(sourceDir, '.codex/hooks.json')
    : resolve(sourceDir, 'hooks.json')

  if (platform === 'codex') {
    mkdirSync(resolve(sourceDir, '.codex'), { recursive: true })
  }

  await writeJson(hooksPath, {
    hooks: {
      SessionStart: [
        {
          hooks: [
            {
              type: 'command',
              command: '${PLUGIN_ROOT}/scripts/validate-env.sh',
            },
          ],
        },
      ],
    },
  })

  mkdirSync(resolve(sourceDir, 'skills/client-intel'), { recursive: true })
  await Bun.write(resolve(sourceDir, 'skills/client-intel/SKILL.md'), '# Client Intel\n')
  mkdirSync(resolve(sourceDir, 'commands'), { recursive: true })
  await Bun.write(resolve(sourceDir, 'commands/pulse.md'), '# pulse\n')
  mkdirSync(resolve(sourceDir, 'agents'), { recursive: true })
  await Bun.write(resolve(sourceDir, 'agents/megamind.md'), '# agent\n')
  mkdirSync(resolve(sourceDir, 'scripts'), { recursive: true })
  await Bun.write(resolve(sourceDir, 'scripts/validate-env.sh'), '#!/usr/bin/env bash\n')
  await Bun.write(resolve(sourceDir, 'INSTRUCTIONS.md'), 'Megamind operating instructions\n')

  return sourceDir
}

async function setupCodexHeaderSource() {
  const sourceDir = resolve(TEST_DIR, 'source-codex-header')
  mkdirSync(resolve(sourceDir, '.codex-plugin'), { recursive: true })

  await writeJson(resolve(sourceDir, '.codex-plugin/plugin.json'), {
    name: 'playkit',
    version: '0.1.0',
    description: 'PlayKit for Codex.',
    author: { name: 'Orchid' },
  })

  await writeJson(resolve(sourceDir, '.mcp.json'), {
    mcpServers: {
      playkit: {
        url: 'https://mcp.playkit.sh/mcp',
        env_http_headers: {
          'X-API-Key': 'PLAYKIT_API_KEY',
        },
      },
    },
  })

  mkdirSync(resolve(sourceDir, 'skills/playkit'), { recursive: true })
  await Bun.write(resolve(sourceDir, 'skills/playkit/SKILL.md'), '# PlayKit\n')

  return sourceDir
}

async function setupRichHookSource() {
  const sourceDir = resolve(TEST_DIR, 'source-rich-hooks')
  mkdirSync(resolve(sourceDir, '.claude-plugin'), { recursive: true })
  mkdirSync(resolve(sourceDir, 'skills/research'), { recursive: true })

  await writeJson(resolve(sourceDir, '.claude-plugin/plugin.json'), {
    name: 'rich-hooks',
    version: '0.1.0',
    description: 'Hook-rich migrate fixture.',
    author: { name: 'Orchid' },
  })

  await writeJson(resolve(sourceDir, 'hooks.json'), {
    hooks: {
      UserPromptSubmit: [
        {
          matcher: 'Write',
          hooks: [
            {
              type: 'prompt',
              prompt: 'Confirm before submit.',
              model: 'claude-sonnet-4',
            },
          ],
        },
      ],
      PreToolUse: [
        {
          command: './scripts/pretool.sh',
          timeout: 15,
          matcher: {
            tool: 'Write',
          },
          failClosed: true,
          loop_limit: 2,
        },
      ],
      Stop: [
        {
          hooks: [
            {
              type: 'command',
              command: './scripts/stop.sh',
              async: true,
              asyncRewake: true,
              shell: 'bash',
            },
          ],
        },
      ],
      Notification: [
        {
          hooks: [
            {
              type: 'http',
              url: 'https://example.com/hook',
              headers: {
                'X-Test': '1',
              },
              allowedEnvVars: ['TEST_TOKEN'],
            },
          ],
        },
      ],
      TaskCompleted: [
        {
          hooks: [
            {
              type: 'mcp_tool',
              server: 'linear',
              tool: 'create_issue',
              input: {
                title: 'done',
              },
            },
          ],
        },
      ],
    },
  })

  await Bun.write(
    resolve(sourceDir, 'skills/research/SKILL.md'),
    ['---', 'name: research', 'description: "Research skill."', '---', '', '# Research'].join('\n'),
  )

  return sourceDir
}

async function setupClaudeReadmeSource() {
  const sourceDir = resolve(TEST_DIR, 'source-claude-readme')
  mkdirSync(resolve(sourceDir, '.claude-plugin'), { recursive: true })

  await writeJson(resolve(sourceDir, '.claude-plugin/plugin.json'), {
    name: 'leadkit-outbound',
    version: '1.0.0',
    description: 'Cold outbound from your terminal.',
    author: { name: 'LeadKit' },
    license: 'MIT',
  })

  await writeJson(resolve(sourceDir, '.mcp.json'), {
    mcpServers: {
      leadkit: {
        command: 'node',
        args: ['${CLAUDE_PLUGIN_ROOT}/mcp-server/dist/index.js'],
        env: {
          LEADKIT_API_KEY: '${LEADKIT_API_KEY}',
        },
      },
    },
  })

  mkdirSync(resolve(sourceDir, 'skills/prospect-research'), { recursive: true })
  await Bun.write(
    resolve(sourceDir, 'skills/prospect-research/SKILL.md'),
    [
      '---',
      'name: prospect-research',
      'description: Research a prospect.',
      'when_to_use: "Use when outbound needs account context."',
      'argument-hint: "[company]"',
      'arguments: [company]',
      'user-invocable: true',
      'allowed-tools: mcp__leadkit__get_lead, Read',
      'context: fork',
      'agent: Explore',
      'paths: ["accounts/**"]',
      'shell: bash',
      '---',
      '',
      '# Prospect Research',
      '',
    ].join('\n'),
  )
  mkdirSync(resolve(sourceDir, 'mcp-server/dist'), { recursive: true })
  await Bun.write(resolve(sourceDir, 'mcp-server/dist/index.js'), 'console.log("leadkit")\n')
  await Bun.write(resolve(sourceDir, 'README.md'), '# LeadKit\n\nMigrated from README instructions.\n')

  return sourceDir
}

async function setupCursorNativeAgentSource() {
  const sourceDir = resolve(TEST_DIR, 'source-cursor-native-agents')
  mkdirSync(resolve(sourceDir, '.cursor-plugin'), { recursive: true })
  mkdirSync(resolve(sourceDir, '.cursor/agents'), { recursive: true })
  mkdirSync(resolve(sourceDir, 'skills/inbox-triage'), { recursive: true })

  await writeJson(resolve(sourceDir, '.cursor-plugin/plugin.json'), {
    name: 'cursor-native-agents',
    version: '0.2.0',
    description: 'Cursor-native agent fixture.',
    author: { name: 'Orchid' },
  })

  await writeJson(resolve(sourceDir, '.mcp.json'), {
    mcpServers: {
      fixture: {
        url: 'https://example.com/mcp',
      },
    },
  })

  await Bun.write(
    resolve(sourceDir, 'skills/inbox-triage/SKILL.md'),
    ['---', 'name: inbox-triage', 'description: "Review inbox work."', '---', '', '# Inbox Triage'].join('\n'),
  )
  await Bun.write(
    resolve(sourceDir, '.cursor/agents/research.md'),
    ['---', 'name: research', 'description: "Specialist researcher."', '---', '', '# Research'].join('\n'),
  )

  return sourceDir
}

async function setupCodexNativeAgentSource() {
  const sourceDir = resolve(TEST_DIR, 'source-codex-native-agents')
  mkdirSync(resolve(sourceDir, '.codex-plugin'), { recursive: true })
  mkdirSync(resolve(sourceDir, '.codex/agents'), { recursive: true })
  mkdirSync(resolve(sourceDir, 'skills/account-brief'), { recursive: true })

  await writeJson(resolve(sourceDir, '.codex-plugin/plugin.json'), {
    name: 'codex-native-agents',
    version: '0.3.0',
    description: 'Codex-native custom agent fixture.',
    author: { name: 'Orchid' },
  })

  await writeJson(resolve(sourceDir, '.mcp.json'), {
    mcpServers: {
      fixture: {
        url: 'https://example.com/mcp',
      },
    },
  })

  await Bun.write(
    resolve(sourceDir, 'skills/account-brief/SKILL.md'),
    ['---', 'name: account-brief', 'description: "Summarize an account."', '---', '', '# Account Brief'].join('\n'),
  )
  await Bun.write(
    resolve(sourceDir, '.codex/agents/specialist.toml'),
    [
      'name = "Sales Research"',
      'description = "Handle complex: research tasks."',
      'model = "gpt-5.4"',
      'model_reasoning_effort = "high"',
      'sandbox_mode = "workspace-write"',
      'developer_instructions = """',
      'Use the MCP for account intelligence.',
      'Return only the synthesized result.',
      '"""',
      '',
    ].join('\n'),
  )

  return sourceDir
}

async function setupOpenCodeNativeCommandSource() {
  const sourceDir = resolve(TEST_DIR, 'source-opencode-native-commands')
  mkdirSync(resolve(sourceDir, '.opencode/commands'), { recursive: true })
  mkdirSync(resolve(sourceDir, 'skills/pipeline-review'), { recursive: true })

  await writeJson(resolve(sourceDir, 'package.json'), {
    name: 'opencode-native-commands',
    version: '0.4.0',
    description: 'OpenCode-native command fixture.',
    author: { name: 'Orchid' },
    type: 'module',
    dependencies: {
      '@opencode-ai/plugin': '^0.0.1',
    },
  })

  await writeJson(resolve(sourceDir, '.mcp.json'), {
    mcpServers: {
      fixture: {
        url: 'https://example.com/mcp',
      },
    },
  })

  await Bun.write(
    resolve(sourceDir, 'skills/pipeline-review/SKILL.md'),
    ['---', 'name: pipeline-review', 'description: "Review pipeline health."', '---', '', '# Pipeline Review'].join('\n'),
  )
  await Bun.write(
    resolve(sourceDir, '.opencode/commands/research.md'),
    ['---', 'description: "OpenCode-native command."', '---', '', '# Research'].join('\n'),
  )

  return sourceDir
}

async function setupOpenCodeNativeAgentSource() {
  const sourceDir = resolve(TEST_DIR, 'source-opencode-native-agents')
  mkdirSync(resolve(sourceDir, '.opencode/agents'), { recursive: true })
  mkdirSync(resolve(sourceDir, 'skills/opportunity-review'), { recursive: true })

  await writeJson(resolve(sourceDir, 'package.json'), {
    name: 'opencode-native-agents',
    version: '0.5.0',
    description: 'OpenCode-native agent fixture.',
    author: { name: 'Orchid' },
    type: 'module',
    dependencies: {
      '@opencode-ai/plugin': '^0.0.1',
    },
  })

  await writeJson(resolve(sourceDir, '.mcp.json'), {
    mcpServers: {
      fixture: {
        url: 'https://example.com/mcp',
      },
    },
  })

  await Bun.write(
    resolve(sourceDir, 'skills/opportunity-review/SKILL.md'),
    ['---', 'name: opportunity-review', 'description: "Review an opportunity."', '---', '', '# Opportunity Review'].join('\n'),
  )
  await Bun.write(
    resolve(sourceDir, '.opencode/agents/review.md'),
    [
      '---',
      'mode: subagent',
      'hidden: true',
      'permission:',
      '  edit: deny',
      '  bash:',
      '    "*": ask',
      '    "git diff": allow',
      '  task:',
      '    "*": deny',
      '    "review-*": allow',
      '---',
      '',
      '# Review Specialist',
      '',
      'Only analyze code and suggest changes.',
      '',
    ].join('\n'),
  )

  return sourceDir
}

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(TEST_DIR, { recursive: true })
})

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

async function runMigrate(sourceDir: string, outputDir: string): Promise<void> {
  mkdirSync(outputDir, { recursive: true })

  const previousCwd = process.cwd()
  process.chdir(outputDir)
  try {
    await migrate(sourceDir)
  } finally {
    process.chdir(previousCwd)
  }
}

describe('migrate', () => {
  for (const platform of ['claude', 'cursor', 'codex', 'opencode'] as const) {
    it(`migrates Megamind ${platform} example into pluxx config`, async () => {
      const sourceDir = await setupMegamindSource(platform)
      const outputDir = resolve(TEST_DIR, `out-${platform}`)
      mkdirSync(outputDir, { recursive: true })

      const previousCwd = process.cwd()
      process.chdir(outputDir)
      try {
        await migrate(sourceDir)
      } finally {
        process.chdir(previousCwd)
      }

      const configPath = resolve(outputDir, 'pluxx.config.ts')
      expect(existsSync(configPath)).toBe(true)

      const config = readFileSync(configPath, 'utf-8')
      expect(config).toContain("name: 'megamind'")
      expect(config).toContain("version: '1.0.3'")
      expect(config).toContain("envVar: 'MEGAMIND_API_KEY'")
      expect(config).toContain("targets: ['claude-code', 'cursor', 'codex', 'opencode']")

      expect(existsSync(resolve(outputDir, 'skills/client-intel/SKILL.md'))).toBe(true)
      expect(existsSync(resolve(outputDir, 'commands/pulse.md'))).toBe(true)
      expect(existsSync(resolve(outputDir, 'agents/megamind.md'))).toBe(true)
      expect(existsSync(resolve(outputDir, 'scripts/validate-env.sh'))).toBe(true)
      expect(existsSync(resolve(outputDir, 'INSTRUCTIONS.md'))).toBe(true)
      expect(existsSync(resolve(outputDir, '.pluxx/taxonomy.json'))).toBe(true)
      expect(existsSync(resolve(outputDir, '.pluxx/mcp.json'))).toBe(true)

      const taxonomy = JSON.parse(readFileSync(resolve(outputDir, '.pluxx/taxonomy.json'), 'utf-8')) as Array<{ dirName: string }>
      const metadata = JSON.parse(readFileSync(resolve(outputDir, '.pluxx/mcp.json'), 'utf-8')) as {
        skills: Array<{ dirName: string }>
        source: { transport: string }
      }

      expect(taxonomy.map((skill) => skill.dirName)).toEqual(['client-intel'])
      expect(metadata.skills.map((skill) => skill.dirName)).toEqual(['client-intel'])
      expect(metadata.source.transport).toBe('http')

      const preparePlan = await planAgentPrepare(outputDir)
      expect(preparePlan.skillCount).toBe(1)

      const evalReport = await runEvalSuite({ rootDir: outputDir })
      expect(evalReport.ok).toBe(true)

      const migratedConfig = await loadConfig(outputDir)
      await build(migratedConfig, outputDir)
      expect(existsSync(resolve(outputDir, 'dist/claude-code'))).toBe(true)
      expect(existsSync(resolve(outputDir, 'dist/cursor'))).toBe(true)
      expect(existsSync(resolve(outputDir, 'dist/codex'))).toBe(true)
      expect(existsSync(resolve(outputDir, 'dist/opencode'))).toBe(true)
    })
  }

  it('migrates Codex env_http_headers auth into pluxx header auth config', async () => {
    const sourceDir = await setupCodexHeaderSource()
    const outputDir = resolve(TEST_DIR, 'out-codex-header')
    mkdirSync(outputDir, { recursive: true })

    const previousCwd = process.cwd()
    process.chdir(outputDir)
    try {
      await migrate(sourceDir)
    } finally {
      process.chdir(previousCwd)
    }

    const config = readFileSync(resolve(outputDir, 'pluxx.config.ts'), 'utf-8')
    expect(config).toContain("name: 'playkit'")
    expect(config).toContain("type: 'header'")
    expect(config).toContain("envVar: 'PLAYKIT_API_KEY'")
    expect(config).toContain("headerName: 'X-API-Key'")
    expect(config).toContain("headerTemplate: '${value}'")
  })

  it('preserves richer hook entries during migrate instead of collapsing them to command-only hooks', async () => {
    const sourceDir = await setupRichHookSource()
    const outputDir = resolve(TEST_DIR, 'out-rich-hooks')
    mkdirSync(outputDir, { recursive: true })

    const previousCwd = process.cwd()
    process.chdir(outputDir)
    try {
      await migrate(sourceDir)
    } finally {
      process.chdir(previousCwd)
    }

    const config = readFileSync(resolve(outputDir, 'pluxx.config.ts'), 'utf-8')
    expect(config).toContain('beforeSubmitPrompt: [')
    expect(config).toContain("type: 'prompt'")
    expect(config).toContain("prompt: 'Confirm before submit.'")
    expect(config).toContain("model: 'claude-sonnet-4'")
    expect(config).toContain("matcher: 'Write'")
    expect(config).toContain('preToolUse: [')
    expect(config).toContain("command: './scripts/pretool.sh'")
    expect(config).toContain('matcher: {"tool":"Write"}')
    expect(config).toContain('failClosed: true')
    expect(config).toContain('loop_limit: 2')
    expect(config).toContain('stop: [')
    expect(config).toContain('async: true')
    expect(config).toContain('asyncRewake: true')
    expect(config).toContain("shell: 'bash'")
    expect(config).toContain("type: 'http'")
    expect(config).toContain("url: 'https://example.com/hook'")
    expect(config).toContain('headers: {"X-Test":"1"}')
    expect(config).toContain('allowedEnvVars: ["TEST_TOKEN"]')
    expect(config).toContain("type: 'mcp_tool'")
    expect(config).toContain("server: 'linear'")
    expect(config).toContain("tool: 'create_issue'")
    expect(config).toContain('input: {"title":"done"}')

    const migratedConfig = await loadConfig(outputDir)
    expect(migratedConfig.hooks?.beforeSubmitPrompt?.[0]?.type).toBe('prompt')
    expect(migratedConfig.hooks?.preToolUse?.[0]?.failClosed).toBe(true)
    expect(migratedConfig.hooks?.['Notification']?.[0]?.type).toBe('http')
    expect(migratedConfig.hooks?.['TaskCompleted']?.[0]?.type).toBe('mcp_tool')
  })

  it('copies README instructions when README.md is the detected instructions file', async () => {
    const sourceDir = await setupClaudeReadmeSource()
    const outputDir = resolve(TEST_DIR, 'out-claude-readme')
    mkdirSync(outputDir, { recursive: true })

    const previousCwd = process.cwd()
    process.chdir(outputDir)
    try {
      await migrate(sourceDir)
    } finally {
      process.chdir(previousCwd)
    }

    const config = readFileSync(resolve(outputDir, 'pluxx.config.ts'), 'utf-8')
    expect(config).toContain("instructions: './README.md'")
    expect(config).toContain("passthrough: ['./mcp-server/']")
    expect(config).toContain('// Inferred from Claude-style allowed-tools frontmatter.')
    expect(config).toContain('// Preserved skill-scoped tool access in .pluxx/compiler-intent.json and flattened it into plugin-level canonical permissions as a fallback.')
    expect(config).toContain('// Preserved richer Claude skill frontmatter in .pluxx/compiler-intent.json so migrate does not collapse author intent back into opaque markdown.')
    expect(config).toContain("permissions: {")
    expect(config).toContain("allow: ['MCP(leadkit.get_lead)', 'Read(*)']")
    expect(existsSync(resolve(outputDir, 'README.md'))).toBe(true)
    expect(existsSync(resolve(outputDir, 'mcp-server/dist/index.js'))).toBe(true)
    expect(existsSync(resolve(outputDir, '.pluxx/compiler-intent.json'))).toBe(true)
    expect(readFileSync(resolve(outputDir, 'README.md'), 'utf-8')).toContain('Migrated from README instructions.')
    const compilerIntent = JSON.parse(
      readFileSync(resolve(outputDir, '.pluxx/compiler-intent.json'), 'utf-8')
    ) as {
      skillPolicies: Array<{
        skillDir: string
        title: string
        sourceFrontmatter?: Record<string, unknown>
        permissions: { allow?: string[] }
      }>
    }
    expect(compilerIntent.skillPolicies).toHaveLength(1)
    expect(compilerIntent.skillPolicies[0]?.skillDir).toBe('prospect-research')
    expect(compilerIntent.skillPolicies[0]?.title).toBe('Prospect Research')
    expect(compilerIntent.skillPolicies[0]?.sourceFrontmatter).toMatchObject({
      when_to_use: 'Use when outbound needs account context.',
      'argument-hint': '[company]',
      arguments: ['company'],
      'user-invocable': true,
      context: 'fork',
      agent: 'Explore',
      paths: ['accounts/**'],
      shell: 'bash',
    })
    expect(compilerIntent.skillPolicies[0]?.permissions.allow).toEqual(['MCP(leadkit.get_lead)', 'Read(*)'])
    const migratedSkill = readFileSync(resolve(outputDir, 'skills/prospect-research/SKILL.md'), 'utf-8')
    expect(migratedSkill).not.toContain('allowed-tools:')
  })

  it('imports Cursor native agents into the canonical agents directory', async () => {
    const sourceDir = await setupCursorNativeAgentSource()
    const outputDir = resolve(TEST_DIR, 'out-cursor-native-agents')
    mkdirSync(outputDir, { recursive: true })

    const previousCwd = process.cwd()
    process.chdir(outputDir)
    try {
      await migrate(sourceDir)
    } finally {
      process.chdir(previousCwd)
    }

    const config = readFileSync(resolve(outputDir, 'pluxx.config.ts'), 'utf-8')
    expect(config).toContain("agents: './agents/'")
    expect(existsSync(resolve(outputDir, 'agents/research.md'))).toBe(true)
    expect(readFileSync(resolve(outputDir, 'agents/research.md'), 'utf-8')).toContain('Specialist researcher.')
  })

  it('converts Codex native TOML agents into canonical markdown agents', async () => {
    const sourceDir = await setupCodexNativeAgentSource()
    const outputDir = resolve(TEST_DIR, 'out-codex-native-agents')
    mkdirSync(outputDir, { recursive: true })

    const previousCwd = process.cwd()
    process.chdir(outputDir)
    try {
      await migrate(sourceDir)
    } finally {
      process.chdir(previousCwd)
    }

    const config = readFileSync(resolve(outputDir, 'pluxx.config.ts'), 'utf-8')
    expect(config).toContain("agents: './agents/'")
    const migratedAgent = readFileSync(resolve(outputDir, 'agents/sales-research.md'), 'utf-8')
    expect(migratedAgent).toContain('name: "sales-research"')
    expect(migratedAgent).toContain('description: "Handle complex: research tasks."')
    expect(migratedAgent).toContain('model: "gpt-5.4"')
    expect(migratedAgent).toContain('model_reasoning_effort: "high"')
    expect(migratedAgent).toContain('sandbox_mode: "workspace-write"')
    expect(migratedAgent).toContain('Use the MCP for account intelligence.')
  })

  it('imports OpenCode native commands into the canonical commands directory', async () => {
    const sourceDir = await setupOpenCodeNativeCommandSource()
    const outputDir = resolve(TEST_DIR, 'out-opencode-native-commands')
    mkdirSync(outputDir, { recursive: true })

    const previousCwd = process.cwd()
    process.chdir(outputDir)
    try {
      await migrate(sourceDir)
    } finally {
      process.chdir(previousCwd)
    }

    const config = readFileSync(resolve(outputDir, 'pluxx.config.ts'), 'utf-8')
    expect(config).toContain("commands: './commands/'")
    expect(existsSync(resolve(outputDir, 'commands/research.md'))).toBe(true)
    expect(readFileSync(resolve(outputDir, 'commands/research.md'), 'utf-8')).toContain('OpenCode-native command.')
  })

  it('normalizes OpenCode native agents into canonical markdown while preserving agent permissions', async () => {
    const sourceDir = await setupOpenCodeNativeAgentSource()
    const outputDir = resolve(TEST_DIR, 'out-opencode-native-agents')
    await runMigrate(sourceDir, outputDir)

    const config = readFileSync(resolve(outputDir, 'pluxx.config.ts'), 'utf-8')
    expect(config).toContain("agents: './agents/'")

    const migratedAgent = readFileSync(resolve(outputDir, 'agents/review.md'), 'utf-8')
    expect(migratedAgent).toContain('name: "review"')
    expect(migratedAgent).toContain('description: "Review Specialist"')
    expect(migratedAgent).toContain('mode: subagent')
    expect(migratedAgent).toContain('hidden: true')
    expect(migratedAgent).toContain('permission:')
    expect(migratedAgent).toContain('edit: deny')
    expect(migratedAgent).toContain('"git diff": allow')
    expect(migratedAgent).toContain('"review-*": allow')
  })

  it('rebuilds a migrated Codex-native specialist into truthful native agent surfaces across the core four', async () => {
    const sourceDir = await setupCodexNativeAgentSource()
    const outputDir = resolve(TEST_DIR, 'out-codex-native-agent-proof')
    await runMigrate(sourceDir, outputDir)

    const migratedAgent = readFileSync(resolve(outputDir, 'agents/sales-research.md'), 'utf-8')
    expect(migratedAgent).toContain('name: "sales-research"')
    expect(migratedAgent).toContain('description: "Handle complex: research tasks."')
    expect(migratedAgent).not.toContain('name = "Sales Research"')
    expect(migratedAgent).not.toContain('developer_instructions = """')

    const migratedConfig = await loadConfig(outputDir)
    await build(migratedConfig, outputDir)

    const claudeManifest = JSON.parse(
      readFileSync(resolve(outputDir, 'dist/claude-code/.claude-plugin/plugin.json'), 'utf-8')
    )
    const cursorAgent = readFileSync(resolve(outputDir, 'dist/cursor/agents/sales-research.md'), 'utf-8')
    const codexAgent = readFileSync(resolve(outputDir, 'dist/codex/.codex/agents/sales-research.toml'), 'utf-8')
    const opencodeIndex = readFileSync(resolve(outputDir, 'dist/opencode/index.ts'), 'utf-8')

    expect(claudeManifest.agents).toEqual([
      './agents/sales-research.md',
    ])
    expect(cursorAgent).toContain('name: "sales-research"')
    expect(cursorAgent).toContain('description: "Handle complex: research tasks."')
    expect(cursorAgent).toContain('Use the MCP for account intelligence.')
    expect(codexAgent).toContain('name = "sales-research"')
    expect(codexAgent).toContain('model = "gpt-5.4"')
    expect(codexAgent).toContain('model_reasoning_effort = "high"')
    expect(codexAgent).toContain('sandbox_mode = "workspace-write"')
    expect(codexAgent).toContain('Use the MCP for account intelligence.')
    expect(opencodeIndex).toContain('"sales-research"')
    expect(opencodeIndex).toContain('"description": "Handle complex: research tasks."')
    expect(opencodeIndex).toContain('Use the MCP for account intelligence.')
  })

  it('normalizes OpenCode-native permission syntax into canonical agent intent before rebuilding', async () => {
    const sourceDir = await setupOpenCodeNativeAgentSource()
    const outputDir = resolve(TEST_DIR, 'out-opencode-native-agent-proof')
    await runMigrate(sourceDir, outputDir)

    const migratedAgent = readFileSync(resolve(outputDir, 'agents/review.md'), 'utf-8')
    expect(migratedAgent).toContain('permission:')
    expect(migratedAgent).toContain('edit: deny')
    expect(migratedAgent).toContain('"git diff": allow')
    expect(migratedAgent).toContain('"review-*": allow')

    const migratedConfig = await loadConfig(outputDir)
    await build(migratedConfig, outputDir)

    const cursorAgent = readFileSync(resolve(outputDir, 'dist/cursor/agents/review.md'), 'utf-8')
    const codexAgent = readFileSync(resolve(outputDir, 'dist/codex/.codex/agents/review.toml'), 'utf-8')
    const opencodeIndex = readFileSync(resolve(outputDir, 'dist/opencode/index.ts'), 'utf-8')

    expect(cursorAgent).toContain('Cursor translation note: stay read-only unless the parent task explicitly asks for file edits.')
    expect(cursorAgent).toContain('Cursor translation note: do not delegate further subtasks unless the parent task explicitly asks for additional specialist work.')
    expect(codexAgent).toContain('Delegation contract:')
    expect(codexAgent).toContain('Stay read-only unless the parent task explicitly asks for file edits.')
    expect(opencodeIndex).toContain('"review"')
    expect(opencodeIndex).toContain('"permission": {')
    expect(opencodeIndex).toContain('"edit": "deny"')
    expect(opencodeIndex).toContain('"git diff": "allow"')
    expect(opencodeIndex).toContain('"review-*": "allow"')
  })
})
