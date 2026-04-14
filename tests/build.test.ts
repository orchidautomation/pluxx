import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { build } from '../src/generators'
import type { PluginConfig } from '../src/schema'

const TEST_DIR = resolve(import.meta.dir, '.fixture')
const OUT_DIR = resolve(TEST_DIR, 'dist')

const testConfig: PluginConfig = {
  name: 'test-plugin',
  version: '1.0.0',
  description: 'A test plugin',
  author: { name: 'Test Author' },
  license: 'MIT',
  skills: './skills/',
  brand: {
    displayName: 'Test Plugin',
    shortDescription: 'A test plugin for testing',
    category: 'Productivity',
    color: '#FF0000',
    defaultPrompts: ['Hello from test plugin'],
  },
  mcp: {
    'test-server': {
      url: 'https://test.example.com/mcp',
      transport: 'http',
      auth: {
        type: 'bearer',
        envVar: 'TEST_API_KEY',
        headerName: 'Authorization',
        headerTemplate: 'Bearer ${value}',
      },
    },
  },
  hooks: {
    sessionStart: [{
      command: '${PLUGIN_ROOT}/scripts/validate.sh',
    }],
    beforeSubmitPrompt: [{
      command: '${PLUGIN_ROOT}/scripts/check-prompt.sh',
    }],
  },
  commands: './commands/',
  agents: './agents/',
  scripts: './scripts/',
  assets: './assets/',
  instructions: './INSTRUCTIONS.md',
  platforms: {
    cursor: {
      rules: [{
        description: 'Megamind operating conventions',
        alwaysApply: true,
        globs: ['**/*.ts', '**/*.tsx'],
        content: 'Always verify account context before responding.',
      }],
    },
  },
  targets: [
    'claude-code',
    'cursor',
    'codex',
    'opencode',
    'github-copilot',
    'openhands',
    'warp',
    'gemini-cli',
    'roo-code',
    'cline',
    'amp',
  ],
  outDir: './dist',
}

beforeAll(async () => {
  mkdirSync(resolve(TEST_DIR, 'skills/hello/'), { recursive: true })
  await Bun.write(
    resolve(TEST_DIR, 'skills/hello/SKILL.md'),
    '---\nname: hello\ndescription: Say hello\n---\n\nSay hello to the user.\n',
  )
  mkdirSync(resolve(TEST_DIR, 'commands/'), { recursive: true })
  await Bun.write(resolve(TEST_DIR, 'commands/pulse.md'), '# Pulse\n')
  mkdirSync(resolve(TEST_DIR, 'agents/'), { recursive: true })
  await Bun.write(resolve(TEST_DIR, 'agents/escalation.md'), '# Escalation\n')
  mkdirSync(resolve(TEST_DIR, 'scripts/'), { recursive: true })
  await Bun.write(resolve(TEST_DIR, 'scripts/validate.sh'), '#!/usr/bin/env bash\n')
  await Bun.write(resolve(TEST_DIR, 'scripts/confirm-mutation.sh'), '#!/usr/bin/env bash\n')
  mkdirSync(resolve(TEST_DIR, 'assets/'), { recursive: true })
  await Bun.write(resolve(TEST_DIR, 'assets/icon.svg'), '<svg />\n')
  await Bun.write(resolve(TEST_DIR, 'INSTRUCTIONS.md'), 'Use test-plugin consistently.\n')
})

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

