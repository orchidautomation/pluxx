import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import {
  AGENT_DOCS_CONTEXT_PATH,
  AGENT_SOURCES_PATH,
  planAgentPrepare,
  type AgentContextIngestionArtifact,
  type AgentDocsContextArtifact,
  type AgentIngestProvider,
} from '../src/cli/agent'

interface FixtureExpectation {
  productName?: string
  descriptionTerms?: string[]
  workflowTerms?: string[]
  setupTerms?: string[]
  authTerms?: string[]
}

interface FixtureDefinition {
  name: string
  label: string
  projectPath?: string
  fixtureKind: 'example-project' | 'synthetic-project'
  websiteUrl: string
  docsUrl: string
  expectations: FixtureExpectation
}

interface SourceRecord {
  label: string
  role: string
  status: string
  provider?: string
  note?: string
  httpStatus?: number
}

interface VariantResult {
  provider: 'baseline' | 'local' | 'firecrawl'
  status: 'ok' | 'skipped' | 'error'
  skipReason?: string
  error?: string
  contextInputs: string[]
  ingestion?: AgentContextIngestionArtifact
  docsContext?: AgentDocsContextArtifact
  matched: {
    productName: boolean
    descriptionTerms: string[]
    workflowTerms: string[]
    setupTerms: string[]
    authTerms: string[]
    matchedCount: number
    expectedCount: number
  }
  sourceSummary: Array<{
    label: string
    role: string
    status: string
    provider?: string
    note?: string
    httpStatus?: number
  }>
}

interface FixtureResult {
  fixture: {
    name: string
    label: string
    fixtureKind: FixtureDefinition['fixtureKind']
    projectPath?: string
    websiteUrl: string
    docsUrl: string
  }
  results: VariantResult[]
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT_JSON_PATH = resolve(REPO_ROOT, 'docs/strategy/docs-ingestion-fixture-eval.json')
const OUTPUT_MD_PATH = resolve(REPO_ROOT, 'docs/strategy/docs-ingestion-fixture-eval.md')
const FIRECRAWL_ENABLED = Boolean(process.env.FIRECRAWL_API_KEY || process.env.PLUXX_FIRECRAWL_API_KEY)

const FIXTURES: FixtureDefinition[] = [
  {
    name: 'firecrawl',
    label: 'Firecrawl',
    projectPath: resolve(REPO_ROOT, 'example/firecrawl-plugin'),
    fixtureKind: 'example-project',
    websiteUrl: 'https://www.firecrawl.dev',
    docsUrl: 'https://docs.firecrawl.dev/mcp-server',
    expectations: {
      productName: 'Firecrawl',
      descriptionTerms: ['markdown', 'structured data'],
      workflowTerms: ['Scrape', 'Map'],
      setupTerms: ['main content'],
      authTerms: ['API key'],
    },
  },
  {
    name: 'sumble',
    label: 'Sumble',
    projectPath: resolve(REPO_ROOT, 'example/sumble-plugin'),
    fixtureKind: 'example-project',
    websiteUrl: 'https://sumble.com',
    docsUrl: 'https://docs.sumble.com/api/mcp',
    expectations: {
      productName: 'Sumble',
      descriptionTerms: ['account intelligence', 'sales teams'],
    },
  },
  {
    name: 'playkit',
    label: 'PlayKit',
    fixtureKind: 'synthetic-project',
    websiteUrl: 'https://playkit.sh',
    docsUrl: 'https://docs.playkit.sh',
    expectations: {
      productName: 'PlayKit',
      descriptionTerms: ['Clay'],
    },
  },
]

async function main(): Promise<void> {
  const fixtureResults: FixtureResult[] = []
  for (const fixture of FIXTURES) {
    const runtimeRoot = fixture.projectPath ?? createSyntheticFixtureProject(fixture)
    try {
      const results: VariantResult[] = []
      results.push(await runVariant(runtimeRoot, fixture, 'baseline'))
      results.push(await runVariant(runtimeRoot, fixture, 'local'))
      results.push(await runVariant(runtimeRoot, fixture, 'firecrawl'))
      fixtureResults.push({
        fixture: {
          name: fixture.name,
          label: fixture.label,
          fixtureKind: fixture.fixtureKind,
          projectPath: fixture.projectPath,
          websiteUrl: fixture.websiteUrl,
          docsUrl: fixture.docsUrl,
        },
        results,
      })
    } finally {
      if (!fixture.projectPath) {
        rmSync(runtimeRoot, { recursive: true, force: true })
      }
    }
  }

  const generatedAt = new Date().toISOString()
  const payload = {
    version: 1,
    generatedAt,
    firecrawlEnabled: FIRECRAWL_ENABLED,
    fixtureResults,
  }

  writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(payload, null, 2)}\n`)
  writeFileSync(OUTPUT_MD_PATH, renderMarkdownReport(payload))
  console.log(`Wrote ${OUTPUT_JSON_PATH}`)
  console.log(`Wrote ${OUTPUT_MD_PATH}`)
}

function createSyntheticFixtureProject(fixture: FixtureDefinition): string {
  const dir = mkdtempSync(resolve(tmpdir(), `pluxx-docs-ingestion-${fixture.name}-`))
  mkdirSync(resolve(dir, 'skills/demo'), { recursive: true })
  writeFileSync(resolve(dir, 'skills/demo/SKILL.md'), '# Demo\n')
  writeFileSync(resolve(dir, 'INSTRUCTIONS.md'), `# ${fixture.label}\n`)
  writeFileSync(
    resolve(dir, 'pluxx.config.ts'),
    [
      `import { definePlugin } from ${JSON.stringify(resolve(REPO_ROOT, 'src/index.ts'))}`,
      '',
      'export default definePlugin({',
      `  name: ${JSON.stringify(`${fixture.name}-eval`)},`,
      `  description: ${JSON.stringify(`${fixture.label} docs ingestion evaluation fixture`)},`,
      "  author: { name: 'Pluxx' },",
      "  instructions: './INSTRUCTIONS.md',",
      "  skills: './skills',",
      "  targets: ['codex'],",
      '})',
      '',
    ].join('\n'),
  )
  return dir
}

