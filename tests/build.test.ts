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
    icon: './assets/icon.svg',
    screenshots: ['./assets/screenshots/overview.svg'],
    defaultPrompts: ['Hello from test plugin'],
    websiteURL: 'https://example.com',
    privacyPolicyURL: 'https://example.com/privacy',
    termsOfServiceURL: 'https://example.com/terms',
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
  passthrough: ['./mcp-server/'],
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
  mkdirSync(resolve(TEST_DIR, 'skills/deep-research/examples'), { recursive: true })
  mkdirSync(resolve(TEST_DIR, 'skills/deep-research/scripts'), { recursive: true })
  await Bun.write(
    resolve(TEST_DIR, 'skills/deep-research/SKILL.md'),
    [
      '---',
      'name: deep-research',
      'description: "Run a deep research pass with strong routing guidance."',
      'when_to_use: "Use when the user wants a thorough investigation with sourced evidence."',
      'argument-hint: "[company] [region]"',
      'arguments: [company, region]',
      'disable-model-invocation: true',
      'user-invocable: true',
      'allowed-tools: Read Grep Bash(git status *)',
      'model: inherit',
      'effort: high',
      'context: fork',
      'agent: Explore',
      'hooks: {"sessionStart":[{"type":"command","command":"bash ${CLAUDE_SKILL_DIR}/scripts/assist.sh"}]}',
      'paths: ["src/**","docs/**"]',
      'shell: bash',
      '---',
      '',
      '# Deep Research',
      '',
      'Use this skill when the request needs a sourced, specialist investigation.',
      '',
      '## Extra context',
      '',
      '- Load [reference.md](reference.md) before you summarize.',
      '- Use [examples/sample.md](examples/sample.md) to match the expected output shape.',
      '- Run `${CLAUDE_SKILL_DIR}/scripts/assist.sh` if you need a helper command.',
      '',
    ].join('\n'),
  )
  await Bun.write(
    resolve(TEST_DIR, 'skills/deep-research/reference.md'),
    '# Research Reference\n\nPrefer concrete evidence over vague summaries.\n',
  )
  await Bun.write(
    resolve(TEST_DIR, 'skills/deep-research/examples/sample.md'),
    '# Sample Output\n\n- Problem\n- Evidence\n- Recommendation\n',
  )
  await Bun.write(
    resolve(TEST_DIR, 'skills/deep-research/scripts/assist.sh'),
    '#!/usr/bin/env bash\necho deep-research-helper\n',
  )
  mkdirSync(resolve(TEST_DIR, 'commands/'), { recursive: true })
  await Bun.write(resolve(TEST_DIR, 'commands/pulse.md'), '# Pulse\n')
  mkdirSync(resolve(TEST_DIR, 'agents/'), { recursive: true })
  await Bun.write(
    resolve(TEST_DIR, 'agents/escalation.md'),
    [
      '---',
      'name: escalation',
      'description: "Escalation specialist."',
      'mode: subagent',
      'hidden: true',
      'permission:',
      '  edit: deny',
      '  task:',
      '    "*": ask',
      '---',
      '',
      '# Escalation',
      '',
      'Escalate tricky issues with a constrained tool policy.',
      '',
    ].join('\n'),
  )
  mkdirSync(resolve(TEST_DIR, 'scripts/'), { recursive: true })
  await Bun.write(resolve(TEST_DIR, 'scripts/validate.sh'), '#!/usr/bin/env bash\n')
  await Bun.write(resolve(TEST_DIR, 'scripts/confirm-mutation.sh'), '#!/usr/bin/env bash\n')
  mkdirSync(resolve(TEST_DIR, 'assets/'), { recursive: true })
  await Bun.write(resolve(TEST_DIR, 'assets/icon.svg'), '<svg />\n')
  mkdirSync(resolve(TEST_DIR, 'assets/screenshots'), { recursive: true })
  await Bun.write(resolve(TEST_DIR, 'assets/screenshots/overview.svg'), '<svg />\n')
  mkdirSync(resolve(TEST_DIR, 'mcp-server/dist'), { recursive: true })
  await Bun.write(resolve(TEST_DIR, 'mcp-server/dist/index.js'), 'console.log("mcp")\n')
  await Bun.write(
    resolve(TEST_DIR, 'INSTRUCTIONS.md'),
    [
      '# Test Plugin Instructions',
      '',
      'Use test-plugin consistently.',
      'If a workflow repeats, promote it into a command or specialist agent instead of hiding it in generic skills.',
      'Prefer the strongest honest native surface for each host.',
      '',
    ].join('\n'),
  )
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
    expect(existsSync(resolve(OUT_DIR, 'claude-code/mcp-server/dist/index.js'))).toBe(true)

    // Cursor
    expect(existsSync(resolve(OUT_DIR, 'cursor/.cursor-plugin/plugin.json'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'cursor/mcp.json'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'cursor/hooks/hooks.json'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'cursor/rules/megamind-operating-conventions.mdc'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'cursor/mcp-server/dist/index.js'))).toBe(true)

    // Codex
    expect(existsSync(resolve(OUT_DIR, 'codex/.codex-plugin/plugin.json'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'codex/.mcp.json'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'codex/hooks.json'))).toBe(false)
    expect(existsSync(resolve(OUT_DIR, 'codex/.codex/hooks.generated.json'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'codex/.codex/commands.generated.json'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'codex/commands/pulse.md'))).toBe(false)
    expect(existsSync(resolve(OUT_DIR, 'codex/mcp-server/dist/index.js'))).toBe(true)

    // OpenCode
    expect(existsSync(resolve(OUT_DIR, 'opencode/package.json'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'opencode/index.ts'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'opencode/mcp-server/dist/index.js'))).toBe(true)

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

  it('carries a rich Claude-style skill fixture and supporting files into all core-four outputs', async () => {
    const expectedPhrase = 'Use this skill when the request needs a sourced, specialist investigation.'

    for (const platform of ['claude-code', 'cursor', 'codex', 'opencode'] as const) {
      const skillRoot = resolve(OUT_DIR, platform, 'skills/deep-research')
      const skillFile = readFileSync(resolve(skillRoot, 'SKILL.md'), 'utf-8')

      expect(existsSync(resolve(skillRoot, 'reference.md'))).toBe(true)
      expect(existsSync(resolve(skillRoot, 'examples/sample.md'))).toBe(true)
      expect(existsSync(resolve(skillRoot, 'scripts/assist.sh'))).toBe(true)
      expect(skillFile).toContain('when_to_use:')
      expect(skillFile).toContain('argument-hint:')
      expect(skillFile).toContain('arguments: [company, region]')
      expect(skillFile).toContain('disable-model-invocation: true')
      expect(skillFile).toContain('allowed-tools: Read Grep Bash(git status *)')
      expect(skillFile).toContain('context: fork')
      expect(skillFile).toContain('agent: Explore')
      expect(skillFile).toContain('paths: ["src/**","docs/**"]')
      expect(skillFile).toContain(expectedPhrase)
    }
  })

  it('preserves remote bearer, runtime OAuth, and local stdio MCP intent across the core four', async () => {
    const runtimeConfig: PluginConfig = {
      ...testConfig,
      name: 'runtime-fixture-plugin',
      mcp: {
        'bearer-server': {
          url: 'https://bearer.example.com/mcp',
          transport: 'http',
          auth: {
            type: 'bearer',
            envVar: 'RUNTIME_TOKEN',
            headerName: 'Authorization',
            headerTemplate: 'Bearer ${value}',
          },
        },
        'oauth-server': {
          url: 'https://oauth.example.com/mcp',
          transport: 'http',
          auth: {
            type: 'platform',
            mode: 'oauth',
          },
        },
        'local-server': {
          transport: 'stdio',
          command: 'node',
          args: ['./mcp-server/dist/index.js', '--stdio'],
          env: {
            LOCAL_FIXTURE_TOKEN: '${LOCAL_FIXTURE_TOKEN}',
          },
        },
      },
      targets: ['claude-code', 'cursor', 'codex', 'opencode'],
      outDir: './runtime-dist',
    }

    await build(runtimeConfig, TEST_DIR)

    const claudeMcp = JSON.parse(
      readFileSync(resolve(TEST_DIR, 'runtime-dist/claude-code/.mcp.json'), 'utf-8')
    )
    const cursorMcp = JSON.parse(
      readFileSync(resolve(TEST_DIR, 'runtime-dist/cursor/mcp.json'), 'utf-8')
    )
    const codexMcp = JSON.parse(
      readFileSync(resolve(TEST_DIR, 'runtime-dist/codex/.mcp.json'), 'utf-8')
    )
    const opencodeIndex = readFileSync(resolve(TEST_DIR, 'runtime-dist/opencode/index.ts'), 'utf-8')

    expect(claudeMcp.mcpServers['bearer-server'].headers.Authorization).toContain('RUNTIME_TOKEN')
    expect(cursorMcp.mcpServers['bearer-server'].headers.Authorization).toContain('RUNTIME_TOKEN')
    expect(codexMcp.mcpServers['bearer-server'].bearer_token_env_var).toBe('RUNTIME_TOKEN')

    expect(claudeMcp.mcpServers['oauth-server'].headers).toBeUndefined()
    expect(cursorMcp.mcpServers['oauth-server'].headers).toBeUndefined()
    expect(codexMcp.mcpServers['oauth-server'].bearer_token_env_var).toBeUndefined()
    expect(codexMcp.mcpServers['oauth-server'].env_http_headers).toBeUndefined()

    expect(claudeMcp.mcpServers['local-server']).toEqual({
      command: 'node',
      args: ['./mcp-server/dist/index.js', '--stdio'],
      env: {
        LOCAL_FIXTURE_TOKEN: '${LOCAL_FIXTURE_TOKEN}',
      },
    })
    expect(cursorMcp.mcpServers['local-server']).toEqual({
      command: 'node',
      args: ['./mcp-server/dist/index.js', '--stdio'],
      env: {
        LOCAL_FIXTURE_TOKEN: '${LOCAL_FIXTURE_TOKEN}',
      },
    })
    expect(codexMcp.mcpServers['local-server']).toEqual({
      command: 'node',
      args: ['./mcp-server/dist/index.js', '--stdio'],
      env: {
        LOCAL_FIXTURE_TOKEN: '${LOCAL_FIXTURE_TOKEN}',
      },
    })

    expect(opencodeIndex).toContain('"bearer-server"')
    expect(opencodeIndex).toContain('"oauth-server"')
    expect(opencodeIndex).toContain('"local-server"')
    expect(opencodeIndex).toContain('"transport": "stdio"')
    expect(opencodeIndex).toContain('"command": "node"')
    expect(opencodeIndex).toContain('"LOCAL_FIXTURE_TOKEN": "${LOCAL_FIXTURE_TOKEN}"')
    expect(opencodeIndex).not.toContain('"type": "platform"')
  })

  it('generates Codex manifest with interface metadata', async () => {
    const manifest = JSON.parse(
      readFileSync(resolve(OUT_DIR, 'codex/.codex-plugin/plugin.json'), 'utf-8')
    )
    expect(manifest.interface.displayName).toBe('Test Plugin')
    expect(manifest.interface.brandColor).toBe('#FF0000')
    expect(manifest.interface.composerIcon).toBe('./assets/icon.svg')
    expect(manifest.interface.logo).toBe('./assets/icon.svg')
    expect(manifest.interface.screenshots).toEqual(['./assets/screenshots/overview.svg'])
    expect(manifest.interface.websiteURL).toBe('https://example.com')
    expect(manifest.interface.defaultPrompt).toEqual(['Hello from test plugin'])
    expect(manifest.interface.privacyPolicyURL).toBe('https://example.com/privacy')
    expect(manifest.interface.termsOfServiceURL).toBe('https://example.com/terms')
  })

  it('generates Cursor manifest with homepage and logo metadata', async () => {
    const manifest = JSON.parse(
      readFileSync(resolve(OUT_DIR, 'cursor/.cursor-plugin/plugin.json'), 'utf-8')
    )
    expect(manifest.homepage).toBe('https://example.com')
    expect(manifest.logo).toBe('./assets/icon.svg')
  })

  it('generates OpenCode plugin wrapper with env var check', async () => {
    const indexTs = readFileSync(resolve(OUT_DIR, 'opencode/index.ts'), 'utf-8')
    expect(indexTs).toContain('TestPluginPlugin')
    expect(indexTs).toContain('TEST_API_KEY')
    expect(indexTs).toContain('.pluxx-user.json')
    expect(indexTs).toContain('loadUserConfig')
    expect(indexTs).toContain('const AGENT_DEFINITIONS =')
    expect(indexTs).toContain('"escalation"')
    expect(indexTs).toContain('"mode": "subagent"')
    expect(indexTs).toContain('"hidden": true')
    expect(indexTs).toContain('"task": {')
    expect(indexTs).toContain('config.agent = {')
  })

  it('writes documented hook outputs and omits undocumented Codex hook bundles', async () => {
    const claudeHooks = JSON.parse(
      readFileSync(resolve(OUT_DIR, 'claude-code/hooks/hooks.json'), 'utf-8')
    )

    expect(claudeHooks.hooks.UserPromptSubmit).toBeDefined()
    expect(existsSync(resolve(OUT_DIR, 'codex/hooks.json'))).toBe(false)
  })

  it('generates runtime permission outputs for Claude Code, Cursor, OpenCode, and Codex external config', async () => {
    const permissionConfig: PluginConfig = {
      ...testConfig,
      name: 'permission-plugin',
      hooks: undefined,
      permissions: {
        allow: ['Read(src/**)'],
        ask: ['Bash(git commit *)'],
        deny: ['Edit(.env)', 'Skill(review-scaffold)'],
      },
      targets: ['claude-code', 'cursor', 'opencode', 'codex'],
      outDir: './permission-dist',
    }

    await build(permissionConfig, TEST_DIR)

    const claudeManifest = JSON.parse(
      readFileSync(resolve(TEST_DIR, 'permission-dist/claude-code/.claude-plugin/plugin.json'), 'utf-8')
    )
    const claudeHooks = JSON.parse(
      readFileSync(resolve(TEST_DIR, 'permission-dist/claude-code/hooks/hooks.json'), 'utf-8')
    )
    const cursorManifest = JSON.parse(
      readFileSync(resolve(TEST_DIR, 'permission-dist/cursor/.cursor-plugin/plugin.json'), 'utf-8')
    )
    const cursorHooks = JSON.parse(
      readFileSync(resolve(TEST_DIR, 'permission-dist/cursor/hooks/hooks.json'), 'utf-8')
    )
    const opencodeIndex = readFileSync(resolve(TEST_DIR, 'permission-dist/opencode/index.ts'), 'utf-8')
    const codexPermissions = JSON.parse(
      readFileSync(resolve(TEST_DIR, 'permission-dist/codex/.codex/permissions.generated.json'), 'utf-8')
    )

    expect(claudeManifest.hooks).toBeUndefined()
    expect(existsSync(resolve(TEST_DIR, 'permission-dist/claude-code/hooks/pluxx-permissions.mjs'))).toBe(true)
    expect(claudeHooks.hooks.PreToolUse).toBeDefined()

    expect(cursorManifest.hooks).toBe('./hooks/hooks.json')
    expect(existsSync(resolve(TEST_DIR, 'permission-dist/cursor/hooks/pluxx-permissions.mjs'))).toBe(true)
    expect(cursorHooks.hooks.preToolUse).toBeDefined()
    expect(cursorHooks.hooks.beforeShellExecution).toBeDefined()

    expect(opencodeIndex).toContain('const PERMISSIONS =')
    expect(opencodeIndex).toContain('"read": "allow"')
    expect(opencodeIndex).toContain('"edit": "deny"')
    expect(opencodeIndex).not.toContain('"skill"')

    expect(codexPermissions.model).toBe('pluxx.permissions.v1')
    expect(codexPermissions.enforcedByPluginBundle).toBe(false)
    expect(codexPermissions.rules.some((rule: { raw: string }) => rule.raw === 'Read(src/**)')).toBe(true)
  })

  it('generates a Codex hook companion with mapped native event names', async () => {
    const codexHooks = JSON.parse(
      readFileSync(resolve(OUT_DIR, 'codex/.codex/hooks.generated.json'), 'utf-8')
    ) as {
      model: string
      hooks: Record<string, Array<{ command: string }>>
    }

    expect(codexHooks.model).toBe('pluxx.codex-hooks.v1')
    expect(codexHooks.hooks.SessionStart?.[0]?.command).toContain('./scripts/validate.sh')
    expect(codexHooks.hooks.UserPromptSubmit?.[0]?.command).toContain('./scripts/check-prompt.sh')
  })

  it('preserves hook fields only where the target can honestly carry them', async () => {
    const hookConfig: PluginConfig = {
      ...testConfig,
      name: 'hook-translation-plugin',
      hooks: {
        beforeSubmitPrompt: [{
          type: 'prompt',
          prompt: 'Confirm before sending the prompt.',
          model: 'gpt-5',
        }],
        preToolUse: [{
          command: '${PLUGIN_ROOT}/scripts/confirm-mutation.sh',
          matcher: 'Bash',
          failClosed: true,
          loop_limit: 2,
        }],
        stop: [{
          command: '${PLUGIN_ROOT}/scripts/confirm-mutation.sh',
          loop_limit: 3,
        }],
      },
      targets: ['claude-code', 'cursor', 'codex', 'opencode'],
      outDir: './hook-translation-dist',
    }

    await build(hookConfig, TEST_DIR)

    const claudeHooks = JSON.parse(
      readFileSync(resolve(TEST_DIR, 'hook-translation-dist/claude-code/hooks/hooks.json'), 'utf-8')
    )
    const cursorHooks = JSON.parse(
      readFileSync(resolve(TEST_DIR, 'hook-translation-dist/cursor/hooks/hooks.json'), 'utf-8')
    )
    const codexHooks = JSON.parse(
      readFileSync(resolve(TEST_DIR, 'hook-translation-dist/codex/.codex/hooks.generated.json'), 'utf-8')
    )
    const opencodeIndex = readFileSync(resolve(TEST_DIR, 'hook-translation-dist/opencode/index.ts'), 'utf-8')

    expect(claudeHooks.hooks.UserPromptSubmit).toBeUndefined()
    expect(claudeHooks.hooks.PreToolUse?.[0]?.matcher).toBe('Bash')
    expect(claudeHooks.hooks.PreToolUse?.[0]?.failClosed).toBeUndefined()
    expect(claudeHooks.hooks.Stop?.[0]?.loop_limit).toBeUndefined()

    expect(cursorHooks.hooks.beforeSubmitPrompt?.[0]?.type).toBe('prompt')
    expect(cursorHooks.hooks.beforeSubmitPrompt?.[0]?.prompt).toContain('Confirm before sending the prompt')
    expect(cursorHooks.hooks.preToolUse?.[0]?.matcher).toBe('Bash')
    expect(cursorHooks.hooks.preToolUse?.[0]?.failClosed).toBe(true)
    expect(cursorHooks.hooks.preToolUse?.[0]?.loop_limit).toBeUndefined()
    expect(cursorHooks.hooks.stop?.[0]?.loop_limit).toBe(3)

    expect(codexHooks.hooks.PreToolUse?.[0]?.matcher).toBe('Bash')
    expect(codexHooks.hooks.PreToolUse?.[0]?.failClosed).toBe(true)
    expect(codexHooks.hooks.PreToolUse?.[0]?.loop_limit).toBeUndefined()
    expect(codexHooks.hooks.UserPromptSubmit).toBeUndefined()

    expect(opencodeIndex).toContain('"matcher": "Bash"')
    expect(opencodeIndex).toContain('"failClosed": true')
    expect(opencodeIndex).not.toContain('Confirm before sending the prompt.')
    expect(opencodeIndex).not.toContain('"loop_limit": 3')
  })

  it('carries compiler-intent skill policies into the Codex permissions companion when present', async () => {
    mkdirSync(resolve(TEST_DIR, '.pluxx'), { recursive: true })
    await Bun.write(
      resolve(TEST_DIR, '.pluxx/compiler-intent.json'),
      JSON.stringify({
        version: 1,
        skillPolicies: [{
          skillDir: 'hello',
          title: 'hello',
          description: 'Say hello',
          source: {
            kind: 'claude-allowed-tools',
            platform: 'claude-code',
          },
          permissions: {
            allow: ['Read(*)', 'MCP(test-server.greet)'],
          },
        }],
      }, null, 2) + '\n',
    )

    const permissionConfig: PluginConfig = {
      ...testConfig,
      name: 'intent-plugin',
      permissions: {
        allow: ['Read(src/**)'],
      },
      targets: ['codex'],
      outDir: './intent-dist',
    }

    await build(permissionConfig, TEST_DIR)

    const codexPermissions = JSON.parse(
      readFileSync(resolve(TEST_DIR, 'intent-dist/codex/.codex/permissions.generated.json'), 'utf-8')
    ) as {
      skillPolicies?: Array<{ skillDir: string; permissions: { allow?: string[] } }>
    }

    expect(codexPermissions.skillPolicies).toHaveLength(1)
    expect(codexPermissions.skillPolicies?.[0]?.skillDir).toBe('hello')
    expect(codexPermissions.skillPolicies?.[0]?.permissions.allow).toEqual(['Read(*)', 'MCP(test-server.greet)'])
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

  it('preserves shared instruction intent across the core four native instruction surfaces', async () => {
    const sourceInstructions = readFileSync(resolve(TEST_DIR, 'INSTRUCTIONS.md'), 'utf-8').trim()
    const sharedLine = 'If a workflow repeats, promote it into a command or specialist agent instead of hiding it in generic skills.'

    const claudeInstructions = readFileSync(resolve(OUT_DIR, 'claude-code/CLAUDE.md'), 'utf-8')
    const cursorInstructions = readFileSync(resolve(OUT_DIR, 'cursor/AGENTS.md'), 'utf-8')
    const codexInstructions = readFileSync(resolve(OUT_DIR, 'codex/AGENTS.md'), 'utf-8')
    const opencodeIndex = readFileSync(resolve(OUT_DIR, 'opencode/index.ts'), 'utf-8')

    expect(claudeInstructions).toContain(sourceInstructions)
    expect(cursorInstructions).toContain(sourceInstructions)
    expect(codexInstructions).toContain(sourceInstructions)
    expect(opencodeIndex).toContain(JSON.stringify(sourceInstructions))
    expect(opencodeIndex).toContain('const INSTRUCTIONS =')
    expect(opencodeIndex).toContain('applyInstructions(output.system)')
    expect(opencodeIndex).toContain(sharedLine)
  })

  it('compiles canonical agents into native Codex custom-agent TOML files', async () => {
    const codexAgent = readFileSync(resolve(OUT_DIR, 'codex/.codex/agents/escalation.toml'), 'utf-8')
    expect(codexAgent).toContain('name = "escalation"')
    expect(codexAgent).toContain('description = "Escalation specialist."')
    expect(codexAgent).toContain('developer_instructions = """')
    expect(codexAgent).toContain('Delegation contract:')
    expect(codexAgent).toContain('This specialist is intended primarily for delegated use')
    expect(codexAgent).toContain('Only delegate further subtasks when the work clearly benefits from another specialist.')
    expect(codexAgent).toContain('Escalate tricky issues with a constrained tool policy.')
  })

  it('degrades canonical commands into Codex routing guidance and a generated companion', async () => {
    const codexAgentsMd = readFileSync(resolve(OUT_DIR, 'codex/AGENTS.md'), 'utf-8')
    const codexCommands = JSON.parse(
      readFileSync(resolve(OUT_DIR, 'codex/.codex/commands.generated.json'), 'utf-8')
    ) as {
      model: string
      commands: Array<{ id: string; title: string }>
    }

    expect(codexAgentsMd).toContain('## Command Routing')
    expect(codexAgentsMd).toContain('`/pulse`')
    expect(codexCommands.model).toBe('pluxx.commands.v1')
    expect(codexCommands.commands[0]?.id).toBe('pulse')
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

  it('keeps Claude commands visible when names collide with semantic skills', async () => {
    mkdirSync(resolve(TEST_DIR, 'skills/read-and-triage-mail'), { recursive: true })
    await Bun.write(
      resolve(TEST_DIR, 'skills/read-and-triage-mail/SKILL.md'),
      '---\nname: read-and-triage-mail\ndescription: triage flow\n---\n',
    )
    await Bun.write(resolve(TEST_DIR, 'commands/read-and-triage-mail.md'), '# Read and triage mail\n')

    const collisionConfig: PluginConfig = {
      ...testConfig,
      outDir: './collision-dist',
      targets: ['claude-code', 'cursor'],
    }

    await build(collisionConfig, TEST_DIR)

    const claudeSkill = readFileSync(
      resolve(TEST_DIR, 'collision-dist/claude-code/skills/read-and-triage-mail/SKILL.md'),
      'utf-8',
    )
    expect(
      existsSync(resolve(TEST_DIR, 'collision-dist/claude-code/skills/read-and-triage-mail/SKILL.md'))
    ).toBe(true)
    expect(
      existsSync(resolve(TEST_DIR, 'collision-dist/claude-code/commands/read-and-triage-mail.md'))
    ).toBe(true)
    expect(claudeSkill).toContain('name: read-and-triage-mail-skill')
    expect(claudeSkill).toContain('user-invocable: false')

    expect(
      existsSync(resolve(TEST_DIR, 'collision-dist/cursor/skills/read-and-triage-mail/SKILL.md'))
    ).toBe(true)
    expect(
      existsSync(resolve(TEST_DIR, 'collision-dist/cursor/commands/read-and-triage-mail.md'))
    ).toBe(true)
  })

  it('copies commands and agents to Cursor plugin roots', async () => {
    expect(existsSync(resolve(OUT_DIR, 'cursor/commands/pulse.md'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'cursor/agents/escalation.md'))).toBe(true)
    const cursorAgent = readFileSync(resolve(OUT_DIR, 'cursor/agents/escalation.md'), 'utf-8')
    expect(cursorAgent).toContain('name: "escalation"')
    expect(cursorAgent).toContain('description: "Escalation specialist."')
    expect(cursorAgent).not.toContain('permission:')
    expect(cursorAgent).not.toContain('mode: subagent')
    expect(cursorAgent).toContain('Cursor translation note: stay read-only unless the parent task explicitly asks for file edits.')
    expect(cursorAgent).toContain('Cursor translation note: only delegate further subtasks when the work clearly benefits from another specialist.')
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
