import { describe, expect, it } from 'bun:test'
import type { PluginConfig } from '../src/schema'
import { buildPrimitiveTranslationSummary, renderPrimitiveTranslationSummary } from '../src/cli/primitive-summary'

const config: PluginConfig = {
  name: 'summary-plugin',
  version: '0.1.0',
  description: 'summary fixture',
  author: { name: 'Orchid' },
  skills: './skills/',
  commands: './commands/',
  agents: './agents/',
  instructions: './INSTRUCTIONS.md',
  hooks: {
    sessionStart: [{ command: './scripts/check.sh' }],
  },
  permissions: {
    allow: ['Read(src/**)'],
  },
  mcp: {
    fixture: {
      transport: 'http',
      url: 'https://example.com/mcp',
    },
  },
  targets: ['claude-code', 'cursor', 'codex', 'opencode'],
  outDir: './dist',
}

describe('primitive summary', () => {
  it('renders only the interesting cross-host deltas for configured buckets', () => {
    const summary = buildPrimitiveTranslationSummary(config)
    const lines = renderPrimitiveTranslationSummary(summary)

    expect(lines[0]).toBe('Core-four mapping:')
    expect(lines.some((line) => line.includes('commands'))).toBe(true)
    expect(lines.some((line) => line.includes('agents'))).toBe(true)
    expect(lines.some((line) => line.includes('hooks'))).toBe(true)
    expect(lines.some((line) => line.includes('permissions'))).toBe(true)
    expect(lines.some((line) => line.startsWith('  runtime'))).toBe(false)
    expect(lines.some((line) => line.startsWith('  skills'))).toBe(false)
    expect(lines.some((line) => line.includes('legend: keep=preserve xlat=translate weak=degrade drop=drop'))).toBe(true)
    expect(lines.some((line) => line.includes('details:'))).toBe(true)
    expect(lines.some((line) => line.includes('commands on codex') && line.includes('.codex/agents'))).toBe(false)
    expect(lines.some((line) => line.includes('commands on codex') && line.includes('skills/, AGENTS.md'))).toBe(true)
    expect(lines.some((line) => line.includes('hooks on open') && line.includes('plugin JS/TS event handlers'))).toBe(true)
  })
})