async function runVariant(
  rootDir: string,
  fixture: FixtureDefinition,
  provider: 'baseline' | 'local' | 'firecrawl',
): Promise<VariantResult> {
  if (provider === 'firecrawl' && !FIRECRAWL_ENABLED) {
    return {
      provider,
      status: 'skipped',
      skipReason: 'FIRECRAWL_API_KEY not configured',
      contextInputs: [],
      matched: {
        productName: false,
        descriptionTerms: [],
        workflowTerms: [],
        setupTerms: [],
        authTerms: [],
        matchedCount: 0,
        expectedCount: countExpectedSignals(fixture.expectations),
      },
      sourceSummary: [],
    }
  }

  try {
    const options = provider === 'baseline'
      ? {}
      : {
          websiteUrl: fixture.websiteUrl,
          docsUrl: fixture.docsUrl,
          ingestProvider: provider as AgentIngestProvider,
        }
    const plan = await planAgentPrepare(rootDir, options)
    const files = new Map(plan.files.map((file) => [file.relativePath, file.content]))
    const docsContext = files.has(AGENT_DOCS_CONTEXT_PATH)
      ? JSON.parse(files.get(AGENT_DOCS_CONTEXT_PATH)!) as AgentDocsContextArtifact
      : undefined
    const sourcesPayload = files.has(AGENT_SOURCES_PATH)
      ? JSON.parse(files.get(AGENT_SOURCES_PATH)!) as {
          ingestion?: AgentContextIngestionArtifact
          sources: SourceRecord[]
        }
      : undefined
    const contextInputs = plan.contextInputs

    return {
      provider,
      status: 'ok',
      contextInputs,
      ingestion: sourcesPayload?.ingestion,
      docsContext,
      matched: evaluateMatches(docsContext, fixture.expectations),
      sourceSummary: (sourcesPayload?.sources ?? []).map((source) => ({
        label: source.label,
        role: source.role,
        status: source.status,
        provider: source.provider,
        note: source.note,
        httpStatus: source.httpStatus,
      })),
    }
  } catch (error) {
    return {
      provider,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      contextInputs: [],
      matched: {
        productName: false,
        descriptionTerms: [],
        workflowTerms: [],
        setupTerms: [],
        authTerms: [],
        matchedCount: 0,
        expectedCount: countExpectedSignals(fixture.expectations),
      },
      sourceSummary: [],
    }
  }
}

