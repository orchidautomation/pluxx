export const DOCS_INGESTION_PROVIDERS = ['auto', 'firecrawl', 'local'] as const

export type DocsIngestionProvider = typeof DOCS_INGESTION_PROVIDERS[number]
export type DocsIngestionResolvedProvider = Exclude<DocsIngestionProvider, 'auto'>

export interface FirecrawlAvailability {
  available: boolean
  envVar: 'FIRECRAWL_API_KEY'
  baseUrlEnvVar: 'FIRECRAWL_BASE_URL'
  baseUrl: string
  reason: string
}

export interface DocsIngestionSelection {
  requestedProvider: DocsIngestionProvider
  resolvedProvider: DocsIngestionResolvedProvider
  fallbackOrder: DocsIngestionResolvedProvider[]
  firecrawl: FirecrawlAvailability
}

export function isDocsIngestionProvider(value: string): value is DocsIngestionProvider {
  return DOCS_INGESTION_PROVIDERS.includes(value as DocsIngestionProvider)
}

export function resolveDocsIngestionProvider(
  requestedProvider: DocsIngestionProvider = 'auto',
  env: NodeJS.ProcessEnv = process.env,
): DocsIngestionSelection {
  const firecrawl = detectFirecrawlAvailability(env)

  if (requestedProvider === 'firecrawl') {
    if (!firecrawl.available) {
      throw new Error(`Docs ingestion provider \"firecrawl\" requires FIRECRAWL_API_KEY in the environment.`)
    }

    return {
      requestedProvider,
      resolvedProvider: 'firecrawl',
      fallbackOrder: ['firecrawl', 'local'],
      firecrawl,
    }
  }

  if (requestedProvider === 'local') {
    return {
      requestedProvider,
      resolvedProvider: 'local',
      fallbackOrder: ['local'],
      firecrawl,
    }
  }

  return {
    requestedProvider,
    resolvedProvider: firecrawl.available ? 'firecrawl' : 'local',
    fallbackOrder: ['firecrawl', 'local'],
    firecrawl,
  }
}

function detectFirecrawlAvailability(env: NodeJS.ProcessEnv): FirecrawlAvailability {
  const apiKey = env.FIRECRAWL_API_KEY?.trim()
  const baseUrl = env.FIRECRAWL_BASE_URL?.trim() || 'https://api.firecrawl.dev'

  if (!apiKey) {
    return {
      available: false,
      envVar: 'FIRECRAWL_API_KEY',
      baseUrlEnvVar: 'FIRECRAWL_BASE_URL',
      baseUrl,
      reason: 'FIRECRAWL_API_KEY is not set.',
    }
  }

  return {
    available: true,
    envVar: 'FIRECRAWL_API_KEY',
    baseUrlEnvVar: 'FIRECRAWL_BASE_URL',
    baseUrl,
    reason: `Using ${baseUrl}.`,
  }
}
