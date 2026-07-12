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

  it('warns when a scaffold is shaped like one command per raw tool', async () => {
    await writeMcpScaffold({
      rootDir: TEST_DIR,
      pluginName: 'raw-tools',
      authorName: 'Test Author',
      displayName: 'Raw Tools',
      targets: ['codex'],
      source: {
        transport: 'http',
        url: 'https://raw-tools.example.com/mcp',
      },
      introspection: {
        ...introspection,
        resources: [],
        resourceTemplates: [],
        prompts: [],
        tools: [
          { name: 'alpha_lookup', description: 'Lookup alpha data.', inputSchema: { type: 'object', properties: {} } },
          { name: 'beta_lookup', description: 'Lookup beta data.', inputSchema: { type: 'object', properties: {} } },
          { name: 'gamma_lookup', description: 'Lookup gamma data.', inputSchema: { type: 'object', properties: {} } },
          { name: 'delta_lookup', description: 'Lookup delta data.', inputSchema: { type: 'object', properties: {} } },
        ],
      },
      skillGrouping: 'tool',
      hookMode: 'none',
    })

    const report = await runEvalSuite({ rootDir: TEST_DIR })

    expect(report.ok).toBe(true)
    expect(report.checks.some((check) => check.code === 'scaffold-command-per-tool-shape' && check.level === 'warning')).toBe(true)
    expect(report.checks.some((check) => check.code === 'scaffold-singleton-heavy-taxonomy' && check.level === 'warning')).toBe(false)
  })

  it('fails when a generated skill loses required related prompt guidance', async () => {
    const skillPath = resolve(TEST_DIR, 'skills/account-research/SKILL.md')
    const mutated = readFileSync(skillPath, 'utf-8').replace('## Related Prompt Templates', '## Prompt Templates')
    writeFileSync(skillPath, mutated)

    const report = await runEvalSuite({ rootDir: TEST_DIR })

    expect(report.ok).toBe(false)
    expect(report.checks.some((check) => check.code === 'skill-quality-contract' && check.path === 'skills/account-research/SKILL.md')).toBe(true)
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

  it('fails semantic evaluation for a heading-complete but incoherent scaffold', async () => {
    const skillPath = resolve(TEST_DIR, 'skills/account-research/SKILL.md')
    const skillFrontmatter = readFileSync(skillPath, 'utf-8').split('---').slice(0, 2).join('---')
    writeFileSync(skillPath, `${skillFrontmatter}---\n\n# Account Research\n\n## Example Requests\n\n- Example request.\n\n## Related Resources\n\n- Resource.\n\n## Related Prompt Templates\n\n- Prompt.\n`)

    const commandPath = resolve(TEST_DIR, 'commands/account-research.md')
    writeFileSync(commandPath, `---\ndescription: Run account research\nargument-hint: "[input]"\n---\n\n# Account Research\n\nPrimary tools: generic.\nRelated resources: generic.\nRelated prompt templates: generic.\n`)

    const instructionsPath = resolve(TEST_DIR, 'INSTRUCTIONS.md')
    writeFileSync(instructionsPath, '# Sumble\n\n## Workflow Guidance\n\nUse the workflow.\n\n## Tool Routing\n\nUse the tool.\n\n## Resource Surfaces\n\nResource.\n\n## Prompt Templates\n\nPrompt.\n')

    const report = await runEvalSuite({ rootDir: TEST_DIR })

    expect(report.ok).toBe(false)
    expect(report.semantic.score).toBeLessThan(report.semantic.failureThreshold)
    expect(report.checks.some(check => check.code === 'instructions-quality-contract' && check.level === 'success')).toBe(true)
    expect(report.checks.some(check => check.code === 'semantic-rubric-threshold' && check.level === 'error')).toBe(true)
  })

  it('fails keyword-stuffed workflow text that contradicts its own taxonomy', async () => {
    const skillPath = resolve(TEST_DIR, 'skills/account-research/SKILL.md')
    const original = readFileSync(skillPath, 'utf-8')
    const frontmatter = original.split('---').slice(0, 2).join('---')
    writeFileSync(skillPath, `${frontmatter}---\n\n# Account Research\n\n## Workflow\n\n1. Account research must not research accounts for a customer.\n2. Do not use account research to find organizations or evidence.\n3. Never route account research through the account research tools.\n\n## Example Requests\n\n- Research this account.\n\n## Related Resources\n\n- Resource.\n\n## Related Prompt Templates\n\n- Prompt.\n`)

    const report = await runEvalSuite({ rootDir: TEST_DIR })

    expect(report.checks.some(check => check.code === 'instructions-quality-contract' && check.level === 'success')).toBe(true)
    expect(report.semantic.criteria.find(criterion => criterion.id === 'taxonomy-coherence')?.score).toBe(0)
    expect(report.checks.find(check => check.code === 'semantic-rubric-threshold')?.level).toBe('error')
  })

  it('does not count tools assigned only to a deleted authored skill', async () => {
    rmSync(resolve(TEST_DIR, 'skills/account-research'), { recursive: true, force: true })

    const report = await runEvalSuite({ rootDir: TEST_DIR })

    expect(report.semantic.criteria.find(criterion => criterion.id === 'tool-coverage')?.score).toBe(0)
  })

  it('scores unresolved configured delegation targets as inconsistent', async () => {
    mkdirSync(resolve(TEST_DIR, 'agents'), { recursive: true })
    writeFileSync(
      resolve(TEST_DIR, 'agents/researcher.md'),
      '---\nname: researcher\ndescription: Research account evidence\n---\n\n# Researcher\n\n## Workflow\n\n1. Gather account evidence.\n2. Return sourced findings.\n',
    )
    const configPath = resolve(TEST_DIR, 'pluxx.config.ts')
    writeFileSync(
      configPath,
      readFileSync(configPath, 'utf-8').replace(/\n}\)\s*$/, '\n  agents: \'./agents/\',\n})\n'),
    )
    const skillPath = resolve(TEST_DIR, 'skills/account-research/SKILL.md')
    writeFileSync(
      skillPath,
      readFileSync(skillPath, 'utf-8').replace('description:', 'agent: missing-reviewer\ndescription:'),
    )

    const report = await runEvalSuite({ rootDir: TEST_DIR })

    expect(report.semantic.criteria.find(criterion => criterion.id === 'delegation')?.score).toBeLessThan(100)
    expect(report.semantic.criteria.find(criterion => criterion.id === 'cross-file-consistency')?.score).toBeLessThan(100)
  })

  it('fails an empty manual project instead of assigning a perfect score', async () => {
    rmSync(resolve(TEST_DIR, `.${'pluxx'}`), { recursive: true, force: true })
    rmSync(resolve(TEST_DIR, 'skills'), { recursive: true, force: true })
    rmSync(resolve(TEST_DIR, 'commands'), { recursive: true, force: true })
    rmSync(resolve(TEST_DIR, 'INSTRUCTIONS.md'), { force: true })
    rmSync(resolve(TEST_DIR, 'pluxx.config.ts'), { force: true })
    writeFileSync(resolve(TEST_DIR, 'pluxx.config.json'), JSON.stringify({
      name: 'empty-manual',
      description: 'Empty manual project fixture.',
      author: { name: 'Test Author' },
      skills: './skills/',
    }))

    const report = await runEvalSuite({ rootDir: TEST_DIR })

    expect(report.semantic.score).toBe(0)
    expect(report.ok).toBe(false)
  })

  it('keeps maintained manual and docs-ingestion projects as passing regression inputs', async () => {
    const maintainedProjects = [
      'example/pluxx',
      'example/docs-ops',
      'example/firecrawl-plugin',
      'example/sumble-plugin',
    ]

    for (const project of maintainedProjects) {
      const report = await runEvalSuite({ rootDir: resolve(ROOT, project) })
      expect(report.semantic.criteria).toHaveLength(8)
      expect(report.checks.some(check => check.domain === 'semantic')).toBe(true)
      expect(
        report.checks.find(check => check.code === 'semantic-rubric-threshold')?.level,
        project,
      ).not.toBe('error')
      if (project === 'example/pluxx' || project === 'example/docs-ops') {
        expect(report.ok, project).toBe(true)
      }
    }
  })

  it('honors project-level semantic warning and failure thresholds', async () => {
    const configPath = resolve(TEST_DIR, 'pluxx.config.ts')
    const config = readFileSync(configPath, 'utf-8').replace(
      /\n}\)\s*$/,
      '\n  eval: { warningThreshold: 100, failureThreshold: 0 },\n})\n',
    )
    writeFileSync(configPath, config)

    const report = await runEvalSuite({ rootDir: TEST_DIR })

    expect(report.semantic.warningThreshold).toBe(100)
    expect(report.semantic.failureThreshold).toBe(0)
    expect(report.checks.find(check => check.code === 'semantic-rubric-threshold')?.level).toBe(
      report.semantic.score < 100 ? 'warning' : 'success',
    )
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