function countExpectedSignals(expectations: FixtureExpectation): number {
  return (expectations.productName ? 1 : 0)
    + (expectations.descriptionTerms?.length ?? 0)
    + (expectations.workflowTerms?.length ?? 0)
    + (expectations.setupTerms?.length ?? 0)
    + (expectations.authTerms?.length ?? 0)
}

function evaluateMatches(
  docsContext: AgentDocsContextArtifact | undefined,
  expectations: FixtureExpectation,
): VariantResult['matched'] {
  const productName = expectationMatchesText(docsContext?.productName, expectations.productName)
  const descriptionTerms = matchTerms(docsContext?.shortDescription, expectations.descriptionTerms ?? [])
  const workflowTerms = matchTerms((docsContext?.workflowHints ?? []).join(' '), expectations.workflowTerms ?? [])
  const setupTerms = matchTerms((docsContext?.setupHints ?? []).join(' '), expectations.setupTerms ?? [])
  const authTerms = matchTerms((docsContext?.authHints ?? []).join(' '), expectations.authTerms ?? [])
  const matchedCount = [
    productName ? 1 : 0,
    descriptionTerms.length,
    workflowTerms.length,
    setupTerms.length,
    authTerms.length,
  ].reduce((sum, value) => sum + value, 0)

  return {
    productName,
    descriptionTerms,
    workflowTerms,
    setupTerms,
    authTerms,
    matchedCount,
    expectedCount: countExpectedSignals(expectations),
  }
}

function expectationMatchesText(value: string | undefined, expected: string | undefined): boolean {
  if (!value || !expected) return false
  return value.toLowerCase().includes(expected.toLowerCase())
}

function matchTerms(haystack: string | undefined, terms: string[]): string[] {
  if (!haystack) return []
  const lower = haystack.toLowerCase()
  return terms.filter((term) => lower.includes(term.toLowerCase()))
}

