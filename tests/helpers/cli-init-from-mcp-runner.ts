import { afterEach, describe, expect, it, mock } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'

const originalArgv = [...process.argv]
const originalCwd = process.cwd()
const CLI_INDEX_PATH = resolve(import.meta.dir, '../../src/cli/index.ts')
const INTROSPECT_PATH = resolve(import.meta.dir, '../../src/mcp/introspect.ts')
const INIT_FROM_MCP_PATH = resolve(import.meta.dir, '../../src/cli/init-from-mcp.ts')
const LINT_PATH = resolve(import.meta.dir, '../../src/cli/lint.ts')
const LOAD_CONFIG_PATH = resolve(import.meta.dir, '../../src/config/load.ts')
const GENERATORS_PATH = resolve(import.meta.dir, '../../src/generators/index.ts')
const INSTALL_PATH = resolve(import.meta.dir, '../../src/cli/install.ts')
const DEV_PATH = resolve(import.meta.dir, '../../src/cli/dev.ts')
const MIGRATE_PATH = resolve(import.meta.dir, '../../src/cli/migrate.ts')
const SYNC_PATH = resolve(import.meta.dir, '../../src/cli/sync-from-mcp.ts')
const originalStdinIsTTY = process.stdin.isTTY
const originalStdoutIsTTY = process.stdout.isTTY

type Issue = {
  level: 'error' | 'warning'
  code: string
  message: string
  file?: string
  platform?: string
}

function installMocks(options: {
  cancelToken?: symbol
  textResponses?: Array<string | symbol>
  selectResponses?: Array<string | symbol>
  lintResult?: {
    errors: number
    warnings: number
    issues: Issue[]
  }
}) {
  const CANCEL = options.cancelToken ?? Symbol('cancel')
  const calls = {
    cancel: [] as string[],
    success: [] as string[],
    warn: [] as string[],
    error: [] as string[],
    note: [] as Array<{ title: string; message: string }>,
  }
  const textQueue = [...(options.textResponses ?? [])]
  const selectQueue = [...(options.selectResponses ?? [])]

  mock.module('@clack/prompts', () => ({
    intro() {},
    outro() {},
    note(message: string, title: string) {
      calls.note.push({ title, message })
    },
    spinner() {
      return {
        start() {},
        stop() {},
      }
    },
    log: {
      step() {},
      info() {},
      success(message: string) {
        calls.success.push(message)
      },
      warn(message: string) {
        calls.warn.push(message)
      },
      error(message: string) {
        calls.error.push(message)
      },
    },
    cancel(message: string) {
      calls.cancel.push(message)
    },
    text: async () => textQueue.shift() ?? '',
    select: async () => selectQueue.shift() ?? 'workflow',
    isCancel(value: unknown) {
      return value === CANCEL
    },
  }))

  mock.module(INTROSPECT_PATH, () => ({
    McpIntrospectionError: class McpIntrospectionError extends Error {
      status?: number
      constructor(message: string, status?: number) {
        super(message)
        this.name = 'McpIntrospectionError'
        this.status = status
      }
    },
    discoverMcpAuthFromError: () => null,
    introspectMcpServer: async () => ({
      serverInfo: {
        name: 'stub-server',
        title: 'Stub Server',
        version: '1.0.0',
        description: 'A fake MCP server for CLI tests.',
      },
      instructions: 'Use the fake tools carefully.',
      tools: [
        {
          name: 'FindOrganizations',
          description: 'Search organizations.',
          inputSchema: { type: 'object', properties: {}, required: [] },
        },
      ],
    }),
  }))

  mock.module(INIT_FROM_MCP_PATH, () => ({
    analyzeMcpQuality: () => ({
      ok: true,
      warnings: 0,
      infos: 0,
      issues: [],
    }),
    MCP_HOOK_MODES: ['none', 'safe'],
    MCP_RUNTIME_AUTH_MODES: ['inline', 'platform'],
    MCP_SCAFFOLD_METADATA_PATH: '.pluxx/mcp.json',
    MCP_SKILL_GROUPINGS: ['workflow', 'tool'],
    MCP_TAXONOMY_PATH: '.pluxx/taxonomy.json',
    PLUXX_CUSTOM_END: '<!-- pluxx:custom:end -->',
    PLUXX_CUSTOM_START: '<!-- pluxx:custom:start -->',
    PLUXX_GENERATED_END: '<!-- pluxx:generated:end -->',
    PLUXX_GENERATED_START: '<!-- pluxx:generated:start -->',
    applyMcpScaffoldPlan: async () => {},
    buildToolExampleRequest: () => 'Find organizations for Acme',
    deriveDisplayName: () => 'Stub Server',
    derivePluginName: () => 'stub-server',
    extractMixedMarkdownContent: () => ({ hasMarkers: true, customContent: '' }),
    hasMeaningfulCustomContent: () => false,
    planMcpScaffold: async () => ({
      generatedFiles: ['pluxx.config.ts', './INSTRUCTIONS.md'],
      generatedHookMode: 'none',
      generatedHookEvents: [],
      instructionsPath: 'INSTRUCTIONS.md',
      skillDirectories: ['skills/account-research'],
      metadataPath: '.pluxx/mcp.json',
      files: [
        { relativePath: 'pluxx.config.ts', content: '', action: 'create' },
        { relativePath: './INSTRUCTIONS.md', content: '', action: 'create' },
      ],
    }),
    writeMcpScaffold: async () => ({
      generatedFiles: ['pluxx.config.ts', './INSTRUCTIONS.md'],
      generatedHookMode: 'none',
      generatedHookEvents: [],
      instructionsPath: 'INSTRUCTIONS.md',
      skillDirectories: ['skills/account-research'],
      metadataPath: '.pluxx/mcp.json',
    }),
    parseMcpSourceInput: (raw: string) => ({ transport: 'http', url: raw }),
  }))

  mock.module(LINT_PATH, () => ({
    lintProject: async () => options.lintResult ?? {
      errors: 0,
      warnings: 0,
      issues: [],
    },
    printLintResult() {},
    runLint: async () => 0,
  }))

  mock.module(LOAD_CONFIG_PATH, () => ({
    CONFIG_FILES: ['pluxx.config.ts', 'pluxx.config.js', 'pluxx.config.json'],
    loadConfig: async () => {
      throw new Error('loadConfig should not be called in init --from-mcp tests')
    },
  }))

  mock.module(GENERATORS_PATH, () => ({
    build: async () => {
      throw new Error('build should not be called in init --from-mcp tests')
    },
  }))

  mock.module(INSTALL_PATH, () => ({
    ensureHookTrust: async () => {},
    installPlugin: async () => {},
    listHookCommands: () => [],
    planInstallPlugin: () => [],
    planInstallUserConfig: () => ({ requirements: [], notes: [] }),
    resolveInstallUserConfig: async () => ({ values: {}, unresolved: [], provided: [] }),
    uninstallPlugin: async () => {},
  }))

  mock.module(DEV_PATH, () => ({
    runDev: async () => {},
  }))

  mock.module(MIGRATE_PATH, () => ({
    migrate: async () => {},
  }))

  mock.module(SYNC_PATH, () => ({
    applyPersistedTaxonomy: async () => {},
    formatSyncSummary: () => [],
    planSyncFromMcp: async () => ({
      updatedFiles: [],
      removedFiles: [],
      preservedFiles: [],
      skippedFiles: [],
    }),
    syncFromMcp: async () => ({
      updatedFiles: [],
      removedFiles: [],
      preservedFiles: [],
      skippedFiles: [],
    }),
  }))

  return { calls }
}

