import { cp, mkdtemp, mkdir, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { applyAgentPreparePlan, collectAgentContextPack, planAgentPrepare } from '../src/cli/agent'
import { applyMcpScaffoldPlan, planMcpScaffold, type McpScaffoldMetadata, type PersistedSkill } from '../src/cli/init-from-mcp'
import type { IntrospectedMcpServer, IntrospectedMcpTool } from '../src/mcp/introspect'
import type { TargetPlatform } from '../src/schema'

const ROOT = resolve(import.meta.dirname, '..')
const WEBSITE_URL = 'https://sumble.com'
const DOCS_URL = 'https://docs.sumble.com/api/mcp'
const METADATA_PATH = resolve(ROOT, 'example/sumble-plugin/.pluxx/mcp.json')
const OUTPUT_DIR = resolve(ROOT, 'docs/strategy/docs-ingestion-sumble-demo')
const TARGETS: TargetPlatform[] = ['claude-code', 'cursor', 'codex', 'opencode']

function toIntrospection(metadata: McpScaffoldMetadata): IntrospectedMcpServer {
  return {
    protocolVersion: '2025-03-26',
    serverInfo: metadata.serverInfo,
    tools: metadata.tools as IntrospectedMcpTool[],
    resources: metadata.resources,
    resourceTemplates: metadata.resourceTemplates,
    prompts: metadata.prompts,
  }
}

function toPersistedSkills(metadata: McpScaffoldMetadata): PersistedSkill[] {
  return metadata.skills.map((skill) => ({
    dirName: skill.dirName,
    title: skill.title,
    description: skill.description,
    toolNames: skill.toolNames,
  }))
}

async function main() {
  const metadata = JSON.parse(await readFile(METADATA_PATH, 'utf8')) as McpScaffoldMetadata
  const introspection = toIntrospection(metadata)
  const persistedSkills = toPersistedSkills(metadata)
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'pluxx-docs-ingestion-demo-'))
  const baselineRoot = resolve(tempRoot, 'baseline')
  const firecrawlRoot = resolve(tempRoot, 'firecrawl')

  await mkdir(baselineRoot, { recursive: true })
  await mkdir(firecrawlRoot, { recursive: true })
  await mkdir(OUTPUT_DIR, { recursive: true })

  const sharedPlanOptions = {
    pluginName: metadata.settings.pluginName,
    authorName: 'Orchid Labs',
    targets: TARGETS,
    source: metadata.source,
    introspection,
    displayName: metadata.settings.displayName,
    websiteUrl: WEBSITE_URL,
    skillGrouping: metadata.settings.skillGrouping,
    hookMode: metadata.settings.requestedHookMode,
    runtimeAuthMode: metadata.settings.runtimeAuthMode,
    persistedSkills,
  } as const

  const baselinePlan = await planMcpScaffold({
    rootDir: baselineRoot,
    ...sharedPlanOptions,
  })
  await applyMcpScaffoldPlan(baselineRoot, baselinePlan)

  const contextPack = await collectAgentContextPack(baselineRoot, {
    websiteUrl: WEBSITE_URL,
    docsUrl: DOCS_URL,
    ingestProvider: 'firecrawl',
  })

  if (!contextPack.docsContext) {
    throw new Error('Expected docs context from Firecrawl for the Sumble demo.')
  }

  const firecrawlPlan = await planMcpScaffold({
    rootDir: firecrawlRoot,
    ...sharedPlanOptions,
    description: contextPack.docsContext.shortDescription,
    sourcedContext: {
      workflowHints: contextPack.docsContext.workflowHints,
      setupHints: contextPack.docsContext.setupHints,
      authHints: contextPack.docsContext.authHints,
      warnings: contextPack.docsContext.warnings,
    },
  })
  await applyMcpScaffoldPlan(firecrawlRoot, firecrawlPlan)

  const preparePlan = await planAgentPrepare(firecrawlRoot, {
    websiteUrl: WEBSITE_URL,
    docsUrl: DOCS_URL,
    ingestProvider: 'firecrawl',
  })
  await applyAgentPreparePlan(firecrawlRoot, preparePlan)

  await cp(resolve(baselineRoot, 'INSTRUCTIONS.md'), resolve(OUTPUT_DIR, 'baseline-INSTRUCTIONS.md'))
  await cp(resolve(firecrawlRoot, 'INSTRUCTIONS.md'), resolve(OUTPUT_DIR, 'firecrawl-INSTRUCTIONS.md'))
  await cp(resolve(baselineRoot, 'pluxx.config.ts'), resolve(OUTPUT_DIR, 'baseline-pluxx.config.ts'))
  await cp(resolve(firecrawlRoot, 'pluxx.config.ts'), resolve(OUTPUT_DIR, 'firecrawl-pluxx.config.ts'))
  await cp(resolve(firecrawlRoot, '.pluxx/sources.json'), resolve(OUTPUT_DIR, 'sources.json'))
  await cp(resolve(firecrawlRoot, '.pluxx/docs-context.json'), resolve(OUTPUT_DIR, 'docs-context.json'))

  await rm(tempRoot, { recursive: true, force: true })

  console.log(`Wrote docs-ingestion demo artifacts to ${OUTPUT_DIR}`)
}

await main()
