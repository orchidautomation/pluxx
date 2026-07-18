import { afterEach, describe, expect, it } from 'bun:test'
import { createHash } from 'crypto'
import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'fs'
import { spawn, spawnSync } from 'child_process'
import { dirname, resolve } from 'path'
import { pathToFileURL } from 'url'
import type { PluginConfig, TargetPlatform } from '../src/schema'
import { planPublish, runPublish } from '../src/cli/publish'
import { doctorConsumer } from '../src/cli/doctor'
import { buildOpenCodeEntryFile } from '../src/opencode-entry'
import {
  makeSecretReferenceFixtureConfig,
  SECRET_REFERENCE_ENV_VAR,
  SECRET_REFERENCE_SENTINEL,
  SECRET_REFERENCE_WORKSPACE_ENV_VAR,
  SECRET_REFERENCE_WORKSPACE_SENTINEL,
} from '../test-fixtures/secret-reference-fixture'

const ROOT = resolve(import.meta.dir, '.publish-fixture')

function runtimeRefPath(storeRoot: string, platform: TargetPlatform, installPath: string): string {
  const installHash = createHash('sha256').update(resolve(installPath)).digest('hex').slice(0, 16)
  return resolve(storeRoot, `refs/publish-plugin/${platform}-${installHash}.json`)
}

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

type TestCommandResult = { status: number | null; stdout: string; stderr: string }
type TestCommandRunner = (command: string, args: string[], options?: { cwd?: string }) => TestCommandResult

function withGithubReleaseVerification(delegate: TestCommandRunner): TestCommandRunner {
  let publishedAssets = new Map<string, Buffer>()
  let releaseTag = 'v1.2.3'
  return (command, args, options) => {
    if (command === 'gh' && args[0] === 'release' && args[1] === 'view' && publishedAssets.size > 0) {
      return {
        status: 0,
        stdout: JSON.stringify({ tagName: releaseTag, assets: [...publishedAssets.keys()].map((name) => ({ name })) }),
        stderr: '',
      }
    }
    if (command === 'gh' && args[0] === 'release' && args[1] === 'download' && publishedAssets.size > 0) {
      const downloadRoot = args[args.indexOf('--dir') + 1]!
      for (const [name, content] of publishedAssets) writeFileSync(resolve(downloadRoot, name), content)
      return { status: 0, stdout: '', stderr: '' }
    }

    const result = delegate(command, args, options)
    if (result.status === 0 && command === 'gh' && args[0] === 'release' && (args[1] === 'create' || args[1] === 'upload')) {
      releaseTag = args[2]!
      const fileArgs = args[1] === 'create'
        ? args.slice(3, args.indexOf('--title'))
        : args.slice(args.indexOf('--clobber') + 1)
      publishedAssets = new Map(fileArgs.map((filepath) => [filepath.split('/').pop()!, readFileSync(filepath)]))
    }
    return result
  }
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
  mutateArchive?: (archivePath: string, releaseDir: string) => void
  prepareRuntime?: (rootDir: string) => Record<string, string> | void
  setupPaths?: (paths: ReturnType<typeof getGeneratedInstallerPaths>, rootDir: string) => void
}

interface GeneratedInstallerRunResult {
  rootDir: string
  status: number | null
  stdout: string
  stderr: string
  archivePath: string
  installerContent: string
  pluginInstallDir: string
  installedUserConfig?: {
    values?: Record<string, unknown>
    env?: Record<string, unknown>
    envRefs?: Record<string, unknown>
  }
}

function isolatedInstallerEnvironment(source: Record<string, string | undefined>): Record<string, string> {
  return { PATH: source.PATH ?? '/usr/bin:/bin' }
}

function legacyManifestPathForPlatform(platform: TargetPlatform, installDir: string): string {
  if (platform === 'claude-code') return resolve(installDir, '.claude-plugin/plugin.json')
  if (platform === 'cursor') return resolve(installDir, '.cursor-plugin/plugin.json')
  if (platform === 'codex') return resolve(installDir, '.codex-plugin/plugin.json')
  if (platform === 'opencode') return resolve(installDir, 'package.json')
  throw new Error(`Unsupported legacy manifest test platform: ${platform}`)
}

function matchingLegacyManifestForPlatform(platform: TargetPlatform): Record<string, unknown> {
  if (platform === 'opencode') {
    return { name: '@orchid/publish-plugin-opencode', version: '1.2.2', type: 'module' }
  }

  return {
    name: 'publish-plugin',
    version: '1.2.2',
    description: `Legacy ${platform} install`,
  }
}

function writeLegacyInstalledManifest(platform: TargetPlatform, installDir: string, manifest: Record<string, unknown> | string): void {
  const manifestPath = legacyManifestPathForPlatform(platform, installDir)
  mkdirSync(resolve(manifestPath, '..'), { recursive: true })
  writeFileSync(
    manifestPath,
    typeof manifest === 'string' ? manifest : JSON.stringify(manifest, null, 2) + '\n',
  )
}

function generatedInstallerOwnershipPath(platform: TargetPlatform, rootDir: string, installDir: string): string {
  const home = resolve(rootDir, 'home')
  const resolvedInstallDir = resolve(installDir)
  const conventionalRoots = [
    resolve(home, '.claude/plugins'),
    resolve(home, '.cursor/plugins'),
    resolve(home, '.codex/plugins'),
    resolve(home, '.config/opencode'),
  ]
  const ownershipRoot = conventionalRoots.some((root) => resolvedInstallDir === root || resolvedInstallDir.startsWith(root + '/'))
    ? resolve(home, '.pluxx/install-ownership')
    : resolve(dirname(resolvedInstallDir), '.pluxx-install-ownership')
  return resolve(ownershipRoot, 'publish-plugin', `${platform}.json`)
}

function legacyOpenCodeWrapper(): string {
  return [
    'import type { Plugin } from "@opencode-ai/plugin"',
    'import { join } from "path"',
    '',
    'import * as PluginModule from "./publish-plugin/index.ts"',
    '',
    '// OpenCode auto-loads plugin files placed directly in ~/.config/opencode/plugins.',
    '// Proxy into the installed plugin bundle while preserving its expected root.',
    'const pluginFactory = Object.values(PluginModule).find((value): value is Plugin => typeof value === "function")',
    '',
    'if (!pluginFactory) {',
    '  throw new Error("OpenCode plugin bundle for publish-plugin did not export a plugin function.")',
    '}',
    '',
    'export const PublishPlugin: Plugin = async (context) =>',
    '  pluginFactory({',
    '    ...context,',
    '    directory: join(context.directory, "publish-plugin"),',
    '  })',
    '',
  ].join('\n')
}

