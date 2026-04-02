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
  },
  targets: ['claude-code', 'cursor', 'codex', 'opencode'],
  outDir: './dist',
}

beforeAll(async () => {
  mkdirSync(resolve(TEST_DIR, 'skills/hello/'), { recursive: true })
  await Bun.write(
    resolve(TEST_DIR, 'skills/hello/SKILL.md'),
    '---\nname: hello\ndescription: Say hello\n---\n\nSay hello to the user.\n',
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
    expect(existsSync(resolve(OUT_DIR, 'claude-code/hooks.json'))).toBe(true)

    // Cursor
    expect(existsSync(resolve(OUT_DIR, 'cursor/.cursor-plugin/plugin.json'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'cursor/mcp.json'))).toBe(true)

    // Codex
    expect(existsSync(resolve(OUT_DIR, 'codex/.codex-plugin/plugin.json'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'codex/.mcp.json'))).toBe(true)

    // OpenCode
    expect(existsSync(resolve(OUT_DIR, 'opencode/package.json'))).toBe(true)
    expect(existsSync(resolve(OUT_DIR, 'opencode/index.ts'))).toBe(true)
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

  it('copies skills to all targets', async () => {
    for (const platform of ['claude-code', 'cursor', 'codex', 'opencode']) {
      expect(
        existsSync(resolve(OUT_DIR, platform, 'skills/hello/SKILL.md'))
      ).toBe(true)
    }
  })
})
