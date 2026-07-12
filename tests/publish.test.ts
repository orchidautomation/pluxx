import { afterEach, describe, expect, it } from 'bun:test'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { resolve } from 'path'
import type { PluginConfig, TargetPlatform } from '../src/schema'
import { planPublish, runPublish } from '../src/cli/publish'
import {
  makeSecretReferenceFixtureConfig,
  SECRET_REFERENCE_ENV_VAR,
  SECRET_REFERENCE_SENTINEL,
  SECRET_REFERENCE_WORKSPACE_ENV_VAR,
  SECRET_REFERENCE_WORKSPACE_SENTINEL,
} from '../test-fixtures/secret-reference-fixture'

const ROOT = resolve(import.meta.dir, '.publish-fixture')

function makeConfig(): PluginConfig {
  return {
    name: 'publish-plugin',
    version: '1.2.3',
    description: 'A publish test plugin',
    author: { name: 'Test Author' },
    license: 'MIT',
    repository: 'https://github.com/orchidautomation/publish-plugin',
    skills: './skills/',
    instructions: './INSTRUCTIONS.md',
    targets: ['claude-code', 'opencode'],
    outDir: './dist',
  }
}

function prepareBuiltTarget(platform: string, extraFiles: Record<string, string> = {}): void {
  const dir = resolve(ROOT, 'dist', platform)
  mkdirSync(dir, { recursive: true })
  for (const [relativePath, content] of Object.entries(extraFiles)) {
    const fullPath = resolve(dir, relativePath)
    mkdirSync(resolve(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, content)
  }
}

interface CodexInstallerRunOptions {
  configText?: string
  env?: Record<string, string>
}

interface CodexInstallerRunResult {
  status: number | null
  stdout: string
  stderr: string
  configText?: string
  installerContent: string
}

const CODEX_HOOK_FILES = {
  '.codex-plugin/plugin.json': JSON.stringify({
    name: 'publish-plugin',
    version: '1.2.3',
    hooks: './hooks/hooks.json',
  }),
  'hooks/hooks.json': JSON.stringify({
    hooks: {
      SessionStart: [
        {
          hooks: [
            { type: 'command', command: 'echo startup' },
          ],
        },
      ],
    },
  }),
}

const GENERATED_INSTALLER_FIXTURE_FILES: Record<TargetPlatform, Record<string, string>> = {
  'claude-code': {
    '.claude-plugin/plugin.json': JSON.stringify({
      name: 'publish-plugin',
      version: '1.2.3',
      description: 'A publish test plugin',
    }),
  },
  cursor: {
    '.cursor-plugin/plugin.json': JSON.stringify({
      name: 'publish-plugin',
      version: '1.2.3',
      description: 'A publish test plugin',
    }),
  },
  codex: {
    '.codex-plugin/plugin.json': JSON.stringify({
      name: 'publish-plugin',
      version: '1.2.3',
    }),
  },
  opencode: {
    'package.json': JSON.stringify({
      name: '@orchid/publish-plugin-opencode',
      version: '1.2.3',
      type: 'module',
    }),
    'index.ts': 'export const PublishPlugin = async () => ({})\n',
  },
  'github-copilot': {},
  openhands: {},
  warp: {},
  'gemini-cli': {},
  'roo-code': {},
  cline: {},
  amp: {},
}

let generatedInstallerRunCount = 0

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function prepareBuiltTargetAt(rootDir: string, platform: string, extraFiles: Record<string, string> = {}): void {
  const dir = resolve(rootDir, 'dist', platform)
  mkdirSync(dir, { recursive: true })
  for (const [relativePath, content] of Object.entries(extraFiles)) {
    const fullPath = resolve(dir, relativePath)
    mkdirSync(resolve(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, content)
  }
}

function makeUserConfigInstallerConfig(platform: TargetPlatform, required = true): PluginConfig {
  return {
    ...makeConfig(),
    targets: [platform],
    userConfig: [
      {
        key: 'instantly-api-key',
        title: 'Instantly API Key',
        type: 'secret',
        required,
        envVar: 'SENDLENS_INSTANTLY_API_KEY',
      },
    ],
  }
}

function makeRuntimeStdioInstallerConfig(platform: TargetPlatform): PluginConfig {
  return {
    ...makeConfig(),
    targets: [platform],
    userConfig: [
      {
        key: 'workspace-marker',
        title: 'Workspace Marker',
        type: 'string',
        required: true,
        envVar: 'WORKSPACE_MARKER',
      },
      {
        key: 'workspace-client',
        title: 'Workspace Client',
        type: 'string',
        required: true,
        envVar: 'WORKSPACE_CLIENT',
      },
      {
        key: 'workspace-store-path',
        title: 'Workspace Store Path',
        type: 'string',
        required: true,
        envVar: 'WORKSPACE_STORE_PATH',
      },
    ],
    mcp: {
      workspace: {
        transport: 'stdio',
        command: 'bash',
        args: ['./scripts/start-mcp.sh'],
        env: {
          WORKSPACE_MARKER: '${WORKSPACE_MARKER}',
          WORKSPACE_CLIENT: '${WORKSPACE_CLIENT}',
          WORKSPACE_STORE_PATH: '${WORKSPACE_STORE_PATH}',
          PLUGIN_MODE: 'local',
        },
      },
    },
  }
}

function stdioMcpFileForPlatform(platform: TargetPlatform): Record<string, string> {
  if (platform === 'opencode') return {}
  const relativePath = platform === 'cursor' ? 'mcp.json' : '.mcp.json'
  const runtimePath = platform === 'claude-code'
    ? '${CLAUDE_PLUGIN_ROOT}/runtime/pluxx-mcp-env.mjs'
    : './runtime/pluxx-mcp-env.mjs'
  const startScriptPath = platform === 'claude-code'
    ? '${CLAUDE_PLUGIN_ROOT}/scripts/start-mcp.sh'
    : './scripts/start-mcp.sh'
  return {
    [relativePath]: JSON.stringify({
      mcpServers: {
        workspace: {
          command: 'node',
          args: [
            runtimePath,
            '["WORKSPACE_CLIENT","WORKSPACE_MARKER","WORKSPACE_STORE_PATH"]',
            '--',
            'bash',
            startScriptPath,
          ],
          env: {
            PLUGIN_MODE: 'local',
          },
        },
      },
    }, null, 2),
    'scripts/start-mcp.sh': '#!/usr/bin/env bash\nexit 0\n',
    'runtime/pluxx-mcp-env.mjs': '#!/usr/bin/env node\nprocess.exit(0)\n',
  }
}

interface GeneratedInstallerRunOptions {
  config?: PluginConfig
  env?: Record<string, string>
  existingUserConfig?: unknown
  extraFiles?: Record<string, string>
  setupPaths?: (paths: ReturnType<typeof getGeneratedInstallerPaths>, rootDir: string) => void
}

interface GeneratedInstallerRunResult {
  rootDir: string
  status: number | null
  stdout: string
  stderr: string
  installerContent: string
  pluginInstallDir: string
  installedUserConfig?: {
    values?: Record<string, unknown>
    env?: Record<string, unknown>
    envRefs?: Record<string, unknown>
  }
}

function getGeneratedInstallerPaths(platform: TargetPlatform, rootDir: string): {
  installDir: string
  pluginInstallDir: string
  env: Record<string, string>
} {
  if (platform === 'claude-code') {
    const installRoot = resolve(rootDir, 'claude-marketplace')
    return {
      installDir: installRoot,
      pluginInstallDir: resolve(installRoot, 'plugins/publish-plugin'),
      env: {
        PLUXX_CLAUDE_MARKETPLACE_DIR: installRoot,
        PLUXX_CLAUDE_SKIP_INSTALL: '1',
      },
    }
  }

  if (platform === 'cursor') {
    const installDir = resolve(rootDir, 'installed-cursor')
    return {
      installDir,
      pluginInstallDir: installDir,
      env: { PLUXX_CURSOR_INSTALL_DIR: installDir },
    }
  }

  if (platform === 'codex') {
    const installDir = resolve(rootDir, 'installed-codex')
    return {
      installDir,
      pluginInstallDir: installDir,
      env: {
        PLUXX_CODEX_INSTALL_DIR: installDir,
        PLUXX_CODEX_MARKETPLACE_PATH: resolve(rootDir, 'codex-marketplace.json'),
        PLUXX_CODEX_CONFIG_PATH: resolve(rootDir, 'codex-config.toml'),
      },
    }
  }

  if (platform === 'opencode') {
    const installDir = resolve(rootDir, 'installed-opencode')
    return {
      installDir,
      pluginInstallDir: installDir,
      env: {
        PLUXX_OPENCODE_INSTALL_DIR: installDir,
        PLUXX_OPENCODE_ENTRY_PATH: resolve(rootDir, 'publish-plugin.ts'),
        PLUXX_OPENCODE_SKILLS_ROOT: resolve(rootDir, 'opencode-skills'),
      },
    }
  }

  throw new Error(`Unsupported generated installer test platform: ${platform}`)
}

function runGeneratedInstaller(
  platform: TargetPlatform,
  options: GeneratedInstallerRunOptions = {},
): GeneratedInstallerRunResult {
  const rootDir = resolve(ROOT, `generated-installer-${platform}-${generatedInstallerRunCount++}`)
  const config = options.config ?? makeUserConfigInstallerConfig(platform)
  const paths = getGeneratedInstallerPaths(platform, rootDir)
  const fixtureFiles = {
    ...GENERATED_INSTALLER_FIXTURE_FILES[platform],
    ...(options.extraFiles ?? {}),
  }
  prepareBuiltTargetAt(rootDir, platform, fixtureFiles)

  if (options.existingUserConfig !== undefined) {
    mkdirSync(paths.pluginInstallDir, { recursive: true })
    writeFileSync(
      resolve(paths.pluginInstallDir, '.pluxx-user.json'),
      JSON.stringify(options.existingUserConfig, null, 2) + '\n',
    )
  }
  options.setupPaths?.(paths, rootDir)

  let installerRun: GeneratedInstallerRunResult | undefined
  const result = runPublish(config, {
    rootDir,
    requestedChannels: ['github-release'],
    runCommand: (command, args, commandOptions) => {
      if (command === 'tar') {
        const proc = spawnSync(command, args, {
          cwd: commandOptions?.cwd,
          encoding: 'utf-8',
        })
        return {
          status: proc.status,
          stdout: proc.stdout ?? '',
          stderr: proc.stderr ?? '',
        }
      }

      if (command === 'git') return { status: 0, stdout: '', stderr: '' }
      if (command === 'gh' && args[0] === 'auth') return { status: 0, stdout: '', stderr: '' }
      if (command === 'gh' && args[0] === 'release' && args[1] === 'view') return { status: 1, stdout: '', stderr: 'missing' }
      if (command === 'gh' && args[0] === 'release' && args[1] === 'create') {
        const scriptName = platform === 'claude-code' ? 'install-claude-code.sh' : `install-${platform}.sh`
        const installerPath = args.find((value) => typeof value === 'string' && value.endsWith(`/${scriptName}`))
        const archivePath = args.find((value) => typeof value === 'string' && value.endsWith(`/${config.name}-${platform}-latest.tar.gz`))

        const env: Record<string, string> = {
          ...process.env,
          HOME: resolve(rootDir, 'home'),
          ...paths.env,
          ...options.env,
        }

        if (platform === 'claude-code') env.PLUXX_CLAUDE_BUNDLE_PATH = archivePath!
        if (platform === 'cursor') env.PLUXX_CURSOR_BUNDLE_PATH = archivePath!
        if (platform === 'codex') env.PLUXX_CODEX_BUNDLE_PATH = archivePath!
        if (platform === 'opencode') env.PLUXX_OPENCODE_BUNDLE_PATH = archivePath!

        const proc = spawnSync('bash', [installerPath!], {
          encoding: 'utf-8',
          env,
        })
        const userConfigPath = resolve(paths.pluginInstallDir, '.pluxx-user.json')
        installerRun = {
          rootDir,
          status: proc.status,
          stdout: proc.stdout ?? '',
          stderr: proc.stderr ?? '',
          installerContent: readFileSync(installerPath!, 'utf-8'),
          pluginInstallDir: paths.pluginInstallDir,
          installedUserConfig: existsSync(userConfigPath)
            ? JSON.parse(readFileSync(userConfigPath, 'utf-8'))
            : undefined,
        }
        return { status: 0, stdout: 'created', stderr: '' }
      }
      return { status: 0, stdout: '', stderr: '' }
    },
  })

  expect(result.ok).toBe(true)
  expect(installerRun).toBeDefined()
  return installerRun!
}

function runGeneratedCodexInstaller(
  extraFiles: Record<string, string>,
  options: CodexInstallerRunOptions = {},
): CodexInstallerRunResult {
  const config: PluginConfig = {
    ...makeConfig(),
    targets: ['codex'],
  }
  prepareBuiltTarget('codex', extraFiles)

  const configPath = resolve(ROOT, 'codex-config.toml')
  if (options.configText !== undefined) {
    mkdirSync(resolve(configPath, '..'), { recursive: true })
    writeFileSync(configPath, options.configText)
  }

  let installerRun: CodexInstallerRunResult | undefined
  const result = runPublish(config, {
    rootDir: ROOT,
    requestedChannels: ['github-release'],
    runCommand: (command, args, commandOptions) => {
      if (command === 'tar') {
        const proc = spawnSync(command, args, {
          cwd: commandOptions?.cwd,
          encoding: 'utf-8',
        })
        return {
          status: proc.status,
          stdout: proc.stdout ?? '',
          stderr: proc.stderr ?? '',
        }
      }

      if (command === 'git') return { status: 0, stdout: '', stderr: '' }
      if (command === 'gh' && args[0] === 'auth') return { status: 0, stdout: '', stderr: '' }
      if (command === 'gh' && args[0] === 'release' && args[1] === 'view') return { status: 1, stdout: '', stderr: 'missing' }
      if (command === 'gh' && args[0] === 'release' && args[1] === 'create') {
        const installerPath = args.find((value) => typeof value === 'string' && value.endsWith('/install-codex.sh'))
        const archivePath = args.find((value) => typeof value === 'string' && value.endsWith('/publish-plugin-codex-latest.tar.gz'))
        const proc = spawnSync('bash', [installerPath!], {
          encoding: 'utf-8',
          env: {
            ...process.env,
            ...options.env,
            CODEX_HOME: options.env?.CODEX_HOME ?? resolve(ROOT, 'codex-home'),
            PLUXX_CODEX_BUNDLE_PATH: archivePath!,
            PLUXX_CODEX_INSTALL_DIR: resolve(ROOT, 'installed-codex'),
            PLUXX_CODEX_MARKETPLACE_PATH: resolve(ROOT, 'codex-marketplace.json'),
            PLUXX_CODEX_CONFIG_PATH: configPath,
          },
        })
        installerRun = {
          status: proc.status,
          stdout: proc.stdout ?? '',
          stderr: proc.stderr ?? '',
          configText: existsSync(configPath) ? readFileSync(configPath, 'utf-8') : undefined,
          installerContent: readFileSync(installerPath!, 'utf-8'),
        }
        return { status: 0, stdout: 'created', stderr: '' }
      }
      return { status: 0, stdout: '', stderr: '' }
    },
  })

  expect(result.ok).toBe(true)
  expect(installerRun).toBeDefined()
  return installerRun!
}

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('planPublish', () => {
  it('resolves target-aware default channels from built outputs', () => {
    const config = makeConfig()
    prepareBuiltTarget('claude-code', { '.claude-plugin/plugin.json': '{}' })
    prepareBuiltTarget('opencode', {
      'package.json': JSON.stringify({ name: '@orchid/publish-plugin-opencode' }),
      'index.ts': 'export {}',
    })

    const plan = planPublish(config, {
      rootDir: ROOT,
      dryRun: true,
      runCommand: (command) => {
        if (command === 'git') return { status: 0, stdout: '', stderr: '' }
        if (command === 'npm') return { status: 0, stdout: 'orchidautomation\n', stderr: '' }
        if (command === 'gh') return { status: 0, stdout: '', stderr: '' }
        return { status: 0, stdout: '', stderr: '' }
      },
    })

    expect(plan.channels.npm.enabled).toBe(true)
    expect(plan.channels.githubRelease.enabled).toBe(true)
    expect(plan.channels.npm.packageName).toBe('@orchid/publish-plugin-opencode')
    expect(plan.channels.githubRelease.repo).toBe('orchidautomation/publish-plugin')
    expect(plan.channels.githubRelease.assets.map((asset) => asset.name)).toEqual([
      'publish-plugin-claude-code-v1.2.3.tar.gz',
      'publish-plugin-claude-code-latest.tar.gz',
      'publish-plugin-opencode-v1.2.3.tar.gz',
      'publish-plugin-opencode-latest.tar.gz',
      'install-claude-code.sh',
      'install-opencode.sh',
      'install.sh',
      'install-all.sh',
      'release-manifest.json',
      'SHA256SUMS.txt',
    ])
    expect(plan.checks.every((check) => check.ok)).toBe(true)
  })

  it('disables npm by default when no npm-backed target is built', () => {
    const config = makeConfig()
    prepareBuiltTarget('claude-code', { '.claude-plugin/plugin.json': '{}' })

    const plan = planPublish(config, {
      rootDir: ROOT,
      dryRun: true,
      runCommand: (command) => {
        if (command === 'git') return { status: 0, stdout: '', stderr: '' }
        if (command === 'gh') return { status: 0, stdout: '', stderr: '' }
        return { status: 0, stdout: '', stderr: '' }
      },
    })

    expect(plan.channels.npm.enabled).toBe(false)
    expect(plan.channels.githubRelease.enabled).toBe(true)
  })

  it('reports failed prechecks for dirty git and missing npm auth', () => {
    const config = makeConfig()
    prepareBuiltTarget('opencode', {
      'package.json': JSON.stringify({ name: '@orchid/publish-plugin-opencode' }),
      'index.ts': 'export {}',
    })

    const plan = planPublish(config, {
      rootDir: ROOT,
      dryRun: true,
      requestedChannels: ['npm'],
      runCommand: (command) => {
        if (command === 'git') return { status: 0, stdout: ' M README.md\n', stderr: '' }
        if (command === 'npm') return { status: 1, stdout: '', stderr: 'not logged in' }
        return { status: 0, stdout: '', stderr: '' }
      },
    })

    expect(plan.checks.some((check) => check.code === 'git-clean' && !check.ok)).toBe(true)
    expect(plan.checks.some((check) => check.code === 'npm-auth' && !check.ok)).toBe(true)
  })
})

describe('runPublish', () => {
  it('executes npm publish for the npm channel when checks pass', () => {
    const config = makeConfig()
    prepareBuiltTarget('opencode', {
      'package.json': JSON.stringify({ name: '@orchid/publish-plugin-opencode' }),
      'index.ts': 'export {}',
    })

    const calls: Array<{ command: string; args: string[]; cwd?: string }> = []
    const result = runPublish(config, {
      rootDir: ROOT,
      requestedChannels: ['npm'],
      runCommand: (command, args, options) => {
        calls.push({ command, args, cwd: options?.cwd })
        if (command === 'git') return { status: 0, stdout: '', stderr: '' }
        if (command === 'npm' && args[0] === 'whoami') return { status: 0, stdout: 'orchidautomation\n', stderr: '' }
        if (command === 'npm' && args[0] === 'publish') return { status: 0, stdout: 'published', stderr: '' }
        return { status: 0, stdout: '', stderr: '' }
      },
    })

    expect(result.ok).toBe(true)
    expect(result.execution?.npm?.ok).toBe(true)
    expect(calls.some((call) => call.command === 'npm' && call.args[0] === 'publish')).toBe(true)
  })

  it('packages consumer-facing release assets for github releases', () => {
    const config = makeConfig()
    prepareBuiltTarget('claude-code', { '.claude-plugin/plugin.json': JSON.stringify({ name: 'publish-plugin', version: '1.2.3' }) })
    prepareBuiltTarget('opencode', {
      'package.json': JSON.stringify({ name: '@orchid/publish-plugin-opencode' }),
      'index.ts': 'export {}',
    })

    const calls: Array<{ command: string; args: string[]; cwd?: string }> = []
    const result = runPublish(config, {
      rootDir: ROOT,
      requestedChannels: ['github-release'],
      runCommand: (command, args, options) => {
        calls.push({ command, args, cwd: options?.cwd })

        if (command === 'tar') {
          const proc = spawnSync(command, args, {
            cwd: options?.cwd,
            encoding: 'utf-8',
          })
          return {
            status: proc.status,
            stdout: proc.stdout ?? '',
            stderr: proc.stderr ?? '',
          }
        }

        if (command === 'git') return { status: 0, stdout: '', stderr: '' }
        if (command === 'gh' && args[0] === 'auth') return { status: 0, stdout: '', stderr: '' }
        if (command === 'gh' && args[0] === 'release' && args[1] === 'view') return { status: 1, stdout: '', stderr: 'missing' }
        if (command === 'gh' && args[0] === 'release' && args[1] === 'create') return { status: 0, stdout: 'created', stderr: '' }
        return { status: 0, stdout: '', stderr: '' }
      },
    })

    expect(result.ok).toBe(true)
    expect(result.execution?.githubRelease?.ok).toBe(true)

    const ghCreateCall = calls.find((call) => call.command === 'gh' && call.args[0] === 'release' && call.args[1] === 'create')
    expect(ghCreateCall).toBeDefined()

    const uploadedAssetNames = (ghCreateCall?.args ?? [])
      .filter((value) => value.startsWith('/') && !value.endsWith('.tmp'))
      .map((value) => value.split('/').pop())
      .filter(Boolean)

    expect(uploadedAssetNames).toEqual(expect.arrayContaining([
      'publish-plugin-claude-code-v1.2.3.tar.gz',
      'publish-plugin-claude-code-latest.tar.gz',
      'publish-plugin-opencode-v1.2.3.tar.gz',
      'publish-plugin-opencode-latest.tar.gz',
      'install-claude-code.sh',
      'install-opencode.sh',
      'install.sh',
      'install-all.sh',
      'release-manifest.json',
      'SHA256SUMS.txt',
    ]))
  })

  it('generates a top-level installer that routes supported agent hosts', () => {
    const config: PluginConfig = {
      ...makeConfig(),
      targets: ['claude-code', 'cursor', 'codex', 'opencode'],
    }

    for (const platform of config.targets) {
      prepareBuiltTarget(platform, GENERATED_INSTALLER_FIXTURE_FILES[platform])
    }

    let installerContent = ''
    let manifestContent = ''
    const result = runPublish(config, {
      rootDir: ROOT,
      requestedChannels: ['github-release'],
      runCommand: (command, args, options) => {
        if (command === 'tar') {
          const proc = spawnSync(command, args, {
            cwd: options?.cwd,
            encoding: 'utf-8',
          })
          return {
            status: proc.status,
            stdout: proc.stdout ?? '',
            stderr: proc.stderr ?? '',
          }
        }

        if (command === 'git') return { status: 0, stdout: '', stderr: '' }
        if (command === 'gh' && args[0] === 'release' && args[1] === 'view') return { status: 1, stdout: '', stderr: 'missing' }
        if (command === 'gh' && args[0] === 'release' && args[1] === 'create') {
          const installerPath = args.find((value) => typeof value === 'string' && value.endsWith('/install.sh'))
          const manifestPath = args.find((value) => typeof value === 'string' && value.endsWith('/release-manifest.json'))
          installerContent = readFileSync(installerPath!, 'utf-8')
          manifestContent = readFileSync(manifestPath!, 'utf-8')
          return { status: 0, stdout: 'created', stderr: '' }
        }
        return { status: 0, stdout: '', stderr: '' }
      },
    })

    expect(result.ok).toBe(true)
    expect(installerContent).toContain('--agents|--all')
    expect(installerContent).toContain('--claude-code)')
    expect(installerContent).toContain('--cursor)')
    expect(installerContent).toContain('--codex)')
    expect(installerContent).toContain('--opencode)')
    expect(installerContent).toContain('targets=("claude-code" "cursor" "codex" "opencode")')
    expect(installerContent).toContain('PLUXX_CODEX_ENABLE_PLUGIN_HOOKS')
    expect(installerContent).toContain('PLUXX_CLAUDE_BUNDLE_URL="${PLUXX_CLAUDE_BUNDLE_URL:-$base_url/publish-plugin-claude-code-latest.tar.gz}"')
    expect(installerContent).toContain('PLUXX_CURSOR_BUNDLE_URL="${PLUXX_CURSOR_BUNDLE_URL:-$base_url/publish-plugin-cursor-latest.tar.gz}"')
    expect(installerContent).toContain('PLUXX_CODEX_BUNDLE_URL="${PLUXX_CODEX_BUNDLE_URL:-$base_url/publish-plugin-codex-latest.tar.gz}"')
    expect(installerContent).toContain('PLUXX_OPENCODE_BUNDLE_URL="${PLUXX_OPENCODE_BUNDLE_URL:-$base_url/publish-plugin-opencode-latest.tar.gz}"')
    expect(installerContent).toContain('Skipping Claude Code bundle because the claude CLI is not available on PATH.')

    const manifest = JSON.parse(manifestContent)
    expect(manifest.assets.install).toEqual({
      script: 'install.sh',
      url: 'https://github.com/orchidautomation/publish-plugin/releases/latest/download/install.sh',
      command: 'bash <(curl -fsSL https://github.com/orchidautomation/publish-plugin/releases/latest/download/install.sh) --agents -y',
    })
  })

  it('generates installers that prompt and materialize user config for consumers', () => {
    const config: PluginConfig = {
      name: 'publish-plugin',
      version: '1.2.3',
      description: 'A publish test plugin',
      author: { name: 'Test Author' },
      license: 'MIT',
      repository: 'https://github.com/orchidautomation/publish-plugin',
      skills: './skills/',
      mcp: {
        fixture: {
          transport: 'http',
          url: 'https://example.com/mcp',
          auth: {
            type: 'bearer',
            envVar: 'TEST_API_KEY',
          },
        },
      },
      targets: ['codex'],
      outDir: './dist',
    }
    prepareBuiltTarget('codex', {
      ...CODEX_HOOK_FILES,
      '.mcp.json': JSON.stringify({
        mcpServers: {
          fixture: { url: 'https://example.com/mcp', bearer_token_env_var: 'TEST_API_KEY' },
          local: { command: 'bash', args: ['./scripts/start-mcp.sh'] },
        },
      }),
      'scripts/bootstrap-runtime.sh': '#!/usr/bin/env bash\nexit 0\n',
    })

    let installerContent = ''
    const result = runPublish(config, {
      rootDir: ROOT,
      requestedChannels: ['github-release'],
      runCommand: (command, args, options) => {
        if (command === 'tar') {
          const proc = spawnSync(command, args, {
            cwd: options?.cwd,
            encoding: 'utf-8',
          })
          return {
            status: proc.status,
            stdout: proc.stdout ?? '',
            stderr: proc.stderr ?? '',
          }
        }

        if (command === 'git') return { status: 0, stdout: '', stderr: '' }
        if (command === 'gh' && args[0] === 'auth') return { status: 0, stdout: '', stderr: '' }
        if (command === 'gh' && args[0] === 'release' && args[1] === 'view') return { status: 1, stdout: '', stderr: 'missing' }
        if (command === 'gh' && args[0] === 'release' && args[1] === 'create') {
          const installerPath = args.find((value) => typeof value === 'string' && value.endsWith('/install-codex.sh'))
          installerContent = readFileSync(installerPath!, 'utf-8')
          return { status: 0, stdout: 'created', stderr: '' }
        }
        return { status: 0, stdout: '', stderr: '' }
      },
    })

    expect(result.ok).toBe(true)
    expect(installerContent).toContain('pluxx_prompt_secret_config "test-api-key" "TEST_API_KEY"')
    expect(installerContent).toContain('Refusing placeholder-looking secret for $env_var')
    expect(installerContent).toContain("path.join(installDir, '.pluxx-user.json')")
    expect(installerContent).toContain('server.http_headers')
    expect(installerContent).toContain('preserveSecretReferences = true')
    expect(installerContent).toContain('Preparing local plugin runtime dependencies...')
    expect(installerContent).toContain('bash "$PLUXX_TX_STAGE/scripts/bootstrap-runtime.sh"')
    expect(installerContent).toContain('PLUXX_CODEX_ENABLE_PLUGIN_HOOKS')
    expect(installerContent).toContain('Codex requires [features].hooks = true')
    expect(installerContent).toContain('hooks = true')
    expect(installerContent).toContain('materializeInstalledStdioPath')
    expect(installerContent).toContain("path.resolve(runtimeRoot, normalized)")
    expect(installerContent.indexOf('PLUXX_USER_CONFIG_SPEC')).toBeLessThan(
      installerContent.indexOf('Preparing local plugin runtime dependencies...'),
    )
    expect(installerContent.indexOf('Preparing local plugin runtime dependencies...')).toBeLessThan(
      installerContent.indexOf('PLUXX_CODEX_ENABLE_PLUGIN_HOOKS'),
    )
    expect(installerContent.indexOf('PLUXX_CODEX_ENABLE_PLUGIN_HOOKS')).toBeLessThan(
      installerContent.indexOf('Updated Codex marketplace catalog'),
    )
  })

  it('rolls back a generated OpenCode install when an unowned companion blocks the transaction', () => {
    const run = runGeneratedInstaller('opencode', {
      config: { ...makeConfig(), targets: ['opencode'] },
      setupPaths: (paths) => {
        mkdirSync(paths.pluginInstallDir, { recursive: true })
        writeFileSync(resolve(paths.pluginInstallDir, '.pluxx-user.json'), '{}\n')
        const entryPath = paths.env.PLUXX_OPENCODE_ENTRY_PATH
        mkdirSync(resolve(entryPath, '..'), { recursive: true })
        writeFileSync(entryPath, '// private wrapper\n')
      },
    })

    expect(run.status).toBe(1)
    expect(run.stderr).toContain('Refusing to replace unowned OpenCode companion')
    expect(readFileSync(resolve(run.rootDir, 'publish-plugin.ts'), 'utf-8')).toBe('// private wrapper\n')
    expect(readFileSync(resolve(run.pluginInstallDir, '.pluxx-user.json'), 'utf-8')).toBe('{}\n')
    expect(existsSync(resolve(run.pluginInstallDir, 'package.json'))).toBe(false)
  })

  it('reuses saved generated-installer user config across core host updates', () => {
    const platforms: TargetPlatform[] = ['claude-code', 'cursor', 'codex', 'opencode']

    for (const platform of platforms) {
      const run = runGeneratedInstaller(platform, {
        existingUserConfig: {
          values: { 'instantly-api-key': 'saved-instantly-key' },
          env: { SENDLENS_INSTANTLY_API_KEY: 'saved-instantly-key' },
        },
      })

      expect(run.status).toBe(0)
      expect(run.stderr).toBe('')
      expect(run.stdout).toContain('Found existing publish-plugin config; reusing saved install values.')
      if (platform === 'codex') {
        expect(run.installedUserConfig?.values?.['instantly-api-key']).toBeUndefined()
        expect(run.installedUserConfig?.env?.SENDLENS_INSTANTLY_API_KEY).toBeUndefined()
        expect(run.installedUserConfig?.envRefs?.SENDLENS_INSTANTLY_API_KEY).toBe('SENDLENS_INSTANTLY_API_KEY')
      } else {
        expect(run.installedUserConfig?.values?.['instantly-api-key']).toBe('saved-instantly-key')
        expect(run.installedUserConfig?.env?.SENDLENS_INSTANTLY_API_KEY).toBe('saved-instantly-key')
      }
    }
  })

  it('does not bake core-host stdio runtime env into generated global installs', () => {
    const platforms: TargetPlatform[] = ['claude-code', 'cursor', 'codex', 'opencode']

    for (const platform of platforms) {
      const run = runGeneratedInstaller(platform, {
        config: makeRuntimeStdioInstallerConfig(platform),
        existingUserConfig: {
          values: {
            'workspace-marker': 'stale-marker',
            'workspace-client': 'stale-client',
            'workspace-store-path': '/stale/workspace.duckdb',
          },
          env: {
            WORKSPACE_MARKER: 'stale-marker',
            WORKSPACE_CLIENT: 'stale-client',
            WORKSPACE_STORE_PATH: '/stale/workspace.duckdb',
          },
        },
        extraFiles: stdioMcpFileForPlatform(platform),
      })

      expect(run.status).toBe(0)
      expect(run.stderr).toBe('')
      expect(run.stdout).not.toContain('reusing saved install values')
      expect(run.installerContent).not.toContain('pluxx_prompt_text_config "workspace-')
      expect(run.installerContent).not.toContain('pluxx_prompt_secret_config "workspace-')
      expect(JSON.stringify(run.installedUserConfig ?? {})).not.toContain('stale-')
      expect(JSON.stringify(run.installedUserConfig ?? {})).not.toContain('/stale/workspace.duckdb')
      expect(run.installedUserConfig).toBeUndefined()

      if (platform === 'opencode') continue

      const mcpPath = resolve(run.pluginInstallDir, platform === 'cursor' ? 'mcp.json' : '.mcp.json')
      const installedMcp = JSON.parse(readFileSync(mcpPath, 'utf-8'))
      expect(installedMcp.mcpServers.workspace.env).toEqual({
        PLUGIN_MODE: 'local',
      })
    }
  })

  it('lets explicit env vars override saved generated-installer user config', () => {
    const platforms: TargetPlatform[] = ['claude-code', 'cursor', 'codex', 'opencode']

    for (const platform of platforms) {
      const run = runGeneratedInstaller(platform, {
        existingUserConfig: {
          values: { 'instantly-api-key': 'old-saved-key' },
          env: { SENDLENS_INSTANTLY_API_KEY: 'old-saved-key' },
        },
        env: { SENDLENS_INSTANTLY_API_KEY: 'fresh-env-key' },
      })

      expect(run.status).toBe(0)
      expect(run.stderr).toBe('')
      expect(run.stdout).not.toContain('reusing saved install values')
      if (platform === 'codex') {
        expect(run.installedUserConfig?.values?.['instantly-api-key']).toBeUndefined()
        expect(run.installedUserConfig?.env?.SENDLENS_INSTANTLY_API_KEY).toBeUndefined()
        expect(run.installedUserConfig?.envRefs?.SENDLENS_INSTANTLY_API_KEY).toBe('SENDLENS_INSTANTLY_API_KEY')
      } else {
        expect(run.installedUserConfig?.values?.['instantly-api-key']).toBe('fresh-env-key')
        expect(run.installedUserConfig?.env?.SENDLENS_INSTANTLY_API_KEY).toBe('fresh-env-key')
      }
    }
  })

  it('lets PLUXX_RECONFIGURE skip saved generated-installer user config', () => {
    const run = runGeneratedInstaller('codex', {
      existingUserConfig: {
        values: { 'instantly-api-key': 'old-saved-key' },
        env: { SENDLENS_INSTANTLY_API_KEY: 'old-saved-key' },
      },
      env: {
        PLUXX_RECONFIGURE: '1',
        SENDLENS_INSTANTLY_API_KEY: 'reconfigured-key',
      },
    })

    expect(run.status).toBe(0)
    expect(run.stderr).toBe('')
    expect(run.stdout).not.toContain('reusing saved install values')
    expect(run.installerContent).toContain('PLUXX_RECONFIGURE')
    expect(run.installedUserConfig?.values?.['instantly-api-key']).toBeUndefined()
    expect(run.installedUserConfig?.env?.SENDLENS_INSTANTLY_API_KEY).toBeUndefined()
    expect(run.installedUserConfig?.envRefs?.SENDLENS_INSTANTLY_API_KEY).toBe('SENDLENS_INSTANTLY_API_KEY')
  })

  it('preserves secret references across Codex installer rebuilds', () => {
    const config: PluginConfig = {
      ...makeSecretReferenceFixtureConfig(['codex']),
      ...makeConfig(),
      targets: ['codex'],
    }
    const extraFiles = {
      '.codex-plugin/plugin.json': JSON.stringify({
        name: 'publish-plugin',
        version: '1.0.0',
      }),
      '.mcp.json': JSON.stringify({
        mcpServers: {
          fixture: {
            url: 'https://metrics.example.com/mcp',
            env_http_headers: {
              'X-API-Key': SECRET_REFERENCE_ENV_VAR,
              'X-Workspace': SECRET_REFERENCE_WORKSPACE_ENV_VAR,
            },
          },
        },
      }, null, 2),
    }

    const firstRun = runGeneratedInstaller('codex', {
      config,
      extraFiles,
      env: {
        [SECRET_REFERENCE_ENV_VAR]: SECRET_REFERENCE_SENTINEL,
        [SECRET_REFERENCE_WORKSPACE_ENV_VAR]: SECRET_REFERENCE_WORKSPACE_SENTINEL,
      },
    })

    const builtMcpPath = resolve(firstRun.rootDir, 'dist/codex/.mcp.json')
    const installedMcpPath = resolve(firstRun.rootDir, 'installed-codex/.mcp.json')
    const builtMcp = readFileSync(builtMcpPath, 'utf-8')
    const installedMcp = readFileSync(installedMcpPath, 'utf-8')

    expect(firstRun.status).toBe(0)
    expect(firstRun.stderr).toBe('')
    expect(firstRun.installerContent).not.toContain(SECRET_REFERENCE_SENTINEL)
    expect(firstRun.installerContent).not.toContain(SECRET_REFERENCE_WORKSPACE_SENTINEL)
    expect(builtMcp).toContain(SECRET_REFERENCE_ENV_VAR)
    expect(builtMcp).not.toContain(SECRET_REFERENCE_SENTINEL)
    expect(installedMcp).toContain(SECRET_REFERENCE_ENV_VAR)
    expect(installedMcp).toContain(SECRET_REFERENCE_WORKSPACE_ENV_VAR)
    expect(installedMcp).not.toContain(SECRET_REFERENCE_SENTINEL)
    expect(installedMcp).not.toContain(SECRET_REFERENCE_WORKSPACE_SENTINEL)
    expect(firstRun.installedUserConfig?.env?.[SECRET_REFERENCE_ENV_VAR]).toBeUndefined()
    expect(firstRun.installedUserConfig?.env?.[SECRET_REFERENCE_WORKSPACE_ENV_VAR]).toBeUndefined()
    expect(firstRun.installedUserConfig?.envRefs?.[SECRET_REFERENCE_ENV_VAR]).toBe(SECRET_REFERENCE_ENV_VAR)
    expect(firstRun.installedUserConfig?.envRefs?.[SECRET_REFERENCE_WORKSPACE_ENV_VAR]).toBe(SECRET_REFERENCE_WORKSPACE_ENV_VAR)

    const secondRun = runGeneratedInstaller('codex', {
      config,
      extraFiles,
      existingUserConfig: firstRun.installedUserConfig,
    })
    const reinstalledMcp = readFileSync(resolve(secondRun.rootDir, 'installed-codex/.mcp.json'), 'utf-8')

    expect(secondRun.status).toBe(0)
    expect(secondRun.stderr).toBe('')
    expect(secondRun.stdout).toContain('Found existing publish-plugin config; reusing saved install values.')
    expect(reinstalledMcp).toContain(SECRET_REFERENCE_ENV_VAR)
    expect(reinstalledMcp).toContain(SECRET_REFERENCE_WORKSPACE_ENV_VAR)
    expect(reinstalledMcp).not.toContain(SECRET_REFERENCE_SENTINEL)
    expect(reinstalledMcp).not.toContain(SECRET_REFERENCE_WORKSPACE_SENTINEL)
  })

  it('rejects required placeholder-looking saved generated-installer secret values', () => {
    const platforms: TargetPlatform[] = ['claude-code', 'cursor', 'codex', 'opencode']

    for (const platform of platforms) {
      const run = runGeneratedInstaller(platform, {
        existingUserConfig: {
          values: { 'instantly-api-key': 'your api key here' },
          env: { SENDLENS_INSTANTLY_API_KEY: 'your api key here' },
        },
      })

      expect(run.status).toBe(1)
      expect(run.stdout).not.toContain('reusing saved install values')
      expect(run.stderr).toContain('Ignoring placeholder-looking saved config for SENDLENS_INSTANTLY_API_KEY.')
      expect(run.stderr).toContain('Refusing placeholder-looking saved config for SENDLENS_INSTANTLY_API_KEY.')
      expect(run.installedUserConfig).toEqual({
        values: { 'instantly-api-key': 'your api key here' },
        env: { SENDLENS_INSTANTLY_API_KEY: 'your api key here' },
      })
    }
  })

  it('ignores placeholder-looking saved generated-installer secret values', () => {
    const run = runGeneratedInstaller('codex', {
      config: makeUserConfigInstallerConfig('codex', false),
      existingUserConfig: {
        values: { 'instantly-api-key': 'your api key here' },
        env: { SENDLENS_INSTANTLY_API_KEY: 'your api key here' },
      },
    })

    expect(run.status).toBe(0)
    expect(run.stdout).not.toContain('reusing saved install values')
    expect(run.stderr).toContain('Ignoring placeholder-looking saved config for SENDLENS_INSTANTLY_API_KEY.')
    expect(run.installedUserConfig?.values?.['instantly-api-key']).toBeUndefined()
    expect(run.installedUserConfig?.env?.SENDLENS_INSTANTLY_API_KEY).toBeUndefined()
    expect(run.installedUserConfig?.envRefs?.SENDLENS_INSTANTLY_API_KEY).toBeUndefined()
  })

  it('keeps Codex generated-installer auth as env references without bundling the secret', () => {
    const run = runGeneratedInstaller('codex', {
      config: {
        ...makeConfig(),
        targets: ['codex'],
        userConfig: [
          {
            key: 'metrics-api-key',
            title: 'Metrics API Key',
            type: 'secret',
            required: true,
            envVar: 'METRICS_API_KEY',
          },
        ],
        mcp: {
          metrics: {
            transport: 'http',
            url: 'https://metrics.example.com/mcp',
            auth: {
              type: 'bearer',
              envVar: 'METRICS_API_KEY',
              headerName: 'Authorization',
              headerTemplate: 'Bearer ${value}',
            },
          },
        },
      },
      env: { METRICS_API_KEY: 'known-test-secret' },
      extraFiles: {
        '.mcp.json': JSON.stringify({
          mcpServers: {
            metrics: {
              url: 'https://metrics.example.com/mcp',
              bearer_token_env_var: 'METRICS_API_KEY',
            },
          },
        }, null, 2),
        'scripts/check-env.sh': '#!/usr/bin/env bash\nexit 1\n',
      },
    })

    const installedMcp = JSON.parse(readFileSync(resolve(run.pluginInstallDir, '.mcp.json'), 'utf-8'))
    expect(installedMcp.mcpServers.metrics.bearer_token_env_var).toBe('METRICS_API_KEY')
    expect(installedMcp.mcpServers.metrics.http_headers).toBeUndefined()
    expect(JSON.stringify(installedMcp)).not.toContain('known-test-secret')
    expect(JSON.stringify(run.installedUserConfig)).not.toContain('known-test-secret')
    expect(run.installedUserConfig?.envRefs?.METRICS_API_KEY).toBe('METRICS_API_KEY')
  })

  it('prompts for native Codex MCP auth env references in generated installers', () => {
    const run = runGeneratedInstaller('codex', {
      config: {
        ...makeConfig(),
        targets: ['codex'],
        mcp: {
          metrics: {
            transport: 'http',
            url: 'https://metrics.example.com/mcp',
          },
        },
        platforms: {
          codex: {
            mcpServers: {
              metrics: {
                env_http_headers: {
                  'X-API-Key': 'METRICS_API_KEY',
                  'X-Workspace': 'METRICS_WORKSPACE_ID',
                },
              },
            },
          },
        },
      },
      env: {
        METRICS_API_KEY: 'known-test-secret',
        METRICS_WORKSPACE_ID: 'workspace-123',
      },
      extraFiles: {
        '.mcp.json': JSON.stringify({
          mcpServers: {
            metrics: {
              url: 'https://metrics.example.com/mcp',
              env_http_headers: {
                'X-API-Key': 'METRICS_API_KEY',
                'X-Workspace': 'METRICS_WORKSPACE_ID',
              },
            },
          },
        }, null, 2),
      },
    })

    const installedMcp = JSON.parse(readFileSync(resolve(run.pluginInstallDir, '.mcp.json'), 'utf-8'))
    expect(installedMcp.mcpServers.metrics.env_http_headers).toEqual({
      'X-API-Key': 'METRICS_API_KEY',
      'X-Workspace': 'METRICS_WORKSPACE_ID',
    })
    expect(run.installerContent).toContain('pluxx_prompt_secret_config "metrics-api-key" "METRICS_API_KEY"')
    expect(run.installerContent).toContain('pluxx_prompt_secret_config "metrics-workspace-id" "METRICS_WORKSPACE_ID"')
    expect(JSON.stringify(run.installedUserConfig)).not.toContain('known-test-secret')
    expect(run.installedUserConfig?.envRefs).toEqual({
      METRICS_API_KEY: 'METRICS_API_KEY',
      METRICS_WORKSPACE_ID: 'METRICS_WORKSPACE_ID',
    })
  })

  it('enables Codex plugin-bundled hooks in generated installers when automation opts in', () => {
    const run = runGeneratedCodexInstaller(CODEX_HOOK_FILES, {
      configText: '[features]\nexperimental = true\n',
      env: { PLUXX_CODEX_ENABLE_PLUGIN_HOOKS: '1' },
    })

    expect(run.status).toBe(0)
    expect(run.stderr).toBe('')
    expect(run.stdout).toContain('Enabled Codex plugin-bundled hooks')
    expect(run.stdout).toContain('Restart or refresh Codex')
    expect(run.configText).toContain('[features]\nhooks = true\nexperimental = true\n')
    expect(run.installerContent).toContain('PLUXX_CODEX_ENABLE_PLUGIN_HOOKS')
    expect(run.installerContent).toContain('features\\.hooks')
  })

  it('prints exact Codex hook TOML and leaves config unchanged when explicitly skipped', () => {
    const run = runGeneratedCodexInstaller(CODEX_HOOK_FILES, {
      env: { PLUXX_CODEX_ENABLE_PLUGIN_HOOKS: '0' },
    })

    expect(run.status).toBe(0)
    expect(run.configText).toBeUndefined()
    expect(run.stderr).toContain('[features]')
    expect(run.stderr).toContain('hooks = true')
    expect(run.stderr).toContain('Then restart or refresh Codex')
    expect(run.stderr).toContain('PLUXX_CODEX_ENABLE_PLUGIN_HOOKS=1')
  })

  it('does not touch Codex hook config for bundles without plugin hooks', () => {
    const run = runGeneratedCodexInstaller({
      '.codex-plugin/plugin.json': JSON.stringify({ name: 'publish-plugin', version: '1.2.3' }),
    }, {
      env: { PLUXX_CODEX_ENABLE_PLUGIN_HOOKS: '1' },
    })

    expect(run.status).toBe(0)
    expect(run.configText).toBeUndefined()
    expect(run.stdout).not.toContain('Enabled Codex plugin-bundled hooks')
    expect(run.stderr).not.toContain('hooks = true')
  })

  it('registers bundled Codex custom agents in the active Codex home', () => {
    const run = runGeneratedCodexInstaller({
      '.codex-plugin/plugin.json': JSON.stringify({ name: 'publish-plugin', version: '1.2.3' }),
      '.codex/agents/reviewer.toml': 'name = "reviewer"\ndescription = "Reviews evidence."\ndeveloper_instructions = "Review carefully."\n',
    })

    expect(run.status).toBe(0)
    expect(run.stderr).toBe('')
    expect(run.stdout).toContain('Registered 1 Codex custom agent(s)')
    expect(existsSync(resolve(ROOT, 'codex-home/agents/publish-plugin/reviewer.toml'))).toBe(true)
    expect(existsSync(resolve(ROOT, 'codex-home/pluxx/agent-installs/publish-plugin.json'))).toBe(true)
    expect(run.installerContent).toContain('Codex agent name collision')
  })

  it('clears the target plugin stale Codex active cache in generated installers', () => {
    const staleCache = resolve(ROOT, 'codex-home/plugins/cache/local-plugins/publish-plugin/1.2.2')
    mkdirSync(staleCache, { recursive: true })
    writeFileSync(resolve(staleCache, 'stale.txt'), 'stale\n')

    const run = runGeneratedCodexInstaller({
      '.codex-plugin/plugin.json': JSON.stringify({ name: 'publish-plugin', version: '1.2.3' }),
    })

    expect(run.status).toBe(0)
    expect(existsSync(resolve(ROOT, 'codex-home/plugins/cache/local-plugins/publish-plugin'))).toBe(false)
  })

  it('allows generated installers to move unchanged owned Codex agent registrations', () => {
    const previousContent = 'name = "reviewer"\ndescription = "Reviews evidence."\ndeveloper_instructions = "Review carefully."\n'
    const oldAgentPath = resolve(ROOT, 'codex-home/agents/publish-plugin/reviewer.toml')
    const ownershipPath = resolve(ROOT, 'codex-home/pluxx/agent-installs/publish-plugin.json')
    mkdirSync(resolve(oldAgentPath, '..'), { recursive: true })
    mkdirSync(resolve(ownershipPath, '..'), { recursive: true })
    writeFileSync(oldAgentPath, previousContent)
    writeFileSync(ownershipPath, JSON.stringify({
      schema: 'pluxx.codex-agent-install.v1',
      pluginName: 'publish-plugin',
      agents: [
        { name: 'reviewer', relativePath: 'reviewer.toml', sha256: sha256(previousContent) },
      ],
    }, null, 2) + '\n')

    const run = runGeneratedCodexInstaller({
      '.codex-plugin/plugin.json': JSON.stringify({ name: 'publish-plugin', version: '1.2.3' }),
      '.codex/agents/nested/reviewer.toml': previousContent,
    })

    expect(run.status).toBe(0)
    expect(run.stderr).toBe('')
    expect(run.stdout).toContain('Registered 1 Codex custom agent(s)')
    expect(run.stdout).toContain('removed 1 stale owned registration(s)')
    expect(existsSync(oldAgentPath)).toBe(false)
    expect(existsSync(resolve(ROOT, 'codex-home/agents/publish-plugin/nested/reviewer.toml'))).toBe(true)
  })
})
