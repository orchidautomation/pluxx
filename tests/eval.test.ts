import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { runEvalSuite } from '../src/cli/eval'
import { runTestSuite } from '../src/cli/test'
import { writeMcpScaffold } from '../src/cli/init-from-mcp'
import type { IntrospectedMcpServer } from '../src/mcp/introspect'

const TEST_DIR = mkdtempSync(resolve(tmpdir(), 'pluxx-eval-'))
const ROOT = resolve(import.meta.dir, '..')

const introspection: IntrospectedMcpServer = {
  protocolVersion: '2025-03-26',
  instructions: 'Use the most specific tool for the request.',
  serverInfo: {
    name: 'sumble',
    title: 'Sumble',
    version: '1.0.0',
    description: 'Sales intelligence and account research tools.',
    websiteUrl: 'https://sumble.com/',
  },
  resources: [
    {
      uri: 'sumble://guides/getting-started',
      name: 'getting-started',
      description: 'Setup and onboarding guide for Sumble users.',
      mimeType: 'text/markdown',
    },
  ],
  resourceTemplates: [
    {
      uriTemplate: 'sumble://organizations/{organization_id}',
      name: 'organization-resource',
      description: 'Fetch organization reference data by identifier.',
      mimeType: 'application/json',
    },
  ],
  prompts: [
    {
      name: 'qualify-account',
      description: 'Qualify a target account before outreach.',
      arguments: [
        {
          name: 'company_name',
          required: true,
        },
      ],
    },
  ],
  tools: [
    {
      name: 'FindOrganizations',
      title: 'Find Organizations',
      description: 'Search organizations by company attributes and signals.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Company search query.',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'GetOrganization',
      description: 'Fetch a single organization by identifier.',
      inputSchema: {
        type: 'object',
        properties: {
          organizationId: {
            type: 'string',
            description: 'Organization identifier.',
          },
        },
        required: ['organizationId'],
      },
    },
  ],
}

async function writeFixture() {
  await writeMcpScaffold({
    rootDir: TEST_DIR,
    pluginName: 'sumble',
    authorName: 'Test Author',
    displayName: 'Sumble',
    targets: ['claude-code', 'cursor', 'codex', 'opencode'],
    source: {
      transport: 'http',
      url: 'https://mcp.sumble.com/',
      auth: {
        type: 'bearer',
        envVar: 'SUMBLE_API_KEY',
      },
    },
    introspection,
    skillGrouping: 'workflow',
    hookMode: 'safe',
  })
}

beforeEach(async () => {
  rmSync(TEST_DIR, { recursive: true, force: true })
  mkdirSync(TEST_DIR, { recursive: true })
  await writeFixture()
})

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

describe('eval command', () => {
  it('passes on a healthy MCP-derived scaffold', async () => {
    const report = await runEvalSuite({ rootDir: TEST_DIR })

    expect(report.ok).toBe(true)
    expect(report.errors).toBe(0)
    expect(report.checks.some((check) => check.code === 'taxonomy-prompt-contract' && check.level === 'success')).toBe(true)
    expect(report.checks.some((check) => check.code === 'instructions-quality-contract' && check.level === 'success')).toBe(true)
    expect(report.checks.some((check) => check.code === 'command-quality-contract' && check.level === 'success')).toBe(true)
  })

  it('fails when a generated skill loses required related prompt guidance', async () => {
    const skillPath = resolve(TEST_DIR, 'skills/account-research/SKILL.md')
    const mutated = readFileSync(skillPath, 'utf-8').replace('## Related Prompt Templates', '## Prompt Templates')
    writeFileSync(skillPath, mutated)

    const report = await runEvalSuite({ rootDir: TEST_DIR })

    expect(report.ok).toBe(false)
    expect(report.checks.some((check) => check.code === 'skill-quality-contract' && check.path === 'skills/account-research/SKILL.md')).toBe(true)
  })

  it('warns when a prompt-backed command falls back to a generic argument hint', async () => {
    const commandPath = resolve(TEST_DIR, 'commands/account-research.md')
    const mutated = readFileSync(commandPath, 'utf-8').replace('argument-hint: [company]', 'argument-hint: [request]')
    writeFileSync(commandPath, mutated)

    const report = await runEvalSuite({ rootDir: TEST_DIR })

    expect(report.ok).toBe(true)
    expect(report.checks.some((check) => check.code === 'command-generic-prompt-arguments' && check.level === 'warning')).toBe(true)
  })

  it('causes pluxx test to fail when eval errors are present', async () => {
    const skillPath = resolve(TEST_DIR, 'skills/account-research/SKILL.md')
    const mutated = readFileSync(skillPath, 'utf-8').replace('## Related Prompt Templates', '## Prompt Templates')
    writeFileSync(skillPath, mutated)

    const result = await runTestSuite({ rootDir: TEST_DIR })

    expect(result.ok).toBe(false)
    expect(result.eval?.errors).toBeGreaterThan(0)
    expect(result.eval?.checks.some((check) => check.code === 'skill-quality-contract')).toBe(true)
  })

  it('supports CLI JSON output', async () => {
    const proc = Bun.spawn(['bun', resolve(ROOT, 'bin/pluxx.js'), 'eval', '--json'], {
      cwd: TEST_DIR,
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(stderr).toBe('')

    const report = JSON.parse(stdout) as {
      ok: boolean
      errors: number
      checks: Array<{ code: string }>
    }

    expect(report.ok).toBe(true)
    expect(report.errors).toBe(0)
    expect(report.checks.some((check) => check.code === 'review-prompt-contract')).toBe(true)
  })
})