function renderMarkdownReport(input: {
  version: number
  generatedAt: string
  firecrawlEnabled: boolean
  fixtureResults: FixtureResult[]
}): string {
  const lines: string[] = [
    '# Docs Ingestion Fixture Eval',
    '',
    `Generated: ${input.generatedAt}`,
    '',
    'This snapshot compares the current sourced-context extraction paths across real MCP-shaped product fixtures.',
    '',
    `- Firecrawl provider available: ${input.firecrawlEnabled ? 'yes' : 'no'}`,
    `- Baseline = existing scaffold context only (no website/docs inputs)`,
    `- Local = website/docs inputs through Pluxx local extraction`,
    `- Firecrawl = website/docs inputs through Firecrawl markdown extraction when a key is configured`,
    '',
  ]

  const summaryBullets = buildSummaryBullets(input.fixtureResults, input.firecrawlEnabled)
  if (summaryBullets.length > 0) {
    lines.push('## Current Read', '')
    for (const bullet of summaryBullets) {
      lines.push(`- ${bullet}`)
    }
    lines.push('')
  }

  for (const fixtureResult of input.fixtureResults) {
    const { fixture, results } = fixtureResult
    lines.push(`## ${fixture.label}`)
    lines.push('')
    lines.push(`- Fixture kind: ${fixture.fixtureKind}`)
    if (fixture.projectPath) {
      lines.push(`- Project: \`${fixture.projectPath.replace(`${REPO_ROOT}/`, '')}\``)
    }
    lines.push(`- Website: ${fixture.websiteUrl}`)
    lines.push(`- Docs: ${fixture.docsUrl}`)
    lines.push('')
    lines.push('| Provider | Status | Matched Signals | Product | Workflow Hints | Setup Hints | Auth Hints | Notes |')
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
    for (const result of results) {
      const notes = result.status === 'skipped'
        ? result.skipReason ?? 'skipped'
        : result.status === 'error'
          ? result.error ?? 'error'
          : summarizeSourceNotes(result.sourceSummary)
      lines.push(
        `| ${result.provider} | ${result.status} | ${result.matched.matchedCount}/${result.matched.expectedCount} | ${result.docsContext?.productName ?? '—'} | ${formatList(result.docsContext?.workflowHints)} | ${formatList(result.docsContext?.setupHints)} | ${formatList(result.docsContext?.authHints)} | ${escapePipe(notes)} |`,
      )
    }
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

function buildSummaryBullets(fixtureResults: FixtureResult[], firecrawlEnabled: boolean): string[] {
  const bullets: string[] = []
  const localImprovements = fixtureResults.filter((fixtureResult) => {
    const baseline = fixtureResult.results.find((result) => result.provider === 'baseline')
    const local = fixtureResult.results.find((result) => result.provider === 'local')
    return baseline?.status === 'ok' && local?.status === 'ok' && local.matched.matchedCount > baseline.matched.matchedCount
  })

  if (localImprovements.length > 0) {
    bullets.push(`local sourced context improved the baseline on ${localImprovements.length}/${fixtureResults.length} fixtures in this snapshot`)
  }

  if (!firecrawlEnabled) {
    bullets.push('the Firecrawl provider path is wired into the harness but was skipped in this snapshot because no FIRECRAWL_API_KEY was configured')
  }

  const firecrawlFixture = fixtureResults.find((fixtureResult) => fixtureResult.fixture.name === 'firecrawl')
  const firecrawlLocal = firecrawlFixture?.results.find((result) => result.provider === 'local')
  if (firecrawlLocal?.status === 'ok' && firecrawlLocal.matched.expectedCount > 0 && firecrawlLocal.matched.matchedCount < firecrawlLocal.matched.expectedCount) {
    bullets.push('Firecrawl remains the clearest weak case for the local OSS fallback: product name and auth signal land, but workflow/setup extraction is still noisy on that JS-heavy surface')
  }

  const playkitFixture = fixtureResults.find((fixtureResult) => fixtureResult.fixture.name === 'playkit')
  const playkitLocal = playkitFixture?.results.find((result) => result.provider === 'local')
  if (playkitLocal?.status === 'ok' && playkitLocal.matched.matchedCount === playkitLocal.matched.expectedCount) {
    bullets.push('PlayKit shows the local path can still work well when the docs root exposes strong setup and product language in server-rendered HTML')
  }

  const sumbleFixture = fixtureResults.find((fixtureResult) => fixtureResult.fixture.name === 'sumble')
  const sumbleLocal = sumbleFixture?.results.find((result) => result.provider === 'local')
  if (sumbleLocal?.status === 'ok' && sumbleLocal.matched.matchedCount > 0) {
    bullets.push('Sumble shows that even when docs-site detail is light, website + docs seeds can still recover useful product truth like product name and positioning')
  }

  return bullets
}

function summarizeSourceNotes(sources: VariantResult['sourceSummary']): string {
  if (sources.length === 0) return 'no external sources captured'
  const errored = sources.filter((source) => source.status !== 'ok')
  if (errored.length === 0) return 'all sources fetched successfully'
  return errored
    .map((source) => `${source.role}:${source.status}${source.httpStatus ? ` ${source.httpStatus}` : ''}`)
    .join(', ')
}

function formatList(values: string[] | undefined): string {
  if (!values || values.length === 0) return '—'
  return escapePipe(values.slice(0, 3).join(' / '))
}

function escapePipe(value: string): string {
  return value.replace(/\|/g, '\\|')
}

await main()