function currentOpenCodeWrapper(): string {
  return buildOpenCodeEntryFile('publish-plugin')
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
  rmSync(rootDir, { recursive: true, force: true })
  const config = options.config ?? makeUserConfigInstallerConfig(platform)
  const paths = getGeneratedInstallerPaths(platform, rootDir)
  const homeDir = resolve(rootDir, 'home')
  const tempDir = resolve(rootDir, 'tmp')
  mkdirSync(homeDir, { recursive: true })
  mkdirSync(tempDir, { recursive: true })
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
  const preparedEnv = options.prepareRuntime?.(rootDir) ?? {}
  options.setupPaths?.(paths, rootDir)

  let installerRun: GeneratedInstallerRunResult | undefined
  let publishedAssets = new Map<string, Buffer>()
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
      if (command === 'gh' && args[0] === 'release' && args[1] === 'view') {
        return publishedAssets.size === 0
          ? { status: 1, stdout: '', stderr: 'missing' }
          : { status: 0, stdout: JSON.stringify({ tagName: 'v1.2.3', assets: [...publishedAssets.keys()].map((name) => ({ name })) }), stderr: '' }
      }
      if (command === 'gh' && args[0] === 'release' && args[1] === 'create') {
        const fileArgs = args.slice(3, args.indexOf('--title'))
        const scriptName = platform === 'claude-code' ? 'install-claude-code.sh' : `install-${platform}.sh`
        const installerPath = args.find((value) => typeof value === 'string' && value.endsWith(`/${scriptName}`))
        const archivePath = args.find((value) => typeof value === 'string' && value.endsWith(`/${config.name}-${platform}-latest.tar.gz`))

        options.mutateArchive?.(archivePath!, resolve(archivePath!, '..'))
        publishedAssets = new Map(fileArgs.map((filepath) => [filepath.split('/').pop()!, readFileSync(filepath)]))

        const env: Record<string, string> = {
          ...isolatedInstallerEnvironment(process.env),
          HOME: homeDir,
          TMPDIR: tempDir,
          TMP: tempDir,
          TEMP: tempDir,
          ...paths.env,
          ...preparedEnv,
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
        const preservedArchivePath = resolve(rootDir, archivePath!.split('/').pop()!)
        writeFileSync(preservedArchivePath, readFileSync(archivePath!))
        for (const name of ['release-manifest.json', 'SHA256SUMS.txt']) {
          const content = publishedAssets.get(name)
          if (content) writeFileSync(resolve(rootDir, name), content)
        }
        installerRun = {
          rootDir,
          status: proc.status,
          stdout: proc.stdout ?? '',
          stderr: proc.stderr ?? '',
          archivePath: preservedArchivePath,
          installerContent: readFileSync(installerPath!, 'utf-8'),
          pluginInstallDir: paths.pluginInstallDir,
          installedUserConfig: existsSync(userConfigPath)
            ? JSON.parse(readFileSync(userConfigPath, 'utf-8'))
            : undefined,
        }
        return { status: 0, stdout: 'created', stderr: '' }
      }
      if (command === 'gh' && args[0] === 'release' && args[1] === 'download') {
        const downloadRoot = args[args.indexOf('--dir') + 1]!
        for (const [name, content] of publishedAssets) writeFileSync(resolve(downloadRoot, name), content)
        return { status: 0, stdout: '', stderr: '' }
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
  let publishedAssets = new Map<string, Buffer>()
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
      if (command === 'gh' && args[0] === 'release' && args[1] === 'view') {
        return publishedAssets.size === 0
          ? { status: 1, stdout: '', stderr: 'missing' }
          : { status: 0, stdout: JSON.stringify({ tagName: 'v1.2.3', assets: [...publishedAssets.keys()].map((name) => ({ name })) }), stderr: '' }
      }
      if (command === 'gh' && args[0] === 'release' && args[1] === 'create') {
        const fileArgs = args.slice(3, args.indexOf('--title'))
        publishedAssets = new Map(fileArgs.map((filepath) => [filepath.split('/').pop()!, readFileSync(filepath)]))
        const installerPath = args.find((value) => typeof value === 'string' && value.endsWith('/install-codex.sh'))
        const archivePath = args.find((value) => typeof value === 'string' && value.endsWith('/publish-plugin-codex-latest.tar.gz'))
        const proc = spawnSync('bash', [installerPath!], {
          encoding: 'utf-8',
          env: {
            ...process.env,
            ...options.env,
            CODEX_HOME: options.env?.CODEX_HOME ?? resolve(ROOT, 'codex-home'),
            PLUXX_INSTALL_LOCK_ROOT: resolve(ROOT, 'install-locks'),
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
      if (command === 'gh' && args[0] === 'release' && args[1] === 'download') {
        const downloadRoot = args[args.indexOf('--dir') + 1]!
        for (const [name, content] of publishedAssets) writeFileSync(resolve(downloadRoot, name), content)
        return { status: 0, stdout: '', stderr: '' }
      }
      return { status: 0, stdout: '', stderr: '' }
    },
  })

  expect(result.ok).toBe(true)
  expect(installerRun).toBeDefined()
  return installerRun!
}

afterEach(() => {
  const makeWritable = (filepath: string): void => {
    if (!existsSync(filepath)) return
    const stats = lstatSync(filepath)
    if (stats.isSymbolicLink()) return
    chmodSync(filepath, stats.isDirectory() ? 0o700 : (stats.mode | 0o600))
    if (stats.isDirectory()) for (const entry of readdirSync(filepath)) makeWritable(resolve(filepath, entry))
  }
  makeWritable(ROOT)
  rmSync(ROOT, { recursive: true, force: true })
})

describe('planPublish', () => {
  it('resolves target-aware default channels from built outputs', () => {
    const config = makeConfig()
    prepareBuiltTarget('claude-code', { '.claude-plugin/plugin.json': JSON.stringify({ version: '1.2.3' }) })
    prepareBuiltTarget('opencode', {
      'package.json': JSON.stringify({ name: '@orchid/publish-plugin-opencode', version: '1.2.3' }),
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
    prepareBuiltTarget('claude-code', { '.claude-plugin/plugin.json': JSON.stringify({ version: '1.2.3' }) })

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
      'package.json': JSON.stringify({ name: '@orchid/publish-plugin-opencode', version: '1.2.3' }),
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
  it('rejects requested and built release version mismatches', () => {
    const config = makeConfig()
    prepareBuiltTarget('codex', {
      '.codex-plugin/plugin.json': JSON.stringify({ name: config.name, version: '1.2.2' }),
    })

    const plan = planPublish({ ...config, targets: ['codex'] }, {
      rootDir: ROOT,
      version: '1.2.4',
      dryRun: true,
      requestedChannels: ['github-release'],
      runCommand: () => ({ status: 0, stdout: '', stderr: '' }),
    })

    const identity = plan.checks.find((check) => check.code === 'release-identity')
    expect(identity?.ok).toBe(false)
    expect(identity?.detail).toContain('requested 1.2.4 != source config 1.2.3')
    expect(identity?.detail).toContain('codex 1.2.2 != requested 1.2.4')
  })

  it('rejects missing or unreadable built release identities', () => {
    const config = { ...makeConfig(), targets: ['codex', 'opencode'] as TargetPlatform[] }
    prepareBuiltTarget('codex', { '.codex-plugin/plugin.json': '{not-json' })
    prepareBuiltTarget('opencode', {
      'package.json': JSON.stringify({ name: '@orchid/publish-plugin-opencode' }),
      'index.ts': 'export {}',
    })

    const plan = planPublish(config, {
      rootDir: ROOT,
      dryRun: true,
      runCommand: () => ({ status: 0, stdout: '', stderr: '' }),
    })
    const identity = plan.checks.find((check) => check.code === 'release-identity')

    expect(identity?.ok).toBe(false)
    expect(identity?.detail).toContain('codex built identity is missing or unreadable')
    expect(identity?.detail).toContain('opencode built identity is missing or unreadable')
    expect(identity?.detail).toContain('npm package version is missing or unreadable')
  })
})

describe('runPublish', () => {
  it('executes npm publish for the npm channel when checks pass', () => {
    const config = makeConfig()
    prepareBuiltTarget('opencode', {
      'package.json': JSON.stringify({ name: '@orchid/publish-plugin-opencode', version: '1.2.3' }),
      'index.ts': 'export {}',
    })

    const calls: Array<{ command: string; args: string[]; cwd?: string }> = []
    let published = false
    const result = runPublish(config, {
      rootDir: ROOT,
      requestedChannels: ['npm'],
      runCommand: (command, args, options) => {
        calls.push({ command, args, cwd: options?.cwd })
        if (command === 'git') return { status: 0, stdout: '', stderr: '' }
        if (command === 'npm' && args[0] === 'whoami') return { status: 0, stdout: 'orchidautomation\n', stderr: '' }
        if (command === 'npm' && args[0] === 'pack') return { status: 0, stdout: '[{"filename":"plugin.tgz","integrity":"sha512-local"}]', stderr: '' }
        if (command === 'npm' && args[0] === 'view') return { status: published ? 0 : 1, stdout: published ? '"sha512-local"\n' : '', stderr: published ? '' : 'npm error code E404' }
        if (command === 'npm' && args[0] === 'publish') {
          published = true
          return { status: 0, stdout: 'published', stderr: '' }
        }
        return { status: 0, stdout: '', stderr: '' }
      },
    })

    expect(result.ok).toBe(true)
    expect(result.execution?.npm?.ok).toBe(true)
    expect(calls.some((call) => call.command === 'npm' && call.args[0] === 'publish')).toBe(true)
  })

  it('fails when npm post-publish integrity verification disagrees', () => {
    const config = { ...makeConfig(), targets: ['opencode'] as TargetPlatform[] }
    prepareBuiltTarget('opencode', {
      'package.json': JSON.stringify({ name: '@orchid/publish-plugin-opencode', version: '1.2.3' }),
      'index.ts': 'export {}',
    })
    let published = false

    const result = runPublish(config, {
      rootDir: ROOT,
      requestedChannels: ['npm'],
      runCommand: (command, args) => {
        if (command === 'npm' && args[0] === 'whoami') return { status: 0, stdout: 'tester\n', stderr: '' }
        if (command === 'npm' && args[0] === 'pack') return { status: 0, stdout: '[{"filename":"plugin.tgz","integrity":"sha512-local"}]', stderr: '' }
        if (command === 'npm' && args[0] === 'view') return published
          ? { status: 0, stdout: '"sha512-remote-mismatch"\n', stderr: '' }
          : { status: 1, stdout: '', stderr: 'npm error code E404' }
        if (command === 'npm' && args[0] === 'publish') {
          published = true
          return { status: 0, stdout: 'published', stderr: '' }
        }
        return { status: 0, stdout: '', stderr: '' }
      },
    })

    expect(result.ok).toBe(false)
    expect(result.execution?.npm?.verified).toBe(false)
    expect(result.execution?.npm?.detail).toContain('post-publish integrity verification failed')
  })

  it('does not publish when npm inventory lookup fails ambiguously', () => {
    const config = { ...makeConfig(), targets: ['opencode'] as TargetPlatform[] }
    prepareBuiltTarget('opencode', {
      'package.json': JSON.stringify({ name: '@orchid/publish-plugin-opencode', version: '1.2.3' }),
      'index.ts': 'export {}',
    })
    const calls: string[][] = []
    const result = runPublish(config, {
      rootDir: ROOT,
      requestedChannels: ['npm'],
      runCommand: (command, args) => {
        calls.push([command, ...args])
        if (command === 'npm' && args[0] === 'whoami') return { status: 0, stdout: 'tester\n', stderr: '' }
        if (command === 'npm' && args[0] === 'pack') return { status: 0, stdout: '[{"filename":"plugin.tgz","integrity":"sha512-local"}]', stderr: '' }
        if (command === 'npm' && args[0] === 'view') return { status: 1, stdout: '', stderr: 'network timeout' }
        return { status: 0, stdout: '', stderr: '' }
      },
    })

    expect(result.ok).toBe(false)
    expect(result.execution?.npm?.action).toBe('failed')
    expect(result.execution?.npm?.detail).toContain('Unable to verify whether npm already has')
    expect(calls.some((call) => call[0] === 'npm' && call[1] === 'publish')).toBe(false)
  })

  it('reconciles an already-published immutable npm version without republishing', () => {
    const config = { ...makeConfig(), targets: ['opencode'] as TargetPlatform[] }
    prepareBuiltTarget('opencode', {
      'package.json': JSON.stringify({ name: '@orchid/publish-plugin-opencode', version: '1.2.3' }),
      'index.ts': 'export {}',
    })
    const calls: string[][] = []

    const result = runPublish(config, {
      rootDir: ROOT,
      requestedChannels: ['npm'],
      runCommand: (command, args) => {
        calls.push([command, ...args])
        if (command === 'npm' && args[0] === 'whoami') return { status: 0, stdout: 'tester\n', stderr: '' }
        if (command === 'npm' && args[0] === 'pack') return { status: 0, stdout: '[{"filename":"plugin.tgz","integrity":"sha512-local"}]', stderr: '' }
        if (command === 'npm' && args[0] === 'view') return { status: 0, stdout: '"sha512-local"\n', stderr: '' }
        return { status: 0, stdout: '', stderr: '' }
      },
    })

    expect(result.ok).toBe(true)
    expect(result.execution?.npm?.action).toBe('already-published')
    expect(calls.some((call) => call[0] === 'npm' && call[1] === 'publish')).toBe(false)
  })

  it('rejects an existing npm version with different artifact integrity', () => {
    const config = { ...makeConfig(), targets: ['opencode'] as TargetPlatform[] }
    prepareBuiltTarget('opencode', {
      'package.json': JSON.stringify({ name: '@orchid/publish-plugin-opencode', version: '1.2.3' }),
      'index.ts': 'export {}',
    })

    const result = runPublish(config, {
      rootDir: ROOT,
      requestedChannels: ['npm'],
      runCommand: (command, args) => {
        if (command === 'npm' && args[0] === 'whoami') return { status: 0, stdout: 'tester\n', stderr: '' }
        if (command === 'npm' && args[0] === 'pack') return { status: 0, stdout: '[{"filename":"plugin.tgz","integrity":"sha512-local"}]', stderr: '' }
        if (command === 'npm' && args[0] === 'view') return { status: 0, stdout: '"sha512-other"\n', stderr: '' }
        return { status: 0, stdout: '', stderr: '' }
      },
    })

    expect(result.ok).toBe(false)
    expect(result.execution?.npm?.detail).toContain('different artifact integrity')
  })

  it('reconciles an existing GitHub release by uploading the complete asset set', () => {
    const config = { ...makeConfig(), targets: ['codex'] as TargetPlatform[] }
    prepareBuiltTarget('codex', GENERATED_INSTALLER_FIXTURE_FILES.codex)
    const calls: string[][] = []

    const result = runPublish(config, {
      rootDir: ROOT,
      requestedChannels: ['github-release'],
      runCommand: withGithubReleaseVerification((command, args, options) => {
        calls.push([command, ...args])
        if (command === 'tar') {
          const proc = spawnSync(command, args, { cwd: options?.cwd, encoding: 'utf-8' })
          return { status: proc.status, stdout: proc.stdout ?? '', stderr: proc.stderr ?? '' }
        }
        if (command === 'gh' && args[0] === 'release' && args[1] === 'view') {
          return { status: 0, stdout: JSON.stringify({ assets: [{ name: 'install-removed.sh' }] }), stderr: '' }
        }
        return { status: 0, stdout: '', stderr: '' }
      }),
    })

    expect(result.ok).toBe(true)
    expect(result.execution?.githubRelease?.action).toBe('reconciled')
    const upload = calls.find((call) => call[0] === 'gh' && call[1] === 'release' && call[2] === 'upload')
    expect(upload).toContain('--clobber')
    expect(upload?.some((value) => value.endsWith('/SHA256SUMS.txt'))).toBe(true)
    expect(calls.some((call) => call[0] === 'gh' && call[1] === 'release' && call[2] === 'delete-asset' && call[4] === 'install-removed.sh')).toBe(true)
  })

  it('fails when post-publish GitHub release verification is incomplete', () => {
    const config = { ...makeConfig(), targets: ['codex'] as TargetPlatform[] }
    prepareBuiltTarget('codex', GENERATED_INSTALLER_FIXTURE_FILES.codex)
    let viewCount = 0

    const result = runPublish(config, {
      rootDir: ROOT,
      requestedChannels: ['github-release'],
      runCommand: (command, args, options) => {
        if (command === 'tar') {
          const proc = spawnSync(command, args, { cwd: options?.cwd, encoding: 'utf-8' })
          return { status: proc.status, stdout: proc.stdout ?? '', stderr: proc.stderr ?? '' }
        }
        if (command === 'gh' && args[0] === 'release' && args[1] === 'view') {
          viewCount += 1
          return viewCount === 1
            ? { status: 1, stdout: '', stderr: 'missing' }
            : { status: 0, stdout: JSON.stringify({ tagName: 'v1.2.3', assets: [] }), stderr: '' }
        }
        return { status: 0, stdout: '', stderr: '' }
      },
    })

    expect(result.ok).toBe(false)
    expect(result.execution?.githubRelease?.verified).toBe(false)
    expect(result.execution?.githubRelease?.detail).toContain('verification is incomplete')
  })

  it('verifies post-publish GitHub release assets when remote bytes match', () => {
    const config = { ...makeConfig(), targets: ['codex'] as TargetPlatform[] }
    prepareBuiltTarget('codex', GENERATED_INSTALLER_FIXTURE_FILES.codex)
    let publishedAssets = new Map<string, Buffer>()
    let viewCount = 0

    const result = runPublish(config, {
      rootDir: ROOT,
      requestedChannels: ['github-release'],
      runCommand: (command, args, options) => {
        if (command === 'tar') {
          const proc = spawnSync(command, args, { cwd: options?.cwd, encoding: 'utf-8' })
          return { status: proc.status, stdout: proc.stdout ?? '', stderr: proc.stderr ?? '' }
        }
        if (command === 'gh' && args[0] === 'release' && args[1] === 'view') {
          viewCount += 1
          return viewCount === 1
            ? { status: 1, stdout: '', stderr: 'missing' }
            : {
                status: 0,
                stdout: JSON.stringify({
                  tagName: 'v1.2.3',
                  assets: [...publishedAssets.keys()].map((name) => ({ name })),
                }),
                stderr: '',
              }
        }
        if (command === 'gh' && args[0] === 'release' && args[1] === 'create') {
          const fileArgs = args.slice(3, args.indexOf('--title'))
          publishedAssets = new Map(fileArgs.map((filepath) => [filepath.split('/').pop()!, readFileSync(filepath)]))
          return { status: 0, stdout: 'created', stderr: '' }
        }
        if (command === 'gh' && args[0] === 'release' && args[1] === 'download') {
          const downloadRoot = args[args.indexOf('--dir') + 1]!
          for (const [name, content] of publishedAssets) writeFileSync(resolve(downloadRoot, name), content)
          return { status: 0, stdout: '', stderr: '' }
        }
        return { status: 0, stdout: '', stderr: '' }
      },
    })

    expect(result.ok).toBe(true)
    expect(result.execution?.githubRelease?.verified).toBe(true)
  })

  it('fails post-publish GitHub release verification when remote asset bytes differ', () => {
    const config = { ...makeConfig(), targets: ['codex'] as TargetPlatform[] }
    prepareBuiltTarget('codex', GENERATED_INSTALLER_FIXTURE_FILES.codex)
    let publishedAssets = new Map<string, Buffer>()
    let viewCount = 0

    const result = runPublish(config, {
      rootDir: ROOT,
      requestedChannels: ['github-release'],
      runCommand: (command, args, options) => {
        if (command === 'tar') {
          const proc = spawnSync(command, args, { cwd: options?.cwd, encoding: 'utf-8' })
          return { status: proc.status, stdout: proc.stdout ?? '', stderr: proc.stderr ?? '' }
        }
        if (command === 'gh' && args[0] === 'release' && args[1] === 'view') {
          viewCount += 1
          return viewCount === 1
            ? { status: 1, stdout: '', stderr: 'missing' }
            : {
                status: 0,
                stdout: JSON.stringify({
                  tagName: 'v1.2.3',
                  assets: [...publishedAssets.keys()].map((name) => ({ name })),
                }),
                stderr: '',
              }
        }
        if (command === 'gh' && args[0] === 'release' && args[1] === 'create') {
          const fileArgs = args.slice(3, args.indexOf('--title'))
          publishedAssets = new Map(fileArgs.map((filepath) => [filepath.split('/').pop()!, readFileSync(filepath)]))
          return { status: 0, stdout: 'created', stderr: '' }
        }
        if (command === 'gh' && args[0] === 'release' && args[1] === 'download') {
          const downloadRoot = args[args.indexOf('--dir') + 1]!
          let first = true
          for (const [name, content] of publishedAssets) {
            writeFileSync(resolve(downloadRoot, name), first ? Buffer.from('tampered remote bytes') : content)
            first = false
          }
          return { status: 0, stdout: '', stderr: '' }
        }
        return { status: 0, stdout: '', stderr: '' }
      },
    })

    expect(result.ok).toBe(false)
    expect(result.execution?.githubRelease?.verified).toBe(false)
    expect(result.execution?.githubRelease?.detail).toContain('verification is incomplete')
  })

  it('packages consumer-facing release assets for github releases', () => {
    const config = makeConfig()
    prepareBuiltTarget('claude-code', { '.claude-plugin/plugin.json': JSON.stringify({ name: 'publish-plugin', version: '1.2.3' }) })
    prepareBuiltTarget('opencode', {
      'package.json': JSON.stringify({ name: '@orchid/publish-plugin-opencode', version: '1.2.3' }),
      'index.ts': 'export {}',
    })

    const calls: Array<{ command: string; args: string[]; cwd?: string }> = []
    let installAllContent = ''
    const result = runPublish(config, {
      rootDir: ROOT,
      requestedChannels: ['github-release'],
      runCommand: withGithubReleaseVerification((command, args, options) => {
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
        if (command === 'gh' && args[0] === 'release' && args[1] === 'create') {
          const installAllPath = args.find((value) => value.endsWith('/install-all.sh'))
          installAllContent = readFileSync(installAllPath!, 'utf-8')
          return { status: 0, stdout: 'created', stderr: '' }
        }
        return { status: 0, stdout: '', stderr: '' }
      }),
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
    expect(installAllContent).toContain("entry[2] === name")
    expect(installAllContent).toContain("'Checksum mismatch for ' + name")
    expect(installAllContent).toContain('bash "$TMP_DIR/install.sh" --agents "$@"')
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
      runCommand: withGithubReleaseVerification((command, args, options) => {
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
      }),
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
    expect(installerContent).toContain('--connect-timeout 10 --max-time 120 --retry 3 --retry-all-errors')

    const manifest = JSON.parse(manifestContent)
    expect(manifest.assets.install).toEqual({
      script: 'install.sh',
      url: 'https://github.com/orchidautomation/publish-plugin/releases/latest/download/install.sh',
      command: 'bash <(curl -fsSL --connect-timeout 10 --max-time 120 --retry 3 --retry-all-errors --retry-delay 1 https://github.com/orchidautomation/publish-plugin/releases/latest/download/install.sh) --agents -y',
    })
  })

  it('rejects a tampered release archive before replacing the installed bundle', () => {
    const run = runGeneratedInstaller('cursor', {
      existingUserConfig: {
        values: { marker: 'previous-install' },
      },
      mutateArchive: (archivePath) => {
        writeFileSync(archivePath, 'tampered', { flag: 'a' })
      },
    })

    expect(run.status).toBe(1)
    expect(run.stderr).toContain('Checksum mismatch for publish-plugin-cursor-latest.tar.gz')
    expect(run.installedUserConfig?.values?.marker).toBe('previous-install')
  })

  it('rejects a tampered per-host installer before the top-level installer executes it', () => {
    const config = { ...makeConfig(), targets: ['codex'] as TargetPlatform[] }
    prepareBuiltTarget('codex', GENERATED_INSTALLER_FIXTURE_FILES.codex)
    let topLevelRun: ReturnType<typeof spawnSync> | undefined

    const result = runPublish(config, {
      rootDir: ROOT,
      requestedChannels: ['github-release'],
      runCommand: withGithubReleaseVerification((command, args, options) => {
        if (command === 'tar') {
          const proc = spawnSync(command, args, { cwd: options?.cwd, encoding: 'utf-8' })
          return { status: proc.status, stdout: proc.stdout ?? '', stderr: proc.stderr ?? '' }
        }
        if (command === 'gh' && args[0] === 'release' && args[1] === 'view') return { status: 1, stdout: '', stderr: 'missing' }
        if (command === 'gh' && args[0] === 'release' && args[1] === 'create') {
          const topLevelPath = args.find((value) => value.endsWith('/install.sh'))!
          const hostInstallerPath = args.find((value) => value.endsWith('/install-codex.sh'))!
          const releaseDir = resolve(topLevelPath, '..')
          writeFileSync(hostInstallerPath, '\n# tampered\n', { flag: 'a' })

          const fakeBin = resolve(ROOT, 'fake-bin')
          mkdirSync(fakeBin, { recursive: true })
          const fakeCurl = resolve(fakeBin, 'curl')
          writeFileSync(fakeCurl, `#!/usr/bin/env bash
set -euo pipefail
url=""
out=""
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    http*) url="$1"; shift ;;
    *) shift ;;
  esac
done
cp "$TEST_RELEASE_DIR/$(basename "$url")" "$out"
`)
          chmodSync(fakeCurl, 0o755)
          topLevelRun = spawnSync('bash', [topLevelPath, '--codex', '--base-url', 'https://release.test/assets'], {
            encoding: 'utf-8',
            env: {
              ...process.env,
              PATH: `${fakeBin}:${process.env.PATH}`,
              TEST_RELEASE_DIR: releaseDir,
            },
          })
          return { status: 0, stdout: 'created', stderr: '' }
        }
        return { status: 0, stdout: '', stderr: '' }
      }),
    })

    expect(result.ok).toBe(true)
    expect(topLevelRun?.status).toBe(1)
    expect(topLevelRun?.stderr).toContain('Checksum mismatch for install-codex.sh')
  })

  it('propagates a custom release base through top-level and per-host verification', () => {
    const config = { ...makeConfig(), targets: ['codex'] as TargetPlatform[] }
    prepareBuiltTarget('codex', GENERATED_INSTALLER_FIXTURE_FILES.codex)
    let topLevelRun: ReturnType<typeof spawnSync> | undefined
    const installDir = resolve(ROOT, 'custom-base-installed-codex')

    const result = runPublish(config, {
      rootDir: ROOT,
      requestedChannels: ['github-release'],
      runCommand: withGithubReleaseVerification((command, args, options) => {
        if (command === 'tar') {
          const proc = spawnSync(command, args, { cwd: options?.cwd, encoding: 'utf-8' })
          return { status: proc.status, stdout: proc.stdout ?? '', stderr: proc.stderr ?? '' }
        }
        if (command === 'gh' && args[0] === 'release' && args[1] === 'view') return { status: 1, stdout: '', stderr: 'missing' }
        if (command === 'gh' && args[0] === 'release' && args[1] === 'create') {
          const topLevelPath = args.find((value) => value.endsWith('/install.sh'))!
          const releaseDir = resolve(topLevelPath, '..')
          const fakeBin = resolve(ROOT, 'custom-base-fake-bin')
          mkdirSync(fakeBin, { recursive: true })
          const fakeCurl = resolve(fakeBin, 'curl')
          writeFileSync(fakeCurl, `#!/usr/bin/env bash
set -euo pipefail
url=""
out=""
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    http*) url="$1"; shift ;;
    *) shift ;;
  esac
done
cp "$TEST_RELEASE_DIR/$(basename "$url")" "$out"
`)
          chmodSync(fakeCurl, 0o755)
          topLevelRun = spawnSync('bash', [topLevelPath, '--codex', '--base-url', 'https://custom.example/v1.2.3'], {
            encoding: 'utf-8',
            env: {
              ...process.env,
              HOME: resolve(ROOT, 'custom-base-home'),
              PATH: `${fakeBin}:${process.env.PATH}`,
              PLUXX_CODEX_INSTALL_DIR: installDir,
              PLUXX_CODEX_MARKETPLACE_PATH: resolve(ROOT, 'custom-base-marketplace.json'),
              PLUXX_CODEX_CONFIG_PATH: resolve(ROOT, 'custom-base-config.toml'),
              PLUXX_CODEX_ENABLE_PLUGIN_HOOKS: '0',
              TEST_RELEASE_DIR: releaseDir,
            },
          })
          return { status: 0, stdout: 'created', stderr: '' }
        }
        return { status: 0, stdout: '', stderr: '' }
      }),
    })

    expect(result.ok).toBe(true)
    expect(topLevelRun?.status).toBe(0)
    expect(topLevelRun?.stderr).toBe('')
    expect(topLevelRun?.stdout).toContain(`Installed publish-plugin to ${installDir}`)
    expect(existsSync(resolve(installDir, '.codex-plugin/plugin.json'))).toBe(true)
  })

  it('keeps the previous install when staged runtime bootstrap fails', () => {
    const run = runGeneratedInstaller('cursor', {
      existingUserConfig: {
        values: { marker: 'previous-install' },
      },
      extraFiles: {
        'scripts/bootstrap-runtime.sh': '#!/usr/bin/env bash\nexit 42\n',
      },
      env: { SENDLENS_INSTANTLY_API_KEY: 'fresh-key' },
    })

    expect(run.status).toBe(42)
    expect(run.installedUserConfig?.values?.marker).toBe('previous-install')
    expect(run.stdout).toContain('Preparing local plugin runtime dependencies...')
  })

  it('reuses a content-addressed native runtime on warm generated installer runs', () => {
    const countFile = resolve(ROOT, 'shared-runtime-bootstrap-count.txt')
    const run = runGeneratedInstaller('cursor', {
      extraFiles: {
        '.pluxx-runtime.json': JSON.stringify({
          schema: 'pluxx.shared-runtime-config.v1',
          namespace: 'publish-plugin',
          bootstrap: 'scripts/bootstrap-runtime.sh',
          inputs: ['runtime-dependencies.lock.json'],
          output: 'node_modules',
        }),
        'runtime-dependencies.lock.json': JSON.stringify({ '@native/fixture': '1.0.0' }),
        'scripts/bootstrap-runtime.sh': [
          '#!/usr/bin/env bash',
          'set -euo pipefail',
          'count=0',
          'if [[ -f "$PLUXX_BOOTSTRAP_COUNT_FILE" ]]; then count="$(cat "$PLUXX_BOOTSTRAP_COUNT_FILE")"; fi',
          'echo "$((count + 1))" > "$PLUXX_BOOTSTRAP_COUNT_FILE"',
          'mkdir -p node_modules/@native/fixture',
          'printf "native-runtime\\n" > node_modules/@native/fixture/index.node',
          '',
        ].join('\n'),
      },
      env: {
        SENDLENS_INSTANTLY_API_KEY: 'fresh-key',
        PLUXX_BOOTSTRAP_COUNT_FILE: countFile,
      },
    })

    expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0)
    expect(readFileSync(countFile, 'utf-8').trim()).toBe('1')
    expect(run.stdout).toContain('Preparing shared Pluxx native runtime')
    expect(existsSync(resolve(run.pluginInstallDir, 'node_modules'))).toBe(true)
    const refPath = runtimeRefPath(resolve(run.rootDir, 'home/.pluxx/runtimes'), 'cursor', run.pluginInstallDir)
    const runtimeRef = JSON.parse(readFileSync(refPath, 'utf-8')) as { runtimeEntry: string }
    expect(existsSync(resolve(runtimeRef.runtimeEntry, 'node_modules/@native/fixture/index.node'))).toBe(true)
    expect(existsSync(resolve(runtimeRef.runtimeEntry, '.cursor-plugin/plugin.json'))).toBe(false)
    expect(existsSync(resolve(run.pluginInstallDir, '.pluxx-runtime-cache.env'))).toBe(false)

    const installerPath = resolve(run.rootDir, 'install-cursor-rerun.sh')
    writeFileSync(installerPath, run.installerContent)
    chmodSync(installerPath, 0o755)

    const rerun = spawnSync('bash', [installerPath], {
      encoding: 'utf-8',
      env: {
        ...isolatedInstallerEnvironment(process.env),
        HOME: resolve(run.rootDir, 'home'),
        TMPDIR: resolve(run.rootDir, 'tmp'),
        TMP: resolve(run.rootDir, 'tmp'),
        TEMP: resolve(run.rootDir, 'tmp'),
        PLUXX_CURSOR_INSTALL_DIR: run.pluginInstallDir,
        PLUXX_CURSOR_BUNDLE_PATH: run.archivePath,
        SENDLENS_INSTANTLY_API_KEY: 'fresh-key',
        PLUXX_BOOTSTRAP_COUNT_FILE: countFile,
      },
    })

    expect(rerun.status, `${rerun.stdout}\n${rerun.stderr}`).toBe(0)
    expect(rerun.stdout).toContain('Reusing prepared Pluxx native runtime')
    expect(readFileSync(countFile, 'utf-8').trim()).toBe('1')
  })

  it('falls back to local bootstrap when declared runtime inputs have no lockfile', () => {
    const countFile = resolve(ROOT, 'runtime-no-lockfile-bootstrap-count.txt')
    const run = runGeneratedInstaller('cursor', {
      extraFiles: {
        '.pluxx-runtime.json': JSON.stringify({
          schema: 'pluxx.shared-runtime-config.v1',
          namespace: 'publish-plugin',
          bootstrap: 'scripts/bootstrap-runtime.sh',
          inputs: ['runtime-dependencies.json'],
          output: 'node_modules',
        }),
        'runtime-dependencies.json': JSON.stringify({ '@native/fixture': '^1.0.0' }),
        'scripts/bootstrap-runtime.sh': '#!/usr/bin/env bash\nset -euo pipefail\necho 1 > "$PLUXX_BOOTSTRAP_COUNT_FILE"\nmkdir -p node_modules/@native/fixture\nprintf "native-runtime\\n" > node_modules/@native/fixture/index.node\n',
      },
      env: {
        SENDLENS_INSTANTLY_API_KEY: 'fresh-key',
        PLUXX_BOOTSTRAP_COUNT_FILE: countFile,
      },
    })

    expect(run.status, run.stdout + '\n' + run.stderr).toBe(0)
    expect(run.stderr).toContain('do not declare a deterministic lockfile')
    expect(run.stdout).toContain('Preparing local plugin runtime dependencies...')
    expect(run.stdout).not.toContain('Preparing shared Pluxx native runtime')
    expect(lstatSync(resolve(run.pluginInstallDir, 'node_modules')).isDirectory()).toBe(true)
    expect(readFileSync(countFile, 'utf-8').trim()).toBe('1')
  })

  it('prepares a distinct shared runtime when a declared runtime input changes', () => {
    const countFile = resolve(ROOT, 'shared-runtime-lifecycle-script-count.txt')
    const storeRoot = resolve(ROOT, 'shared-runtime-lifecycle-script-store')
    const bootstrap = [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'count=0',
      'if [[ -f "$PLUXX_BOOTSTRAP_COUNT_FILE" ]]; then count="$(cat "$PLUXX_BOOTSTRAP_COUNT_FILE")"; fi',
      'echo "$((count + 1))" > "$PLUXX_BOOTSTRAP_COUNT_FILE"',
      'mkdir -p node_modules/@native/fixture',
      'printf "native-runtime\\n" > node_modules/@native/fixture/index.node',
      '',
    ].join('\n')
    const install = (dependencyVersion: string) => runGeneratedInstaller('cursor', {
      extraFiles: {
        '.pluxx-runtime.json': JSON.stringify({
          schema: 'pluxx.shared-runtime-config.v1',
          namespace: 'publish-plugin',
          bootstrap: 'scripts/bootstrap-runtime.sh',
          inputs: ['runtime-dependencies.lock.json'],
          output: 'node_modules',
        }),
        'runtime-dependencies.lock.json': JSON.stringify({ '@native/fixture': dependencyVersion }),
        'scripts/bootstrap-runtime.sh': bootstrap,
      },
      env: {
        SENDLENS_INSTANTLY_API_KEY: 'fresh-key',
        PLUXX_BOOTSTRAP_COUNT_FILE: countFile,
        PLUXX_RUNTIME_STORE_ROOT: storeRoot,
      },
    })

    const first = install('1.0.0')
    const second = install('2.0.0')

    expect(first.status, first.stdout + '\n' + first.stderr).toBe(0)
    expect(second.status, second.stdout + '\n' + second.stderr).toBe(0)
    expect(second.stdout).toContain('Preparing shared Pluxx native runtime')
    expect(readFileSync(countFile, 'utf-8').trim()).toBe('2')
  })

  it('prepares a distinct shared runtime when an unchanged lifecycle command reads a changed bundled file', () => {
    const countFile = resolve(ROOT, 'shared-runtime-lifecycle-input-count.txt')
    const storeRoot = resolve(ROOT, 'shared-runtime-lifecycle-input-store')
    const bootstrap = [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'count=0',
      'if [[ -f "$PLUXX_BOOTSTRAP_COUNT_FILE" ]]; then count="$(cat "$PLUXX_BOOTSTRAP_COUNT_FILE")"; fi',
      'echo "$((count + 1))" > "$PLUXX_BOOTSTRAP_COUNT_FILE"',
      'mkdir -p node_modules/@native/fixture',
      'cat scripts/install-a.mjs > node_modules/@native/fixture/index.node',
      '',
    ].join('\n')
    const packageJson = JSON.stringify({
      name: 'publish-plugin-runtime',
      version: '1.2.3',
      scripts: { postinstall: 'node scripts/install-a.mjs' },
      dependencies: { '@native/fixture': '1.0.0' },
    })
    const packageLock = JSON.stringify({
      lockfileVersion: 3,
      packages: {
        '': { dependencies: { '@native/fixture': '1.0.0' } },
      },
    })
    const install = (scriptContent: string) => runGeneratedInstaller('cursor', {
      extraFiles: {
        '.pluxx-runtime.json': JSON.stringify({
          schema: 'pluxx.shared-runtime-config.v1',
          namespace: 'publish-plugin',
          bootstrap: 'scripts/bootstrap-runtime.sh',
          inputs: ['package.json', 'package-lock.json', 'scripts/install-a.mjs'],
          output: 'node_modules',
        }),
        'package.json': packageJson,
        'package-lock.json': packageLock,
        'scripts/bootstrap-runtime.sh': bootstrap,
        'scripts/install-a.mjs': scriptContent,
      },
      env: {
        SENDLENS_INSTANTLY_API_KEY: 'fresh-key',
        PLUXX_BOOTSTRAP_COUNT_FILE: countFile,
        PLUXX_RUNTIME_STORE_ROOT: storeRoot,
      },
    })

    const first = install('first runtime input\n')
    const second = install('second runtime input\n')

    expect(first.status, first.stdout + '\n' + first.stderr).toBe(0)
    expect(second.status, second.stdout + '\n' + second.stderr).toBe(0)
    expect(second.stdout).toContain('Preparing shared Pluxx native runtime')
    expect(readFileSync(countFile, 'utf-8').trim()).toBe('2')
  })

  it('reuses one shared runtime across compatible core host bundles', () => {
    const countFile = resolve(ROOT, 'shared-runtime-cross-host-count.txt')
    const storeRoot = resolve(ROOT, 'shared-runtime-cross-host-store')
    const bootstrap = [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'count=0',
      'if [[ -f "$PLUXX_BOOTSTRAP_COUNT_FILE" ]]; then count="$(cat "$PLUXX_BOOTSTRAP_COUNT_FILE")"; fi',
      'echo "$((count + 1))" > "$PLUXX_BOOTSTRAP_COUNT_FILE"',
      'mkdir -p node_modules/@native/fixture',
      'printf "native-runtime\\n" > node_modules/@native/fixture/index.node',
      '',
    ].join('\n')
    const runtimeFiles = {
      '.pluxx-runtime.json': JSON.stringify({
        schema: 'pluxx.shared-runtime-config.v1',
        namespace: 'publish-plugin',
        bootstrap: 'scripts/bootstrap-runtime.sh',
        inputs: ['package.json', 'package-lock.json', '.npmrc', 'patches/native-fixture.patch', 'scripts/install-a.mjs'],
        output: 'node_modules',
      }),
      'package.json': JSON.stringify({
        name: 'publish-plugin-runtime',
        version: '1.2.3',
        dependencies: { '@native/fixture': '1.0.0' },
      }),
      'package-lock.json': JSON.stringify({
        lockfileVersion: 3,
        packages: {
          '': { dependencies: { '@native/fixture': '1.0.0' } },
        },
      }),
      '.npmrc': 'fund=false\n',
      'patches/native-fixture.patch': 'runtime patch\n',
      'scripts/bootstrap-runtime.sh': bootstrap,
      'scripts/install-a.mjs': 'runtime helper\n',
    }
    const install = (platform: 'cursor' | 'codex', env: Record<string, string>) => runGeneratedInstaller(platform, {
      extraFiles: runtimeFiles,
      env: {
        SENDLENS_INSTANTLY_API_KEY: 'fresh-key',
        PLUXX_BOOTSTRAP_COUNT_FILE: countFile,
        PLUXX_RUNTIME_STORE_ROOT: storeRoot,
        ...env,
      },
    })

    const cursor = install('cursor', {})
    const codex = install('codex', { PLUXX_CODEX_CONFIG_PATH: resolve(ROOT, 'cross-host-codex-config.toml') })

    expect(cursor.status, cursor.stdout + '\n' + cursor.stderr).toBe(0)
    expect(codex.status, codex.stdout + '\n' + codex.stderr).toBe(0)
    expect(cursor.stdout).toContain('Preparing shared Pluxx native runtime')
    expect(codex.stdout).toContain('Reusing prepared Pluxx native runtime')
    expect(readFileSync(countFile, 'utf-8').trim()).toBe('1')

    const cursorRef = JSON.parse(readFileSync(runtimeRefPath(storeRoot, 'cursor', cursor.pluginInstallDir), 'utf-8')) as { runtimeEntry: string; fingerprint: string }
    const codexRef = JSON.parse(readFileSync(runtimeRefPath(storeRoot, 'codex', codex.pluginInstallDir), 'utf-8')) as { runtimeEntry: string; fingerprint: string }
    expect(codexRef.fingerprint).toBe(cursorRef.fingerprint)
    expect(codexRef.runtimeEntry).toBe(cursorRef.runtimeEntry)
    expect(existsSync(resolve(cursorRef.runtimeEntry, 'node_modules/@native/fixture/index.node'))).toBe(true)
  })

  it('repairs a corrupted matching shared runtime before relinking it', () => {
    const countFile = resolve(ROOT, 'shared-runtime-repair-count.txt')
    const runtimeFiles = {
      '.pluxx-runtime.json': JSON.stringify({
        schema: 'pluxx.shared-runtime-config.v1',
        namespace: 'publish-plugin',
        bootstrap: 'scripts/bootstrap-runtime.sh',
        inputs: ['runtime-dependencies.lock.json'],
        output: 'node_modules',
      }),
      'runtime-dependencies.lock.json': JSON.stringify({ '@native/fixture': '1.0.0' }),
      'scripts/bootstrap-runtime.sh': [
        '#!/usr/bin/env bash',
        'set -euo pipefail',
        'count=0',
        'if [[ -f "$PLUXX_BOOTSTRAP_COUNT_FILE" ]]; then count="$(cat "$PLUXX_BOOTSTRAP_COUNT_FILE")"; fi',
        'echo "$((count + 1))" > "$PLUXX_BOOTSTRAP_COUNT_FILE"',
        'mkdir -p node_modules/@native/fixture',
        'printf "native-runtime\\n" > node_modules/@native/fixture/index.node',
        '',
      ].join('\n'),
    }
    const run = runGeneratedInstaller('cursor', {
      extraFiles: runtimeFiles,
      env: {
        SENDLENS_INSTANTLY_API_KEY: 'fresh-key',
        PLUXX_BOOTSTRAP_COUNT_FILE: countFile,
      },
    })

    expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0)
    const refPath = runtimeRefPath(resolve(run.rootDir, 'home/.pluxx/runtimes'), 'cursor', run.pluginInstallDir)
    const runtimeRef = JSON.parse(readFileSync(refPath, 'utf-8')) as { runtimeEntry: string }
    const nativeFixturePath = resolve(runtimeRef.runtimeEntry, 'node_modules/@native/fixture/index.node')
    chmodSync(nativeFixturePath, 0o644)
    writeFileSync(nativeFixturePath, 'corrupted\n')

    const installerPath = resolve(run.rootDir, 'install-cursor-repair.sh')
    writeFileSync(installerPath, run.installerContent)
    chmodSync(installerPath, 0o755)

    const rerun = spawnSync('bash', [installerPath], {
      encoding: 'utf-8',
      env: {
        ...isolatedInstallerEnvironment(process.env),
        HOME: resolve(run.rootDir, 'home'),
        TMPDIR: resolve(run.rootDir, 'tmp'),
        TMP: resolve(run.rootDir, 'tmp'),
        TEMP: resolve(run.rootDir, 'tmp'),
        PLUXX_CURSOR_INSTALL_DIR: run.pluginInstallDir,
        PLUXX_CURSOR_BUNDLE_PATH: run.archivePath,
        SENDLENS_INSTANTLY_API_KEY: 'fresh-key',
        PLUXX_BOOTSTRAP_COUNT_FILE: countFile,
      },
    })

    expect(rerun.status, `${rerun.stdout}\n${rerun.stderr}`).toBe(0)
    expect(rerun.stdout).toContain('Repairing incomplete Pluxx native runtime')
    expect(readFileSync(countFile, 'utf-8').trim()).toBe('2')
  })

  it('reuses one declared native runtime across the generated core-four installers', () => {
    const countFile = resolve(ROOT, 'core-four-runtime-bootstrap-count.txt')
    const storeRoot = resolve(ROOT, 'core-four-runtime-store')
    const runtimeFiles = {
      '.pluxx-runtime.json': JSON.stringify({
        schema: 'pluxx.shared-runtime-config.v1',
        namespace: 'publish-plugin',
        bootstrap: 'scripts/bootstrap-runtime.sh',
        inputs: ['scripts/runtime-dependencies.lock.json'],
        output: 'node_modules',
      }),
      'scripts/runtime-dependencies.lock.json': JSON.stringify({ '@native/fixture': '1.0.0' }),
      'scripts/bootstrap-runtime.sh': [
        '#!/usr/bin/env bash',
        'set -euo pipefail',
        'count=0',
        'if [[ -f "$PLUXX_BOOTSTRAP_COUNT_FILE" ]]; then count="$(cat "$PLUXX_BOOTSTRAP_COUNT_FILE")"; fi',
        'echo "$((count + 1))" > "$PLUXX_BOOTSTRAP_COUNT_FILE"',
        'mkdir -p node_modules/@native/fixture',
        'printf "native-runtime\\n" > node_modules/@native/fixture/index.node',
        '',
      ].join('\n'),
    }
    const fingerprints = new Set<string>()

    for (const platform of ['claude-code', 'cursor', 'codex', 'opencode'] as TargetPlatform[]) {
      const run = runGeneratedInstaller(platform, {
        extraFiles: runtimeFiles,
        env: {
          SENDLENS_INSTANTLY_API_KEY: 'fresh-key',
          PLUXX_BOOTSTRAP_COUNT_FILE: countFile,
          PLUXX_RUNTIME_STORE_ROOT: storeRoot,
        },
      })
      expect(run.status, `${platform}\n${run.stdout}\n${run.stderr}`).toBe(0)
      expect(lstatSync(resolve(run.pluginInstallDir, 'node_modules')).isSymbolicLink()).toBe(true)
      const ref = JSON.parse(readFileSync(runtimeRefPath(storeRoot, platform, run.pluginInstallDir), 'utf-8')) as { fingerprint: string; installPath: string }
      fingerprints.add(ref.fingerprint)
      expect(ref.installPath).toBe(resolve(run.pluginInstallDir))
    }

    expect(readFileSync(countFile, 'utf-8').trim()).toBe('1')
    expect(fingerprints.size).toBe(1)
  })

  it('keeps independent runtime references for multiple installs of the same host', () => {
    const storeRoot = resolve(ROOT, 'multi-install-runtime-store')
    const runtimeFiles = {
      '.pluxx-runtime.json': JSON.stringify({
        schema: 'pluxx.shared-runtime-config.v1',
        namespace: 'publish-plugin',
        bootstrap: 'scripts/bootstrap-runtime.sh',
        inputs: ['runtime-dependencies.lock.json'],
        output: 'node_modules',
      }),
      'runtime-dependencies.lock.json': JSON.stringify({ '@native/fixture': '1.0.0' }),
      'scripts/bootstrap-runtime.sh': '#!/usr/bin/env bash\nset -euo pipefail\nmkdir -p node_modules/@native/fixture\nprintf "native-runtime\\n" > node_modules/@native/fixture/index.node\n',
    }
    const first = runGeneratedInstaller('cursor', {
      extraFiles: runtimeFiles,
      env: { SENDLENS_INSTANTLY_API_KEY: 'fresh-key', PLUXX_RUNTIME_STORE_ROOT: storeRoot },
    })
    expect(first.status, first.stdout + '\n' + first.stderr).toBe(0)

    const secondInstallDir = resolve(first.rootDir, 'installed-cursor-second')
    const installerPath = resolve(first.rootDir, 'install-cursor-second.sh')
    writeFileSync(installerPath, first.installerContent)
    chmodSync(installerPath, 0o755)
    const second = spawnSync('bash', [installerPath], {
      encoding: 'utf-8',
      env: {
        ...isolatedInstallerEnvironment(process.env),
        HOME: resolve(first.rootDir, 'home'),
        TMPDIR: resolve(first.rootDir, 'tmp'),
        PLUXX_CURSOR_INSTALL_DIR: secondInstallDir,
        PLUXX_CURSOR_BUNDLE_PATH: first.archivePath,
        PLUXX_RUNTIME_STORE_ROOT: storeRoot,
        SENDLENS_INSTANTLY_API_KEY: 'fresh-key',
      },
    })
    expect(second.status, second.stdout + '\n' + second.stderr).toBe(0)

    const firstRef = JSON.parse(readFileSync(runtimeRefPath(storeRoot, 'cursor', first.pluginInstallDir), 'utf-8')) as { fingerprint: string }
    const secondRef = JSON.parse(readFileSync(runtimeRefPath(storeRoot, 'cursor', secondInstallDir), 'utf-8')) as { fingerprint: string }
    expect(firstRef.fingerprint).toBe(secondRef.fingerprint)
    expect(readdirSync(resolve(storeRoot, 'refs/publish-plugin')).filter((name) => name.startsWith('cursor-'))).toHaveLength(2)
  })

  it('recovers a stale shared-runtime lock without waiting for the full timeout', () => {
    const countFile = resolve(ROOT, 'stale-lock-bootstrap-count.txt')
    const storeRoot = resolve(ROOT, 'stale-lock-runtime-store')
    const runtimeFiles = {
      '.pluxx-runtime.json': JSON.stringify({
        schema: 'pluxx.shared-runtime-config.v1',
        namespace: 'publish-plugin',
        bootstrap: 'scripts/bootstrap-runtime.sh',
        inputs: ['runtime-dependencies.lock.json'],
        output: 'node_modules',
      }),
      'runtime-dependencies.lock.json': JSON.stringify({ '@native/fixture': '1.0.0' }),
      'scripts/bootstrap-runtime.sh': '#!/usr/bin/env bash\nset -euo pipefail\ncount=0\n[[ ! -f "$PLUXX_BOOTSTRAP_COUNT_FILE" ]] || count="$(cat "$PLUXX_BOOTSTRAP_COUNT_FILE")"\necho "$((count + 1))" > "$PLUXX_BOOTSTRAP_COUNT_FILE"\nmkdir -p node_modules/@native/fixture\nprintf "native-runtime\\n" > node_modules/@native/fixture/index.node\n',
    }
    const run = runGeneratedInstaller('cursor', {
      extraFiles: runtimeFiles,
      env: { SENDLENS_INSTANTLY_API_KEY: 'fresh-key', PLUXX_BOOTSTRAP_COUNT_FILE: countFile, PLUXX_RUNTIME_STORE_ROOT: storeRoot },
    })
    expect(run.status, run.stdout + '\n' + run.stderr).toBe(0)
    const ref = JSON.parse(readFileSync(runtimeRefPath(storeRoot, 'cursor', run.pluginInstallDir), 'utf-8')) as { fingerprint: string }
    const staleLock = resolve(storeRoot, `locks/${ref.fingerprint}.lock`)
    mkdirSync(staleLock, { recursive: true })
    writeFileSync(resolve(staleLock, 'owner.json'), JSON.stringify({ pid: 2147483647, startedAt: '2000-01-01T00:00:00.000Z' }))

    const installerPath = resolve(run.rootDir, 'install-cursor-stale-lock.sh')
    writeFileSync(installerPath, run.installerContent)
    chmodSync(installerPath, 0o755)
    const started = Date.now()
    const rerun = spawnSync('bash', [installerPath], {
      encoding: 'utf-8',
      env: {
        ...isolatedInstallerEnvironment(process.env),
        HOME: resolve(run.rootDir, 'home'),
        TMPDIR: resolve(run.rootDir, 'tmp'),
        PLUXX_CURSOR_INSTALL_DIR: run.pluginInstallDir,
        PLUXX_CURSOR_BUNDLE_PATH: run.archivePath,
        SENDLENS_INSTANTLY_API_KEY: 'fresh-key',
        PLUXX_BOOTSTRAP_COUNT_FILE: countFile,
        PLUXX_RUNTIME_STORE_ROOT: storeRoot,
      },
    })

    expect(rerun.status, rerun.stdout + '\n' + rerun.stderr).toBe(0)
    expect(Date.now() - started).toBeLessThan(2000)
    expect(readFileSync(countFile, 'utf-8').trim()).toBe('1')
    expect(existsSync(staleLock)).toBe(false)
  })

  it('falls back locally when an orphaned recovery lock blocks stale-lock recovery', () => {
    const countFile = resolve(ROOT, 'orphaned-recovery-lock-bootstrap-count.txt')
    const storeRoot = resolve(ROOT, 'orphaned-recovery-lock-store')
    const runtimeFiles = {
      '.pluxx-runtime.json': JSON.stringify({
        schema: 'pluxx.shared-runtime-config.v1',
        namespace: 'publish-plugin',
        bootstrap: 'scripts/bootstrap-runtime.sh',
        inputs: ['runtime-dependencies.lock.json'],
        output: 'node_modules',
      }),
      'runtime-dependencies.lock.json': JSON.stringify({ '@native/fixture': '1.0.0' }),
      'scripts/bootstrap-runtime.sh': '#!/usr/bin/env bash\nset -euo pipefail\ncount=0\n[[ ! -f "$PLUXX_BOOTSTRAP_COUNT_FILE" ]] || count="$(cat "$PLUXX_BOOTSTRAP_COUNT_FILE")"\necho "$((count + 1))" > "$PLUXX_BOOTSTRAP_COUNT_FILE"\nmkdir -p node_modules/@native/fixture\nprintf "native-runtime\\n" > node_modules/@native/fixture/index.node\n',
    }
    const run = runGeneratedInstaller('cursor', {
      extraFiles: runtimeFiles,
      env: { SENDLENS_INSTANTLY_API_KEY: 'fresh-key', PLUXX_BOOTSTRAP_COUNT_FILE: countFile, PLUXX_RUNTIME_STORE_ROOT: storeRoot },
    })
    expect(run.status, run.stdout + '\n' + run.stderr).toBe(0)
    const ref = JSON.parse(readFileSync(runtimeRefPath(storeRoot, 'cursor', run.pluginInstallDir), 'utf-8')) as { fingerprint: string }
    const staleLock = resolve(storeRoot, `locks/${ref.fingerprint}.lock`)
    mkdirSync(staleLock, { recursive: true })
    writeFileSync(resolve(staleLock, 'owner.json'), JSON.stringify({ pid: 2147483647, startedAt: '2000-01-01T00:00:00.000Z' }))
    mkdirSync(staleLock + '.recovery')

    const installerPath = resolve(run.rootDir, 'install-cursor-orphaned-recovery-lock.sh')
    writeFileSync(installerPath, run.installerContent)
    chmodSync(installerPath, 0o755)
    const rerun = spawnSync('bash', [installerPath], {
      encoding: 'utf-8',
      env: {
        ...isolatedInstallerEnvironment(process.env),
        HOME: resolve(run.rootDir, 'home'),
        TMPDIR: resolve(run.rootDir, 'tmp'),
        PLUXX_CURSOR_INSTALL_DIR: run.pluginInstallDir,
        PLUXX_CURSOR_BUNDLE_PATH: run.archivePath,
        SENDLENS_INSTANTLY_API_KEY: 'fresh-key',
        PLUXX_BOOTSTRAP_COUNT_FILE: countFile,
        PLUXX_RUNTIME_STORE_ROOT: storeRoot,
        PLUXX_RUNTIME_LOCK_TIMEOUT_SECONDS: '0',
      },
    })

    expect(rerun.status, rerun.stdout + '\n' + rerun.stderr).toBe(0)
    expect(rerun.stderr).toContain('Could not acquire shared runtime lock')
    expect(lstatSync(resolve(run.pluginInstallDir, 'node_modules')).isDirectory()).toBe(true)
    expect(readFileSync(countFile, 'utf-8').trim()).toBe('2')
  })

  it('falls back to a host-local runtime when shared linking is unavailable', () => {
    const countFile = resolve(ROOT, 'link-fallback-bootstrap-count.txt')
    const run = runGeneratedInstaller('cursor', {
      extraFiles: {
        '.pluxx-runtime.json': JSON.stringify({
          schema: 'pluxx.shared-runtime-config.v1',
          namespace: 'publish-plugin',
          bootstrap: 'scripts/bootstrap-runtime.sh',
          inputs: ['runtime-dependencies.lock.json'],
          output: 'node_modules',
        }),
        'runtime-dependencies.lock.json': JSON.stringify({ '@native/fixture': '1.0.0' }),
        'scripts/bootstrap-runtime.sh': '#!/usr/bin/env bash\nset -euo pipefail\ncount=0\n[[ ! -f "$PLUXX_BOOTSTRAP_COUNT_FILE" ]] || count="$(cat "$PLUXX_BOOTSTRAP_COUNT_FILE")"\necho "$((count + 1))" > "$PLUXX_BOOTSTRAP_COUNT_FILE"\nmkdir -p node_modules/@native/fixture\nprintf "native-runtime\\n" > node_modules/@native/fixture/index.node\n',
      },
      env: {
        SENDLENS_INSTANTLY_API_KEY: 'fresh-key',
        PLUXX_BOOTSTRAP_COUNT_FILE: countFile,
        PLUXX_RUNTIME_DISABLE_LINK: '1',
      },
    })

    expect(run.status, run.stdout + '\n' + run.stderr).toBe(0)
    expect(run.stderr).toContain('Could not link the shared runtime')
    expect(lstatSync(resolve(run.pluginInstallDir, 'node_modules')).isDirectory()).toBe(true)
    expect(readFileSync(countFile, 'utf-8').trim()).toBe('2')
  })

  it('uses a declared non-default bootstrap path without requiring the legacy script', () => {
    const run = runGeneratedInstaller('cursor', {
      extraFiles: {
        '.pluxx-runtime.json': JSON.stringify({
          schema: 'pluxx.shared-runtime-config.v1',
          namespace: 'publish-plugin',
          bootstrap: 'runtime/install-native.sh',
          inputs: ['runtime/dependencies.lock.json'],
          output: 'node_modules',
        }),
        'runtime/dependencies.lock.json': JSON.stringify({ '@native/fixture': '1.0.0' }),
        'runtime/install-native.sh': '#!/usr/bin/env bash\nset -euo pipefail\nmkdir -p node_modules/@native/fixture\nprintf "native-runtime\\n" > node_modules/@native/fixture/index.node\n',
      },
      env: { SENDLENS_INSTANTLY_API_KEY: 'fresh-key' },
    })

    expect(run.status, run.stdout + '\n' + run.stderr).toBe(0)
    expect(run.stdout).toContain('Preparing shared Pluxx native runtime')
    expect(existsSync(resolve(run.pluginInstallDir, 'node_modules/@native/fixture/index.node'))).toBe(true)
  })

  it('releases the shared lock and preserves bootstrap exit status on failure', () => {
    const storeRoot = resolve(ROOT, 'failed-shared-runtime-store')
    const run = runGeneratedInstaller('cursor', {
      extraFiles: {
        '.pluxx-runtime.json': JSON.stringify({
          schema: 'pluxx.shared-runtime-config.v1',
          namespace: 'publish-plugin',
          bootstrap: 'scripts/bootstrap-runtime.sh',
          inputs: ['runtime-dependencies.lock.json'],
          output: 'node_modules',
        }),
        'runtime-dependencies.lock.json': JSON.stringify({ '@native/fixture': '1.0.0' }),
        'scripts/bootstrap-runtime.sh': '#!/usr/bin/env bash\nexit 42\n',
      },
      env: {
        SENDLENS_INSTANTLY_API_KEY: 'fresh-key',
        PLUXX_RUNTIME_STORE_ROOT: storeRoot,
      },
    })

    expect(run.status).toBe(42)
    expect(readdirSync(resolve(storeRoot, 'locks'))).toEqual([])
  })

  it('does not release a shared lock whose ownership changed', () => {
    const storeRoot = resolve(ROOT, 'replaced-runtime-lock-store')
    const run = runGeneratedInstaller('cursor', {
      extraFiles: {
        '.pluxx-runtime.json': JSON.stringify({
          schema: 'pluxx.shared-runtime-config.v1',
          namespace: 'publish-plugin',
          bootstrap: 'scripts/bootstrap-runtime.sh',
          inputs: ['runtime-dependencies.lock.json'],
          output: 'node_modules',
        }),
        'runtime-dependencies.lock.json': JSON.stringify({ '@native/fixture': '1.0.0' }),
        'scripts/bootstrap-runtime.sh': '#!/usr/bin/env bash\nset -euo pipefail\nowner="$(find "$PLUXX_RUNTIME_STORE_ROOT/locks" -name owner.json -print -quit)"\nprintf \'{"pid":%s,"nonce":"replacement"}\\n\' "$$" > "$owner"\nmkdir -p node_modules/@native/fixture\nprintf "native-runtime\\n" > node_modules/@native/fixture/index.node\n',
      },
      env: {
        SENDLENS_INSTANTLY_API_KEY: 'fresh-key',
        PLUXX_RUNTIME_STORE_ROOT: storeRoot,
      },
    })

    expect(run.status, run.stdout + '\n' + run.stderr).toBe(0)
    const remainingLocks = readdirSync(resolve(storeRoot, 'locks'))
    expect(remainingLocks).toHaveLength(1)
    const owner = JSON.parse(readFileSync(resolve(storeRoot, 'locks', remainingLocks[0]!, 'owner.json'), 'utf-8')) as { nonce: string }
    expect(owner.nonce).toBe('replacement')
  })

  it('rolls back the install when the post-swap runtime reference cannot commit', () => {
    const storeRoot = resolve(ROOT, 'failed-runtime-ref-store')
    mkdirSync(storeRoot, { recursive: true })
    writeFileSync(resolve(storeRoot, 'refs'), 'blocks reference directory\n')
    const run = runGeneratedInstaller('cursor', {
      existingUserConfig: { values: { marker: 'previous-install' } },
      extraFiles: {
        '.pluxx-runtime.json': JSON.stringify({
          schema: 'pluxx.shared-runtime-config.v1',
          namespace: 'publish-plugin',
          bootstrap: 'scripts/bootstrap-runtime.sh',
          inputs: ['runtime-dependencies.lock.json'],
          output: 'node_modules',
        }),
        'runtime-dependencies.lock.json': JSON.stringify({ '@native/fixture': '1.0.0' }),
        'scripts/bootstrap-runtime.sh': '#!/usr/bin/env bash\nset -euo pipefail\nmkdir -p node_modules/@native/fixture\nprintf "native-runtime\\n" > node_modules/@native/fixture/index.node\n',
      },
      env: {
        SENDLENS_INSTANTLY_API_KEY: 'fresh-key',
        PLUXX_RUNTIME_STORE_ROOT: storeRoot,
      },
    })

    expect(run.status).not.toBe(0)
    expect(run.installedUserConfig?.values?.marker).toBe('previous-install')
  })

  it('falls back locally when a live shared-runtime lock exceeds the configured wait', () => {
    const countFile = resolve(ROOT, 'active-lock-bootstrap-count.txt')
    const storeRoot = resolve(ROOT, 'active-lock-runtime-store')
    const runtimeFiles = {
      '.pluxx-runtime.json': JSON.stringify({
        schema: 'pluxx.shared-runtime-config.v1',
        namespace: 'publish-plugin',
        bootstrap: 'scripts/bootstrap-runtime.sh',
        inputs: ['runtime-dependencies.lock.json'],
        output: 'node_modules',
      }),
      'runtime-dependencies.lock.json': JSON.stringify({ '@native/fixture': '1.0.0' }),
      'scripts/bootstrap-runtime.sh': '#!/usr/bin/env bash\nset -euo pipefail\ncount=0\n[[ ! -f "$PLUXX_BOOTSTRAP_COUNT_FILE" ]] || count="$(cat "$PLUXX_BOOTSTRAP_COUNT_FILE")"\necho "$((count + 1))" > "$PLUXX_BOOTSTRAP_COUNT_FILE"\nmkdir -p node_modules/@native/fixture\nprintf "native-runtime\\n" > node_modules/@native/fixture/index.node\n',
    }
    const run = runGeneratedInstaller('cursor', {
      extraFiles: runtimeFiles,
      env: { SENDLENS_INSTANTLY_API_KEY: 'fresh-key', PLUXX_BOOTSTRAP_COUNT_FILE: countFile, PLUXX_RUNTIME_STORE_ROOT: storeRoot },
    })
    expect(run.status, run.stdout + '\n' + run.stderr).toBe(0)
    const ref = JSON.parse(readFileSync(runtimeRefPath(storeRoot, 'cursor', run.pluginInstallDir), 'utf-8')) as { fingerprint: string }
    const liveLock = resolve(storeRoot, `locks/${ref.fingerprint}.lock`)
    mkdirSync(liveLock, { recursive: true })
    writeFileSync(resolve(liveLock, 'owner.json'), JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }))
    const installerPath = resolve(run.rootDir, 'install-cursor-active-lock.sh')
    writeFileSync(installerPath, run.installerContent)
    chmodSync(installerPath, 0o755)

    const rerun = spawnSync('bash', [installerPath], {
      encoding: 'utf-8',
      env: {
        ...isolatedInstallerEnvironment(process.env),
        HOME: resolve(run.rootDir, 'home'),
        TMPDIR: resolve(run.rootDir, 'tmp'),
        PLUXX_CURSOR_INSTALL_DIR: run.pluginInstallDir,
        PLUXX_CURSOR_BUNDLE_PATH: run.archivePath,
        SENDLENS_INSTANTLY_API_KEY: 'fresh-key',
        PLUXX_BOOTSTRAP_COUNT_FILE: countFile,
        PLUXX_RUNTIME_STORE_ROOT: storeRoot,
        PLUXX_RUNTIME_LOCK_TIMEOUT_SECONDS: '0',
      },
    })

    expect(rerun.status, rerun.stdout + '\n' + rerun.stderr).toBe(0)
    expect(rerun.stderr).toContain('Could not acquire shared runtime lock')
    expect(lstatSync(resolve(run.pluginInstallDir, 'node_modules')).isDirectory()).toBe(true)
    expect(readFileSync(countFile, 'utf-8').trim()).toBe('2')
    expect(existsSync(liveLock)).toBe(true)
  })

  it('removes the old shared-runtime reference after a host-local update', () => {
    const storeRoot = resolve(ROOT, 'host-local-update-runtime-store')
    const shared = runGeneratedInstaller('cursor', {
      extraFiles: {
        '.pluxx-runtime.json': JSON.stringify({
          schema: 'pluxx.shared-runtime-config.v1',
          namespace: 'publish-plugin',
          bootstrap: 'scripts/bootstrap-runtime.sh',
          inputs: ['runtime-dependencies.lock.json'],
          output: 'node_modules',
        }),
        'runtime-dependencies.lock.json': JSON.stringify({ '@native/fixture': '1.0.0' }),
        'scripts/bootstrap-runtime.sh': '#!/usr/bin/env bash\nset -euo pipefail\nmkdir -p node_modules/@native/fixture\nprintf "native-runtime\\n" > node_modules/@native/fixture/index.node\n',
      },
      env: { SENDLENS_INSTANTLY_API_KEY: 'fresh-key', PLUXX_RUNTIME_STORE_ROOT: storeRoot },
    })
    const refPath = runtimeRefPath(storeRoot, 'cursor', shared.pluginInstallDir)
    expect(shared.status, shared.stdout + '\n' + shared.stderr).toBe(0)
    expect(existsSync(refPath)).toBe(true)

    const local = runGeneratedInstaller('cursor', {
      env: { SENDLENS_INSTANTLY_API_KEY: 'fresh-key', PLUXX_RUNTIME_STORE_ROOT: storeRoot },
    })
    const installerPath = resolve(local.rootDir, 'install-cursor-host-local-update.sh')
    writeFileSync(installerPath, local.installerContent)
    chmodSync(installerPath, 0o755)
    const update = spawnSync('bash', [installerPath], {
      encoding: 'utf-8',
      env: {
        ...isolatedInstallerEnvironment(process.env),
        HOME: resolve(local.rootDir, 'home'),
        TMPDIR: resolve(local.rootDir, 'tmp'),
        PLUXX_CURSOR_INSTALL_DIR: shared.pluginInstallDir,
        PLUXX_CURSOR_BUNDLE_PATH: local.archivePath,
        SENDLENS_INSTANTLY_API_KEY: 'fresh-key',
        PLUXX_RUNTIME_STORE_ROOT: storeRoot,
      },
    })

    expect(update.status, update.stdout + '\n' + update.stderr).toBe(0)
    expect(existsSync(refPath)).toBe(false)
  })

  it('keeps an unreferenced warm entry alive while another installer holds a lease', async () => {
    const storeRoot = resolve(ROOT, 'runtime-lease-gc-store')
    const runtimeFiles = {
      '.pluxx-runtime.json': JSON.stringify({
        schema: 'pluxx.shared-runtime-config.v1',
        namespace: 'publish-plugin',
        bootstrap: 'scripts/bootstrap-runtime.sh',
        inputs: ['runtime-dependencies.lock.json'],
        output: 'node_modules',
      }),
      'runtime-dependencies.lock.json': JSON.stringify({ '@native/fixture': '1.0.0' }),
      'scripts/bootstrap-runtime.sh': '#!/usr/bin/env bash\nset -euo pipefail\nmkdir -p node_modules/@native/fixture\nprintf "native-runtime\\n" > node_modules/@native/fixture/index.node\n',
    }
    const cursor = runGeneratedInstaller('cursor', {
      extraFiles: runtimeFiles,
      env: { SENDLENS_INSTANTLY_API_KEY: 'fresh-key', PLUXX_RUNTIME_STORE_ROOT: storeRoot },
    })
    const codex = runGeneratedInstaller('codex', {
      extraFiles: runtimeFiles,
      env: { SENDLENS_INSTANTLY_API_KEY: 'fresh-key', PLUXX_RUNTIME_STORE_ROOT: storeRoot },
    })
    expect(cursor.status, cursor.stdout + '\n' + cursor.stderr).toBe(0)
    expect(codex.status, codex.stdout + '\n' + codex.stderr).toBe(0)
    const cursorRefPath = runtimeRefPath(storeRoot, 'cursor', cursor.pluginInstallDir)
    const codexRefPath = runtimeRefPath(storeRoot, 'codex', codex.pluginInstallDir)
    const runtimeRef = JSON.parse(readFileSync(cursorRefPath, 'utf-8')) as { fingerprint: string }
    rmSync(cursorRefPath)
    rmSync(codexRefPath)
    const entryRoot = resolve(storeRoot, `entries/${runtimeRef.fingerprint}`)
    const oldDate = new Date('2000-01-01T00:00:00.000Z')
    utimesSync(entryRoot, oldDate, oldDate)

    const fakeBin = resolve(ROOT, 'runtime-lease-fake-bin')
    const pauseMarker = resolve(ROOT, 'runtime-lease-paused')
    mkdirSync(fakeBin, { recursive: true })
    writeFileSync(resolve(fakeBin, 'mv'), '#!/usr/bin/env bash\nset -euo pipefail\nif [[ ! -f "$PLUXX_PAUSE_MARKER" ]]; then touch "$PLUXX_PAUSE_MARKER"; sleep 2; fi\nexec /bin/mv "$@"\n')
    chmodSync(resolve(fakeBin, 'mv'), 0o755)
    const cursorInstaller = resolve(cursor.rootDir, 'install-cursor-lease-pause.sh')
    writeFileSync(cursorInstaller, cursor.installerContent)
    chmodSync(cursorInstaller, 0o755)
    const paused = spawn('bash', [cursorInstaller], {
      env: {
        ...isolatedInstallerEnvironment(process.env),
        PATH: `${fakeBin}:${process.env.PATH}`,
        HOME: resolve(cursor.rootDir, 'home'),
        TMPDIR: resolve(cursor.rootDir, 'tmp'),
        PLUXX_CURSOR_INSTALL_DIR: cursor.pluginInstallDir,
        PLUXX_CURSOR_BUNDLE_PATH: cursor.archivePath,
        PLUXX_RUNTIME_STORE_ROOT: storeRoot,
        PLUXX_RUNTIME_GC_GRACE_SECONDS: '0',
        PLUXX_PAUSE_MARKER: pauseMarker,
        SENDLENS_INSTANTLY_API_KEY: 'fresh-key',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let pausedStdout = ''
    let pausedStderr = ''
    paused.stdout.on('data', (chunk) => { pausedStdout += chunk.toString() })
    paused.stderr.on('data', (chunk) => { pausedStderr += chunk.toString() })
    const pausedResult = new Promise<number | null>((resolveResult) => paused.on('close', resolveResult))
    for (let attempt = 0; attempt < 100 && !existsSync(pauseMarker); attempt += 1) {
      await new Promise((resolveSleep) => setTimeout(resolveSleep, 25))
    }
    expect(existsSync(pauseMarker)).toBe(true)

    const codexInstaller = resolve(codex.rootDir, 'install-codex-lease-gc.sh')
    writeFileSync(codexInstaller, codex.installerContent)
    chmodSync(codexInstaller, 0o755)
    const gcRun = spawnSync('bash', [codexInstaller], {
      encoding: 'utf-8',
      env: {
        ...isolatedInstallerEnvironment(process.env),
        HOME: resolve(codex.rootDir, 'home'),
        TMPDIR: resolve(codex.rootDir, 'tmp'),
        PLUXX_CODEX_INSTALL_DIR: codex.pluginInstallDir,
        PLUXX_CODEX_BUNDLE_PATH: codex.archivePath,
        PLUXX_CODEX_MARKETPLACE_PATH: resolve(codex.rootDir, 'codex-marketplace.json'),
        PLUXX_CODEX_CONFIG_PATH: resolve(codex.rootDir, 'codex-config.toml'),
        PLUXX_CODEX_ENABLE_PLUGIN_HOOKS: '0',
        PLUXX_RUNTIME_STORE_ROOT: storeRoot,
        PLUXX_RUNTIME_GC_GRACE_SECONDS: '0',
        SENDLENS_INSTANTLY_API_KEY: 'fresh-key',
      },
    })

    expect(gcRun.status, gcRun.stdout + '\n' + gcRun.stderr).toBe(0)
    expect(existsSync(entryRoot)).toBe(true)
    expect(await pausedResult, pausedStdout + '\n' + pausedStderr).toBe(0)
    expect(existsSync(cursorRefPath)).toBe(true)
    expect(existsSync(codexRefPath)).toBe(true)
  })

  it('restores the previous install when TERM arrives after the backup move', () => {
    const run = runGeneratedInstaller('cursor', {
      existingUserConfig: { values: { marker: 'previous-install' } },
      env: { SENDLENS_INSTANTLY_API_KEY: 'fresh-key' },
      prepareRuntime: (rootDir) => {
        const fakeBin = resolve(rootDir, 'interrupt-bin')
        mkdirSync(fakeBin, { recursive: true })
        const fakeMv = resolve(fakeBin, 'mv')
        writeFileSync(fakeMv, `#!/usr/bin/env bash
set -euo pipefail
/bin/mv "$@"
destination="\${@: -1}"
case "$destination" in
  *.pluxx-backup-*) kill -TERM "$PPID" ;;
esac
`)
        chmodSync(fakeMv, 0o755)
        return { PATH: `${fakeBin}:${process.env.PATH}` }
      },
    })

    expect(run.status).toBe(143)
    expect(run.installedUserConfig?.values?.marker).toBe('previous-install')
    expect(existsSync(resolve(run.rootDir, 'home/.pluxx/install-locks/publish-plugin-cursor.lock'))).toBe(false)
  })

  it('refuses a concurrent installer without changing the live bundle', () => {
    const run = runGeneratedInstaller('cursor', {
      existingUserConfig: { values: { marker: 'previous-install' } },
      setupPaths: (_paths, rootDir) => mkdirSync(resolve(rootDir, 'home/.pluxx/install-locks/publish-plugin-cursor.lock'), { recursive: true }),
    })

    expect(run.status).toBe(1)
    expect(run.stderr).toContain('Another install transaction is active')
    expect(run.installedUserConfig?.values?.marker).toBe('previous-install')
    expect(existsSync(resolve(run.rootDir, 'home/.pluxx/install-locks/publish-plugin-cursor.lock'))).toBe(true)
  })

  it('restores bundle and owned Codex metadata after a post-swap registration failure', () => {
    const originalMarketplace = '{"name":"original-marketplace","plugins":[]}\n'
    const run = runGeneratedInstaller('codex', {
      existingUserConfig: { values: { marker: 'previous-install' } },
      extraFiles: {
        '.codex/agents/reviewer.toml': 'name = "reviewer"\ndescription = "Review."\ndeveloper_instructions = "Review."\n',
      },
      env: { SENDLENS_INSTANTLY_API_KEY: 'fresh-key' },
      prepareRuntime: (rootDir) => {
        const globalAgent = resolve(rootDir, 'home/.codex/agents/unowned-reviewer.toml')
        mkdirSync(resolve(globalAgent, '..'), { recursive: true })
        writeFileSync(globalAgent, 'name = "reviewer"\ndescription = "Existing."\ndeveloper_instructions = "Existing."\n')
        writeFileSync(resolve(rootDir, 'codex-marketplace.json'), originalMarketplace)
      },
    })

    expect(run.status).toBe(1)
    expect(run.stderr).toContain('Codex agent name collision')
    expect(run.installedUserConfig?.values?.marker).toBe('previous-install')
    expect(readFileSync(resolve(run.rootDir, 'codex-marketplace.json'), 'utf-8')).toBe(originalMarketplace)
  })

  it('rolls back Codex agent metadata changed before a later marketplace failure', () => {
    const invalidMarketplace = '{not-json\n'
    const run = runGeneratedInstaller('codex', {
      existingUserConfig: { values: { marker: 'previous-install' } },
      extraFiles: {
        '.codex/agents/reviewer.toml': 'name = "reviewer"\ndescription = "Review."\ndeveloper_instructions = "Review."\n',
      },
      prepareRuntime: (rootDir) => {
        writeFileSync(resolve(rootDir, 'codex-marketplace.json'), invalidMarketplace)
      },
    })

    expect(run.status).toBe(1)
    expect(run.installedUserConfig?.values?.marker).toBe('previous-install')
    expect(existsSync(resolve(run.rootDir, 'home/.codex/agents/publish-plugin/reviewer.toml'))).toBe(false)
    expect(existsSync(resolve(run.rootDir, 'home/.codex/pluxx/agent-installs/publish-plugin.json'))).toBe(false)
    expect(readFileSync(resolve(run.rootDir, 'codex-marketplace.json'), 'utf-8')).toBe(invalidMarketplace)
  })

  it('rejects link members in a checksum-valid release archive', () => {
    const run = runGeneratedInstaller('cursor', {
      existingUserConfig: { values: { marker: 'previous-install' } },
      mutateArchive: (archivePath, releaseDir) => {
        const unsafeRoot = resolve(releaseDir, 'unsafe-archive')
        const bundleRoot = resolve(unsafeRoot, 'cursor')
        mkdirSync(bundleRoot, { recursive: true })
        symlinkSync('../../outside', resolve(bundleRoot, 'escape-link'))
        const tar = spawnSync('tar', ['-czf', archivePath, '-C', unsafeRoot, 'cursor'], { encoding: 'utf-8' })
        expect(tar.status).toBe(0)

        const sumsPath = resolve(releaseDir, 'SHA256SUMS.txt')
        const archiveName = archivePath.split('/').pop()!
        const digest = createHash('sha256').update(readFileSync(archivePath)).digest('hex')
        const sums = readFileSync(sumsPath, 'utf-8')
          .split('\n')
          .map((line) => line.endsWith(`  ${archiveName}`) ? `${digest}  ${archiveName}` : line)
          .join('\n')
        writeFileSync(sumsPath, sums)
      },
    })

    expect(run.status).toBe(1)
    expect(run.stderr).toContain('Unsafe archive member type rejected')
    expect(run.installedUserConfig?.values?.marker).toBe('previous-install')
  })

  it('rejects checksum-valid traversal, absolute, and hard-link archive members', () => {
    for (const kind of ['traversal', 'absolute', 'hardlink']) {
      const run = runGeneratedInstaller('cursor', {
        existingUserConfig: { values: { marker: 'previous-install' } },
        mutateArchive: (archivePath, releaseDir) => {
          const python = spawnSync('python3', ['-c', `
import io, sys, tarfile
archive, kind = sys.argv[1], sys.argv[2]
with tarfile.open(archive, 'w:gz') as tf:
    info = tarfile.TarInfo('../escape.txt' if kind == 'traversal' else '/tmp/pluxx-escape' if kind == 'absolute' else 'cursor/escape-hardlink')
    if kind == 'hardlink':
        info.type = tarfile.LNKTYPE
        info.linkname = '../../outside'
        tf.addfile(info)
    else:
        payload = b'escape'
        info.size = len(payload)
        tf.addfile(info, io.BytesIO(payload))
`, archivePath, kind], { encoding: 'utf-8' })
          expect(python.status).toBe(0)

          const sumsPath = resolve(releaseDir, 'SHA256SUMS.txt')
          const archiveName = archivePath.split('/').pop()!
          const digest = createHash('sha256').update(readFileSync(archivePath)).digest('hex')
          const sums = readFileSync(sumsPath, 'utf-8')
            .split('\n')
            .map((line) => line.endsWith(`  ${archiveName}`) ? `${digest}  ${archiveName}` : line)
            .join('\n')
          writeFileSync(sumsPath, sums)
        },
      })

      expect(run.status).toBe(1)
      expect(run.stderr).toMatch(/Unsafe archive (path|member type) rejected/)
      expect(run.installedUserConfig?.values?.marker).toBe('previous-install')
    }
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
      runCommand: withGithubReleaseVerification((command, args, options) => {
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
      }),
    })

    expect(result.ok).toBe(true)
    expect(installerContent).toContain('pluxx_prompt_secret_config "test-api-key" "TEST_API_KEY"')
    expect(installerContent).toContain('Refusing placeholder-looking secret for $env_var')
    expect(installerContent).toContain("path.join(installDir, '.pluxx-user.json')")
    expect(installerContent).toContain('server.http_headers')
    expect(installerContent).toContain('preserveSecretReferences = true')
    expect(installerContent).toContain('Preparing local plugin runtime dependencies...')
    expect(installerContent).toContain("childProcess.spawnSync('bash'")
    expect(installerContent).toContain('path.join(candidateRoot, bootstrapRelativePath)')
    expect(installerContent).toContain('fingerprintHasLiveLease(entry.name) || fingerprintHasLiveRef(refRoot, entry.name)')
    expect(installerContent).toContain('PLUXX_CODEX_ENABLE_PLUGIN_HOOKS')
    expect(installerContent).toContain('Codex requires [features].hooks = true')
    expect(installerContent).toContain('hooks = true')
    expect(installerContent).toContain('materializeInstalledStdioPath')
    expect(installerContent).toContain("trap 'exit 129' HUP")
    expect(installerContent).toContain("trap 'exit 130' INT")
    expect(installerContent).toContain("trap 'exit 143' TERM")
    expect(installerContent).toContain("trap '' HUP INT TERM")
    expect(installerContent).toContain('$HOME/.pluxx/install-locks')
    expect(installerContent).toContain('releases/download/v1.2.3')
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


  it('adopts trusted pre-ownership generated installs across core hosts', () => {
    const platforms: TargetPlatform[] = ['claude-code', 'cursor', 'codex', 'opencode']

    for (const platform of platforms) {
      const run = runGeneratedInstaller(platform, {
        config: { ...makeUserConfigInstallerConfig(platform), targets: [platform] },
        existingUserConfig: {
          values: { 'instantly-api-key': 'saved-instantly-key' },
          env: { SENDLENS_INSTANTLY_API_KEY: 'saved-instantly-key' },
        },
        extraFiles: platform === 'opencode'
          ? { 'skills/client-intel/SKILL.md': '# Client Intel\n' }
          : {},
        setupPaths: (paths) => {
          writeLegacyInstalledManifest(platform, paths.pluginInstallDir, matchingLegacyManifestForPlatform(platform))
          writeFileSync(resolve(paths.pluginInstallDir, 'legacy-pre-ownership.txt'), 'legacy bundle marker\n')

          if (platform === 'opencode') {
            const entryPath = paths.env.PLUXX_OPENCODE_ENTRY_PATH
            mkdirSync(resolve(entryPath, '..'), { recursive: true })
            writeFileSync(entryPath, legacyOpenCodeWrapper())

            const skillDir = resolve(paths.env.PLUXX_OPENCODE_SKILLS_ROOT, 'publish-plugin-client-intel')
            mkdirSync(skillDir, { recursive: true })
            writeFileSync(resolve(skillDir, 'SKILL.md'), '---\nname: publish-plugin/client-intel\n---\n\n# Client Intel\n')
          }
        },
      })

      expect(run.status, `${platform} installer failed:\n${run.stderr}\n${run.stdout}`).toBe(0)
      expect(run.stderr).toBe('')
      expect(existsSync(resolve(run.pluginInstallDir, 'legacy-pre-ownership.txt'))).toBe(false)
      expect(existsSync(generatedInstallerOwnershipPath(platform, run.rootDir, run.pluginInstallDir))).toBe(true)
      expect(run.stdout).toContain('Found existing publish-plugin config; reusing saved install values.')

      if (platform === 'codex') {
        expect(run.installedUserConfig?.envRefs?.SENDLENS_INSTANTLY_API_KEY).toBe('SENDLENS_INSTANTLY_API_KEY')
      } else {
        expect(run.installedUserConfig?.values?.['instantly-api-key']).toBe('saved-instantly-key')
        expect(run.installedUserConfig?.env?.SENDLENS_INSTANTLY_API_KEY).toBe('saved-instantly-key')
      }

      if (platform === 'opencode') {
        expect(readFileSync(resolve(run.rootDir, 'publish-plugin.ts'), 'utf-8')).toContain('OpenCode auto-loads plugin files')
        expect(readFileSync(resolve(run.rootDir, 'publish-plugin.ts'), 'utf-8')).toContain('pluginFactory(context)')
        expect(readFileSync(resolve(run.rootDir, 'publish-plugin.ts'), 'utf-8')).not.toContain('directory: join(context.directory, "publish-plugin")')
        expect(readFileSync(resolve(run.rootDir, 'opencode-skills/publish-plugin-client-intel/SKILL.md'), 'utf-8')).toContain('name: publish-plugin/client-intel')
      }
    }
  })

  it('adopts trusted pre-ownership OpenCode wrappers generated with the current workspace passthrough shape', () => {
    const run = runGeneratedInstaller('opencode', {
      config: { ...makeUserConfigInstallerConfig('opencode'), targets: ['opencode'] },
      existingUserConfig: {
        values: { 'instantly-api-key': 'saved-instantly-key' },
        env: { SENDLENS_INSTANTLY_API_KEY: 'saved-instantly-key' },
      },
      extraFiles: { 'skills/client-intel/SKILL.md': '# Client Intel\n' },
      setupPaths: (paths) => {
        writeLegacyInstalledManifest('opencode', paths.pluginInstallDir, matchingLegacyManifestForPlatform('opencode'))
        const entryPath = paths.env.PLUXX_OPENCODE_ENTRY_PATH
        mkdirSync(resolve(entryPath, '..'), { recursive: true })
        writeFileSync(entryPath, currentOpenCodeWrapper())

        const skillDir = resolve(paths.env.PLUXX_OPENCODE_SKILLS_ROOT, 'publish-plugin-client-intel')
        mkdirSync(skillDir, { recursive: true })
        writeFileSync(resolve(skillDir, 'SKILL.md'), '---\nname: publish-plugin/client-intel\n---\n\n# Client Intel\n')
      },
    })

    expect(run.status, `installer failed:\n${run.stderr}\n${run.stdout}`).toBe(0)
    expect(readFileSync(resolve(run.rootDir, 'publish-plugin.ts'), 'utf-8')).toContain('pluginFactory(context)')
    expect(existsSync(generatedInstallerOwnershipPath('opencode', run.rootDir, run.pluginInstallDir))).toBe(true)
  })

  it('passes the selected workspace unchanged through a generated release OpenCode wrapper', async () => {
    const config = { ...makeConfig(), targets: ['opencode'] as TargetPlatform[] }
    let installedBundle = ''
    let installedEntry = ''
    const run = runGeneratedInstaller('opencode', {
      config,
      prepareRuntime: (rootDir) => {
        installedBundle = resolve(rootDir, 'home/.config/opencode/plugins/publish-plugin')
        installedEntry = `${installedBundle}.ts`
        return {
          PLUXX_OPENCODE_INSTALL_DIR: installedBundle,
          PLUXX_OPENCODE_ENTRY_PATH: installedEntry,
          PLUXX_OPENCODE_SKILLS_ROOT: resolve(rootDir, 'home/.config/opencode/skills'),
        }
      },
      extraFiles: {
        'package.json': JSON.stringify({
          name: '@orchid/publish-plugin-opencode',
          version: '1.2.3',
          type: 'module',
          peerDependencies: { '@opencode-ai/plugin': '^1.0.0' },
          keywords: ['opencode-plugin'],
        }),
        'index.ts': [
          'import { existsSync } from "fs"',
          'import { join } from "path"',
          '',
          'export const PublishPlugin = async (context: { directory: string, config?: { command?: string } }) => ({',
          '  workspaceRoot: context.directory,',
          '  nestedWorkspaceExists: existsSync(join(context.directory, "publish-plugin")),',
          '  command: context.config?.command,',
          '})',
          '',
        ].join('\n'),
      },
    })
    const workspaceRoot = resolve(run.rootDir, 'selected workspace')
    mkdirSync(workspaceRoot, { recursive: true })

    expect(readFileSync(installedEntry, 'utf-8')).toBe(buildOpenCodeEntryFile('publish-plugin'))

    const doctorReport = await doctorConsumer(installedBundle, { projectRoot: run.rootDir })
    expect(doctorReport.checks).toContainEqual(expect.objectContaining({
      level: 'success',
      code: 'consumer-opencode-entry-valid',
    }))

    const entryModule = await import(pathToFileURL(installedEntry).href)
    const result = await entryModule.PublishPlugin({
      directory: workspaceRoot,
      config: { command: 'pluxx-release-wrapper-proof' },
    })

    expect(result).toEqual({
      workspaceRoot,
      nestedWorkspaceExists: false,
      command: 'pluxx-release-wrapper-proof',
    })
  })

  it('rejects unowned OpenCode wrappers that only contain generated-wrapper marker strings', () => {
    const run = runGeneratedInstaller('opencode', {
      config: { ...makeUserConfigInstallerConfig('opencode'), targets: ['opencode'] },
      existingUserConfig: {
        values: { 'instantly-api-key': 'saved-instantly-key' },
        env: { SENDLENS_INSTANTLY_API_KEY: 'saved-instantly-key' },
      },
      setupPaths: (paths) => {
        writeLegacyInstalledManifest('opencode', paths.pluginInstallDir, matchingLegacyManifestForPlatform('opencode'))
        const entryPath = paths.env.PLUXX_OPENCODE_ENTRY_PATH
        mkdirSync(resolve(entryPath, '..'), { recursive: true })
        writeFileSync(
          entryPath,
          [
            'import type { Plugin } from "@opencode-ai/plugin"',
            'import { join } from "path"',
            '',
            'import * as PluginModule from "./publish-plugin/index.ts"',
            '',
            '// Object.values(PluginModule).find',
            '// pluginFactory(context)',
            '// directory: join(context.directory, "publish-plugin")',
            'export const PublishPlugin: Plugin = async (context) => ({',
            '  ...context,',
            '  directory: join(context.directory, "custom-location"),',
            '})',
            '',
          ].join('\n'),
        )
      },
    })

    expect(run.status).toBe(1)
    expect(run.stderr).toContain('Refusing to replace unowned OpenCode companion')
  })

  it('rejects unowned legacy installs with missing, malformed, or mismatched manifests', () => {
    const cases: Array<{ name: string; writeManifest?: (installDir: string) => void }> = [
      { name: 'missing manifest' },
      {
        name: 'malformed manifest',
        writeManifest: (installDir) => writeLegacyInstalledManifest('cursor', installDir, '{not-json\n'),
      },
      {
        name: 'mismatched manifest',
        writeManifest: (installDir) => writeLegacyInstalledManifest('cursor', installDir, { name: 'other-plugin', version: '9.9.9' }),
      },
    ]

    for (const testCase of cases) {
      const run = runGeneratedInstaller('cursor', {
        existingUserConfig: { values: { marker: testCase.name } },
        setupPaths: (paths) => {
          writeFileSync(resolve(paths.pluginInstallDir, 'untrusted.txt'), 'do not replace\n')
          testCase.writeManifest?.(paths.pluginInstallDir)
        },
      })

      expect(run.status, testCase.name).toBe(1)
      expect(run.stderr, testCase.name).toContain('Refusing to replace unowned install')
      expect(readFileSync(resolve(run.pluginInstallDir, 'untrusted.txt'), 'utf-8')).toBe('do not replace\n')
      expect(run.installedUserConfig?.values?.marker).toBe(testCase.name)
    }
  })

  it('rejects mismatched pre-ownership generated install identity across core hosts', () => {
    const platforms: TargetPlatform[] = ['claude-code', 'cursor', 'codex', 'opencode']

    for (const platform of platforms) {
      const run = runGeneratedInstaller(platform, {
        existingUserConfig: { values: { marker: 'legacy' } },
        setupPaths: (paths) => {
          const manifest = platform === 'opencode'
            ? { name: '@orchid/other-plugin-opencode', version: '1.2.2' }
            : { name: 'other-plugin', version: '1.2.2' }
          writeLegacyInstalledManifest(platform, paths.pluginInstallDir, manifest)
          writeFileSync(resolve(paths.pluginInstallDir, 'legacy-pre-ownership.txt'), 'do not replace\n')
        },
      })

      expect(run.status, `${platform} should fail closed`).toBe(1)
      expect(run.stderr).toContain('Refusing to replace unowned install')
      expect(readFileSync(resolve(run.pluginInstallDir, 'legacy-pre-ownership.txt'), 'utf-8')).toBe('do not replace\n')
    }
  })

  it('rejects unrecognized legacy OpenCode skill companion collisions', () => {
    const cases = [
      { name: 'no legacy frontmatter', content: '# Private unrelated skill\n' },
      { name: 'wrong legacy namespace identity', content: '---\nname: publish-plugin/other-skill\n---\n\n# Private unrelated skill\n' },
    ]

    for (const testCase of cases) {
      const run = runGeneratedInstaller('opencode', {
        config: { ...makeConfig(), targets: ['opencode'] },
        existingUserConfig: { values: { marker: testCase.name } },
        extraFiles: { 'skills/client-intel/SKILL.md': '# Client Intel\n' },
        setupPaths: (paths) => {
          writeLegacyInstalledManifest('opencode', paths.pluginInstallDir, matchingLegacyManifestForPlatform('opencode'))
          const skillDir = resolve(paths.env.PLUXX_OPENCODE_SKILLS_ROOT, 'publish-plugin-client-intel')
          mkdirSync(skillDir, { recursive: true })
          writeFileSync(resolve(skillDir, 'SKILL.md'), testCase.content)
        },
      })

      expect(run.status, testCase.name).toBe(1)
      expect(run.stderr, testCase.name).toContain('Refusing to replace unowned OpenCode companion')
      expect(readFileSync(resolve(run.rootDir, 'opencode-skills/publish-plugin-client-intel/SKILL.md'), 'utf-8')).toBe(testCase.content)
      expect(run.installedUserConfig?.values?.marker).toBe(testCase.name)
    }
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

      expect(run.status, `${platform} installer failed:\n${run.stderr}\n${run.stdout}`).toBe(0)
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

  it('does not pass ambient runner config into generated installer fixtures', () => {
    expect(isolatedInstallerEnvironment({
      PATH: '/fixture/bin',
      SENDLENS_INSTANTLY_API_KEY: 'ambient-runner-key',
      WORKSPACE_MARKER: 'ambient-workspace',
    })).toEqual({ PATH: '/fixture/bin' })
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

      expect(run.status, `${platform} installer failed:\n${run.stderr}\n${run.stdout}`).toBe(0)
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

      expect(run.status, `${platform} installer failed:\n${run.stderr}\n${run.stdout}`).toBe(0)
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
        version: '1.2.3',
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