async function loadCli(tag: string) {
  return await import(`${CLI_INDEX_PATH}?${tag}`)
}

afterEach(() => {
  process.argv = [...originalArgv]
  process.chdir(originalCwd)
  Object.defineProperty(process.stdin, 'isTTY', { value: originalStdinIsTTY, configurable: true })
  Object.defineProperty(process.stdout, 'isTTY', { value: originalStdoutIsTTY, configurable: true })
  mock.restore()
})

describe('isolated init --from-mcp CLI checks', () => {
  it('treats clack cancellation as a clean exit', async () => {
    const cwd = mkdtempSync(resolve(tmpdir(), 'pluxx-init-cancel-'))

    try {
      process.chdir(cwd)
      Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true })
      Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true })
      process.argv = ['bun', 'pluxx', 'init', '--from-mcp', 'https://example.com/mcp']
      const cancelToken = Symbol('cancel')

      const { calls } = installMocks({
        cancelToken,
        textResponses: [cancelToken],
      })

      const { main } = await loadCli('cancel')

      await expect(main()).resolves.toBeUndefined()
      expect(calls.cancel).toEqual(['Init cancelled'])
      expect(calls.error).toEqual([])
      expect(calls.warn).toEqual([])
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  it('logs lint errors and warnings at the correct severity', async () => {
    const cwd = mkdtempSync(resolve(tmpdir(), 'pluxx-init-severity-'))

    try {
      process.chdir(cwd)
      Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true })
      Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true })
      process.argv = ['bun', 'pluxx', 'init', '--from-mcp', 'https://example.com/mcp']

      const { calls } = installMocks({
        textResponses: ['stub-server', 'Stub Server', 'Test Author', 'claude-code,codex'],
        selectResponses: ['workflow', 'none'],
        lintResult: {
          errors: 1,
          warnings: 1,
          issues: [
            { level: 'error', code: 'bad-rule', message: 'broken rule' },
            { level: 'warning', code: 'warn-rule', message: 'soft warning' },
          ],
        },
      })

      const { main } = await loadCli('severity')

      await expect(main()).resolves.toBeUndefined()
      expect(calls.cancel).toEqual([])
      expect(calls.error.some((message) => message === 'Lint: 1 errors, 1 warnings')).toBe(true)
      expect(calls.error.some((message) => message.includes('bad-rule'))).toBe(true)
      expect(calls.warn.some((message) => message.includes('warn-rule'))).toBe(true)
      expect(calls.success).toEqual([])
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })
})