describe('build', () => {
  it('generates all platform outputs', async () => {
    await build(testConfig, TEST_DIR)

    // Claude Code
    expect(existsSync(resolve(OUT_DIR, 'claude-code/.claude-plugin/plugin.json'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'claude-code/.mcp.json'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'claude-code/hooks/hooks.json'))).toBe(true)

    // Cursor
    expect(existsSync(resolve(OUT_DIR, 'cursor/.cursor-plugin/plugin.json'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'cursor/mcp.json'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'cursor/hooks/hooks.json'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'cursor/rules/megamind-operating-conventions.mdc'))).toBe(true)

    // Codex
    expect(existsSync(resolve(OUT_DIR, 'codex/.codex-plugin/plugin.json'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'codex/.mcp.json'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'codex/hooks.json'))).toBe(false)

    // OpenCode
    expect(existsSync(resolve(OUT_DIR, 'opencode/package.json'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'opencode/index.ts'))).toBe(true)

    // GitHub Copilot
    expect(existsSync(resolve(OUT_DIR, 'github-copilot/.claude-plugin/plugin.json'))).toBe(true)

    // OpenHands should use .plugin/ (not .claude-plugin/)
    expect(existsSync(resolve(OUT_DIR, 'openhands/.plugin/plugin.json'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'openhands/.claude-plugin/plugin.json'))).toBe(false)

    // Warp
    expect(existsSync(resolve(OUT_DIR, 'warp/AGENTS.md'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'warp/mcp.json'))).toBe(true)

    // Gemini CLI
    expect(existsSync(resolve(OUT_DIR, 'gemini-cli/gemini-extension.json'))).toBe(true)

    // Roo Code
    expect(existsSync(resolve(OUT_DIR, 'roo-code/.roo/mcp.json'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'roo-code/.roorules'))).toBe(true)

    // Cline
    expect(existsSync(resolve(OUT_DIR, 'cline/.cline/mcp.json'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'cline/.clinerules'))).toBe(true)

    // AMP
    expect(existsSync(resolve(OUT_DIR, 'amp/AGENT.md'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'amp/.amp/settings.json'))).toBe(true)
  })

  it('generates correct Claude Code MCP config', async () => {
    const mcpJson = JSON.parse(
      readFileSync(resolve(OUT_DIR, 'claude-code/.mcp.json'), 'utf-8')
    )
    expect(mcpJson.mcpServers['test-server'].type).toBe('http')
    expect(mcpJson.mcpServers['test-server'].url).toBe('https://test.example.com/mcp')
    expect(mcpJson.mcpServers['test-server'].headers.Authorization).toContain('TEST_API_KEY')
  })

  it('generates correct Codex MCP config with bearer_token_env_var', async () => {
    const mcpJson = JSON.parse(
      readFileSync(resolve(OUT_DIR, 'codex/.mcp.json'), 'utf-8')
    )
    expect(mcpJson.mcpServers['test-server'].bearer_token_env_var).toBe('TEST_API_KEY')
    expect(mcpJson.mcpServers['test-server'].url).toBe('https://test.example.com/mcp')
  })

  it('generates correct Codex MCP config with env_http_headers for header auth', async () => {
    const headerAuthConfig: PluginConfig = {
      ...testConfig,
      name: 'header-auth-plugin',
      mcp: {
        'header-server': {
          url: 'https://header.example.com/mcp',
          transport: 'http',
          auth: {
            type: 'header',
            envVar: 'PLAYKIT_API_KEY',
            headerName: 'X-API-Key',
            headerTemplate: '${value}',
          },
        },
      },
      outDir: './header-dist',
    }

    await build(headerAuthConfig, TEST_DIR)

    const mcpJson = JSON.parse(
      readFileSync(resolve(TEST_DIR, 'header-dist/codex/.mcp.json'), 'utf-8')
    )
    expect(mcpJson.mcpServers['header-server'].url).toBe('https://header.example.com/mcp')
    expect(mcpJson.mcpServers['header-server'].env_http_headers).toEqual({
      'X-API-Key': 'PLAYKIT_API_KEY',
    })
    expect(mcpJson.mcpServers['header-server'].bearer_token_env_var).toBeUndefined()
  })

  it('omits inline auth headers for Claude Code and Cursor when runtime auth is platform-managed', async () => {
    const oauthishConfig: PluginConfig = {
      ...testConfig,
      name: 'oauthish-plugin',
      platforms: {
        ...testConfig.platforms,
        'claude-code': {
          mcpAuth: 'platform',
        },
        cursor: {
          ...testConfig.platforms?.cursor,
          mcpAuth: 'platform',
        },
      },
      hooks: {
        sessionStart: [{
          command: '${PLUGIN_ROOT}/scripts/check-env.sh',
        }],
        beforeSubmitPrompt: [{
          command: '${PLUGIN_ROOT}/scripts/check-prompt.sh',
        }],
      },
      outDir: './oauthish-dist',
    }

    await build(oauthishConfig, TEST_DIR)

    const claudeMcp = JSON.parse(
      readFileSync(resolve(TEST_DIR, 'oauthish-dist/claude-code/.mcp.json'), 'utf-8')
    )
    const cursorMcp = JSON.parse(
      readFileSync(resolve(TEST_DIR, 'oauthish-dist/cursor/mcp.json'), 'utf-8')
    )
    const claudeHooks = JSON.parse(
      readFileSync(resolve(TEST_DIR, 'oauthish-dist/claude-code/hooks/hooks.json'), 'utf-8')
    )
    const cursorHooks = JSON.parse(
      readFileSync(resolve(TEST_DIR, 'oauthish-dist/cursor/hooks/hooks.json'), 'utf-8')
    )

    expect(claudeMcp.mcpServers['test-server'].headers).toBeUndefined()
    expect(cursorMcp.mcpServers['test-server'].headers).toBeUndefined()
    expect(claudeHooks.hooks.SessionStart).toBeUndefined()
    expect(cursorHooks.hooks.sessionStart).toBeUndefined()
    expect(claudeHooks.hooks.UserPromptSubmit).toBeDefined()
    expect(cursorHooks.hooks.beforeSubmitPrompt).toBeDefined()
  })

  it('generates Codex manifest with interface metadata', async () => {
    const manifest = JSON.parse(
      readFileSync(resolve(OUT_DIR, 'codex/.codex-plugin/plugin.json'), 'utf-8')
    )
    expect(manifest.interface.displayName).toBe('Test Plugin')
    expect(manifest.interface.brandColor).toBe('#FF0000')
    expect(manifest.interface.defaultPrompt).toEqual(['Hello from test plugin'])
  })

  it('generates OpenCode plugin wrapper with env var check', async () => {
    const indexTs = readFileSync(resolve(OUT_DIR, 'opencode/index.ts'), 'utf-8')
    expect(indexTs).toContain('TestPluginPlugin')
    expect(indexTs).toContain('TEST_API_KEY')
  })

  it('writes documented hook outputs and omits undocumented Codex hook bundles', async () => {
    const claudeHooks = JSON.parse(
      readFileSync(resolve(OUT_DIR, 'claude-code/hooks/hooks.json'), 'utf-8')
    )

    expect(claudeHooks.hooks.UserPromptSubmit).toBeDefined()
    expect(existsSync(resolve(OUT_DIR, 'codex/hooks.json'))).toBe(false)
  })

  it('writes documented manifest paths for Claude Code, Cursor, and Codex plugin components', async () => {
    const claudeManifest = JSON.parse(
      readFileSync(resolve(OUT_DIR, 'claude-code/.claude-plugin/plugin.json'), 'utf-8')
    )
    const cursorManifest = JSON.parse(
      readFileSync(resolve(OUT_DIR, 'cursor/.cursor-plugin/plugin.json'), 'utf-8')
    )
    const codexManifest = JSON.parse(
      readFileSync(resolve(OUT_DIR, 'codex/.codex-plugin/plugin.json'), 'utf-8')
    )

    expect(claudeManifest.commands).toBe('./commands/')
    expect(claudeManifest.agents).toBe('./agents/')
    expect(claudeManifest.hooks).toBeUndefined()
    expect(claudeManifest.mcpServers).toBe('./.mcp.json')

    expect(cursorManifest.skills).toBe('./skills/')
    expect(cursorManifest.commands).toBe('./commands/')
    expect(cursorManifest.agents).toBe('./agents/')
    expect(cursorManifest.rules).toBe('./rules/')
    expect(cursorManifest.hooks).toBe('./hooks/hooks.json')
    expect(cursorManifest.mcpServers).toBe('./mcp.json')

    expect(codexManifest.skills).toBe('./skills/')
    expect(codexManifest.mcpServers).toBe('./.mcp.json')
    expect(codexManifest.hooks).toBeUndefined()
  })

  it('preserves Linear-style preToolUse matchers in Claude Code and Cursor outputs', async () => {
    const linearMatchers = [
      'mcp__linear-mcp__create_attachment',
      'mcp__linear-mcp__create_document',
      'mcp__linear-mcp__create_issue_label',
      'mcp__linear-mcp__delete_attachment',
      'mcp__linear-mcp__delete_comment',
      'mcp__linear-mcp__delete_status_update',
      'mcp__linear-mcp__extract_images',
    ] as const

    const matcherConfig: PluginConfig = {
      ...testConfig,
      name: 'linear-matcher-plugin',
      hooks: {
        preToolUse: linearMatchers.map(matcher => ({
          command: '${PLUGIN_ROOT}/scripts/confirm-mutation.sh',
          matcher,
        })),
      },
      targets: ['claude-code', 'cursor'],
      outDir: './matcher-dist',
    }

    await build(matcherConfig, TEST_DIR)

    const claudeHooks = JSON.parse(
      readFileSync(resolve(TEST_DIR, 'matcher-dist/claude-code/hooks/hooks.json'), 'utf-8')
    )
    const cursorHooks = JSON.parse(
      readFileSync(resolve(TEST_DIR, 'matcher-dist/cursor/hooks/hooks.json'), 'utf-8')
    )

    expect(claudeHooks.hooks.PreToolUse).toHaveLength(linearMatchers.length)
    expect(
      claudeHooks.hooks.PreToolUse.map((group: { matcher?: string }) => group.matcher)
    ).toEqual([...linearMatchers])
    expect(
      claudeHooks.hooks.PreToolUse.every((group: { hooks: Array<{ command: string }> }) =>
        group.hooks[0]?.command.includes('${CLAUDE_PLUGIN_ROOT}/scripts/confirm-mutation.sh')
      )
    ).toBe(true)

    expect(cursorHooks.hooks.preToolUse).toHaveLength(linearMatchers.length)
    expect(
      cursorHooks.hooks.preToolUse.map((entry: { matcher?: string }) => entry.matcher)
    ).toEqual([...linearMatchers])
    expect(
      cursorHooks.hooks.preToolUse.every((entry: { command: string }) =>
        entry.command === './scripts/confirm-mutation.sh'
      )
    ).toBe(true)
  })

  it('copies skills to all targets', async () => {
    for (const platform of [
      'claude-code',
      'cursor',
      'codex',
      'opencode',
      'github-copilot',
      'openhands',
      'warp',
      'gemini-cli',
      'amp',
    ]) {
      expect(
        existsSync(resolve(OUT_DIR, platform, 'skills/hello/SKILL.md'))
      ).toBe(true)
    }

    // Roo Code and Cline use platform-specific skill dirs
    expect(existsSync(resolve(OUT_DIR, 'roo-code/.roo/skills/hello/SKILL.md'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'cline/.cline/skills/hello/SKILL.md'))).toBe(true)
  })

  it('copies commands and agents to Cursor plugin roots', async () => {
    expect(existsSync(resolve(OUT_DIR, 'cursor/commands/pulse.md'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'cursor/agents/escalation.md'))).toBe(true)
  })

  it('writes Cursor rules to rules/', async () => {
    const rulePath = resolve(OUT_DIR, 'cursor/rules/megamind-operating-conventions.mdc')
    expect(existsSync(rulePath)).toBe(true)

    const content = readFileSync(rulePath, 'utf-8')
    expect(content).toContain('globs: ["**/*.ts","**/*.tsx"]')
  })

  it('guards against path traversal outDir values', async () => {
    const unsafeConfig: PluginConfig = {
      ...testConfig,
      outDir: '..',
    }

    await expect(build(unsafeConfig, TEST_DIR)).rejects.toThrow(
      'resolves outside the project root'
    )
  })

  it('guards against path traversal for configured content paths', async () => {
    const guardedPathKeys = [
      'skills',
      'commands',
      'agents',
      'scripts',
      'assets',
      'instructions',
    ] as const

    for (const key of guardedPathKeys) {
      const unsafeConfig: PluginConfig = {
        ...testConfig,
        [key]: '../outside',
      }

      await expect(build(unsafeConfig, TEST_DIR)).rejects.toThrow(
        `${key} path "../outside" resolves outside the project root`
      )
    }
  })
})
