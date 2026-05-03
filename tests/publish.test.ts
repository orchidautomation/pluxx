import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { resolve } from 'path'
import { tmpdir } from 'os'
import type { PluginConfig } from '../src/schema'
import { planPublish, runPublish } from '../src/cli/publish'

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

function captureInstallerScript(config: PluginConfig): string {
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
  return installerContent
}

function createBundleArchive(platform: string, extraFiles: Record<string, string>): string {
  const bundleRoot = mkdtempSync(resolve(tmpdir(), 'pluxx-publish-bundle-'))
  const archiveRoot = mkdtempSync(resolve(tmpdir(), 'pluxx-publish-archive-'))
  const bundleDir = resolve(bundleRoot, platform)
  mkdirSync(bundleDir, { recursive: true })

  for (const [relativePath, content] of Object.entries(extraFiles)) {
    const fullPath = resolve(bundleDir, relativePath)
    mkdirSync(resolve(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, content)
  }

  const archivePath = resolve(archiveRoot, `${platform}.tar.gz`)
  const proc = spawnSync('tar', ['-czf', archivePath, '-C', bundleRoot, platform], { encoding: 'utf-8' })
  expect(proc.status).toBe(0)
  return archivePath
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
      'install-all.sh',
      'release-manifest.json',
      'SHA256SUMS.txt',
    ]))
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
      '.codex-plugin/plugin.json': JSON.stringify({ name: 'publish-plugin', version: '1.2.3' }),
      '.mcp.json': JSON.stringify({ mcpServers: { fixture: { url: 'https://example.com/mcp', bearer_token_env_var: 'TEST_API_KEY' } } }),
    })

    const installerContent = captureInstallerScript(config)
    expect(installerContent).toContain('pluxx_prompt_secret_config "TEST_API_KEY"')
    expect(installerContent).toContain('Refusing placeholder-looking secret for $env_var')
    expect(installerContent).toContain("path.join(installDir, '.pluxx-user.json')")
    expect(installerContent).toContain('server.http_headers')
    expect(installerContent).toContain('delete server.bearer_token_env_var')
  })

  it('runs runtime bootstrap before Codex installer success when the bundle includes it', () => {
    const config: PluginConfig = {
      name: 'publish-plugin',
      version: '1.2.3',
      description: 'A publish test plugin',
      author: { name: 'Test Author' },
      license: 'MIT',
      repository: 'https://github.com/orchidautomation/publish-plugin',
      skills: './skills/',
      targets: ['codex'],
      outDir: './dist',
    }
    prepareBuiltTarget('codex', {
      '.codex-plugin/plugin.json': JSON.stringify({ name: 'publish-plugin', version: '1.2.3' }),
    })

    const installerPath = resolve(ROOT, 'install-codex.sh')
    writeFileSync(installerPath, captureInstallerScript(config))

    const bundlePath = createBundleArchive('codex', {
      '.codex-plugin/plugin.json': JSON.stringify({ name: 'publish-plugin', version: '1.2.3' }),
      'scripts/bootstrap-runtime.sh': '#!/usr/bin/env bash\nset -euo pipefail\nmkdir -p "$PWD/node_modules"\nprintf "ready\\n" > "$PWD/node_modules/bootstrap.txt"\n',
    })
    const installDir = resolve(ROOT, 'installed-codex-plugin')
    const marketplacePath = resolve(ROOT, 'marketplace.json')

    const proc = spawnSync('bash', [installerPath], {
      cwd: ROOT,
      encoding: 'utf-8',
      env: {
        ...process.env,
        PLUXX_CODEX_BUNDLE_PATH: bundlePath,
        PLUXX_CODEX_INSTALL_DIR: installDir,
        PLUXX_CODEX_MARKETPLACE_PATH: marketplacePath,
      },
    })

    expect(proc.status).toBe(0)
    expect(proc.stdout).toContain('Preparing local runtime dependencies for publish-plugin. This may take a moment...')
    expect(readFileSync(resolve(installDir, 'node_modules/bootstrap.txt'), 'utf-8')).toBe('ready\n')
  })

  it('fails the Codex installer when runtime bootstrap fails', () => {
    const config: PluginConfig = {
      name: 'publish-plugin',
      version: '1.2.3',
      description: 'A publish test plugin',
      author: { name: 'Test Author' },
      license: 'MIT',
      repository: 'https://github.com/orchidautomation/publish-plugin',
      skills: './skills/',
      targets: ['codex'],
      outDir: './dist',
    }
    prepareBuiltTarget('codex', {
      '.codex-plugin/plugin.json': JSON.stringify({ name: 'publish-plugin', version: '1.2.3' }),
    })

    const installerPath = resolve(ROOT, 'install-codex.sh')
    writeFileSync(installerPath, captureInstallerScript(config))

    const bundlePath = createBundleArchive('codex', {
      '.codex-plugin/plugin.json': JSON.stringify({ name: 'publish-plugin', version: '1.2.3' }),
      'scripts/bootstrap-runtime.sh': '#!/usr/bin/env bash\nset -euo pipefail\necho "bootstrap failed" >&2\nexit 23\n',
    })
    const installDir = resolve(ROOT, 'installed-codex-plugin')
    const marketplacePath = resolve(ROOT, 'marketplace.json')

    const proc = spawnSync('bash', [installerPath], {
      cwd: ROOT,
      encoding: 'utf-8',
      env: {
        ...process.env,
        PLUXX_CODEX_BUNDLE_PATH: bundlePath,
        PLUXX_CODEX_INSTALL_DIR: installDir,
        PLUXX_CODEX_MARKETPLACE_PATH: marketplacePath,
      },
    })

    expect(proc.status).toBe(23)
    expect(proc.stderr).toContain('bootstrap failed')
    expect(proc.stdout).not.toContain('Installed publish-plugin to')
  })
})
