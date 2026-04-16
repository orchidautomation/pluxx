import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs'
import { mkdtempSync } from 'fs'
import { resolve } from 'path'
import { spawnSync } from 'child_process'
import { tmpdir } from 'os'
import type { PluginConfig, TargetPlatform } from '../schema'

type PublishChannel = 'npm' | 'github-release'

interface CommandResult {
  status: number | null
  stdout: string
  stderr: string
}

type CommandRunner = (
  command: string,
  args: string[],
  options?: { cwd?: string },
) => CommandResult

export interface PublishPlanOptions {
  requestedChannels?: PublishChannel[]
  version?: string
  tag?: string
  dryRun?: boolean
  rootDir?: string
  runCommand?: CommandRunner
}

export interface PublishAssetPlan {
  platform: TargetPlatform
  name: string
  path: string
}

export interface PublishCheck {
  name: string
  ok: boolean
  code: string
  detail?: string
}

export interface PublishPlan {
  command: 'publish'
  dryRun: boolean
  version: string
  tag: string
  channels: {
    npm: {
      enabled: boolean
      explicit: boolean
      packageName?: string
      packageDir?: string
      wouldPublish: boolean
    }
    githubRelease: {
      enabled: boolean
      explicit: boolean
      releaseTag?: string
      wouldCreateRelease: boolean
      assets: PublishAssetPlan[]
    }
  }
  checks: PublishCheck[]
}

export interface PublishRunResult extends PublishPlan {
  ok: boolean
  execution?: {
    npm?: { ok: boolean; detail?: string }
    githubRelease?: { ok: boolean; detail?: string }
  }
}

function runCommandDefault(command: string, args: string[], options?: { cwd?: string }): CommandResult {
  const result = spawnSync(command, args, {
    cwd: options?.cwd,
    encoding: 'utf-8',
  })

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

function isTargetNpmBacked(platform: TargetPlatform): boolean {
  return platform === 'opencode'
}

function resolveRequestedChannels(options: PublishPlanOptions): {
  requested: Set<PublishChannel>
  explicit: { npm: boolean; githubRelease: boolean }
} {
  const requested = new Set<PublishChannel>(options.requestedChannels ?? [])
  return {
    requested,
    explicit: {
      npm: requested.has('npm'),
      githubRelease: requested.has('github-release'),
    },
  }
}

function getBuiltTargets(rootDir: string, config: PluginConfig): TargetPlatform[] {
  return config.targets.filter((platform) =>
    existsSync(resolve(rootDir, config.outDir, platform)),
  )
}

function buildReleaseAssets(rootDir: string, config: PluginConfig, version: string, targets: TargetPlatform[]): PublishAssetPlan[] {
  return targets.map((platform) => ({
    platform,
    name: `${platform}-v${version}.tgz`,
    path: resolve(rootDir, config.outDir, platform),
  }))
}

function readNpmPackageName(rootDir: string, config: PluginConfig): { packageName?: string; packageDir?: string } {
  const packageDir = resolve(rootDir, config.outDir, 'opencode')
  const packageJsonPath = resolve(packageDir, 'package.json')
  if (!existsSync(packageJsonPath)) {
    return {}
  }

  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { name?: string }
    return {
      packageName: pkg.name,
      packageDir,
    }
  } catch {
    return {
      packageDir,
    }
  }
}

function collectChecks(args: {
  rootDir: string
  config: PluginConfig
  npmEnabled: boolean
  githubReleaseEnabled: boolean
  packageDir?: string
  packageName?: string
  runCommand: CommandRunner
}): PublishCheck[] {
  const builtTargets = getBuiltTargets(args.rootDir, args.config)
  const checks: PublishCheck[] = [
    {
      name: 'artifacts-exist',
      ok: builtTargets.length > 0,
      code: 'artifacts-exist',
      detail: builtTargets.length > 0
        ? `Built targets: ${builtTargets.join(', ')}`
        : `No built platform outputs found in ${args.config.outDir}/`,
    },
  ]

  const gitStatus = args.runCommand('git', ['status', '--porcelain'], { cwd: args.rootDir })
  checks.push({
    name: 'git-clean',
    ok: gitStatus.status === 0 && gitStatus.stdout.trim() === '',
    code: 'git-clean',
    detail: gitStatus.status !== 0
      ? (gitStatus.stderr || gitStatus.stdout || 'Unable to read git status')
      : gitStatus.stdout.trim() === ''
        ? 'Working tree is clean.'
        : 'Working tree has uncommitted changes.',
  })

  if (args.npmEnabled) {
    checks.push({
      name: 'npm-package-ready',
      ok: Boolean(args.packageDir && existsSync(resolve(args.packageDir, 'package.json')) && args.packageName),
      code: 'npm-package-ready',
      detail: args.packageDir
        ? `OpenCode package dir: ${args.packageDir}`
        : 'No npm-backed target package found.',
    })

    const npmAuth = args.runCommand('npm', ['whoami'], { cwd: args.rootDir })
    checks.push({
      name: 'npm-auth',
      ok: npmAuth.status === 0,
      code: 'npm-auth',
      detail: npmAuth.status === 0
        ? (npmAuth.stdout.trim() || 'npm auth OK')
        : (npmAuth.stderr || npmAuth.stdout || 'npm auth unavailable'),
    })
  }

  if (args.githubReleaseEnabled) {
    const ghAuth = args.runCommand('gh', ['auth', 'status'], { cwd: args.rootDir })
    checks.push({
      name: 'github-release-auth',
      ok: ghAuth.status === 0,
      code: 'github-release-auth',
      detail: ghAuth.status === 0
        ? 'gh auth OK'
        : (ghAuth.stderr || ghAuth.stdout || 'gh auth unavailable'),
    })
  }

  return checks
}

export function planPublish(config: PluginConfig, options: PublishPlanOptions = {}): PublishPlan {
  const rootDir = options.rootDir ?? process.cwd()
  const runCommand = options.runCommand ?? runCommandDefault
  const builtTargets = getBuiltTargets(rootDir, config)
  const { requested, explicit } = resolveRequestedChannels(options)
  const defaultNpm = builtTargets.some(isTargetNpmBacked)
  const defaultGithubRelease = builtTargets.length > 0
  const npmEnabled = explicit.npm ? true : (requested.size === 0 ? defaultNpm : false)
  const githubReleaseEnabled = explicit.githubRelease ? true : (requested.size === 0 ? defaultGithubRelease : false)
  const version = options.version ?? config.version
  const tag = options.tag ?? 'latest'
  const { packageDir, packageName } = readNpmPackageName(rootDir, config)
  const checks = collectChecks({
    rootDir,
    config,
    npmEnabled,
    githubReleaseEnabled,
    packageDir,
    packageName,
    runCommand,
  })

  return {
    command: 'publish',
    dryRun: options.dryRun ?? false,
    version,
    tag,
    channels: {
      npm: {
        enabled: npmEnabled,
        explicit: explicit.npm,
        packageName,
        packageDir,
        wouldPublish: npmEnabled,
      },
      githubRelease: {
        enabled: githubReleaseEnabled,
        explicit: explicit.githubRelease,
        releaseTag: githubReleaseEnabled ? `v${version}` : undefined,
        wouldCreateRelease: githubReleaseEnabled,
        assets: githubReleaseEnabled ? buildReleaseAssets(rootDir, config, version, builtTargets) : [],
      },
    },
    checks,
  }
}

function createReleaseArchives(
  rootDir: string,
  config: PluginConfig,
  assets: PublishAssetPlan[],
  runCommand: CommandRunner,
): { tempRoot: string; archives: string[] } {
  const tempRoot = mkdtempSync(resolve(tmpdir(), 'pluxx-publish-'))
  const created: string[] = []

  try {
    for (const asset of assets) {
      const archivePath = resolve(tempRoot, asset.name)
      const result = runCommand(
        'tar',
        ['-czf', archivePath, '-C', resolve(rootDir, config.outDir), asset.platform],
        { cwd: rootDir },
      )
      if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || `Failed to create archive for ${asset.platform}`)
      }
      created.push(archivePath)
    }
    return { tempRoot, archives: created }
  } catch (error) {
    rmSync(tempRoot, { recursive: true, force: true })
    throw error
  }
}

export function formatPublishPlan(plan: PublishPlan): string[] {
  const lines: string[] = [
    `Resolved version: ${plan.version}`,
    `Resolved tag: ${plan.tag}`,
    `Channels: ${[
      plan.channels.npm.enabled ? `npm${plan.channels.npm.explicit ? ' (explicit)' : ' (auto)'}` : null,
      plan.channels.githubRelease.enabled ? `github-release${plan.channels.githubRelease.explicit ? ' (explicit)' : ' (auto)'}` : null,
    ].filter(Boolean).join(', ') || 'none'}`,
    '',
    'Checks:',
  ]

  for (const check of plan.checks) {
    lines.push(`  - ${check.name}: ${check.ok ? 'ok' : 'fail'}${check.detail ? ` — ${check.detail}` : ''}`)
  }

  lines.push('')
  if (plan.channels.npm.enabled) {
    lines.push(`npm package: ${plan.channels.npm.packageName ?? 'unknown'} (${plan.channels.npm.packageDir ?? 'missing'})`)
  }

  if (plan.channels.githubRelease.enabled) {
    lines.push(`GitHub release tag: ${plan.channels.githubRelease.releaseTag}`)
    lines.push('Assets:')
    for (const asset of plan.channels.githubRelease.assets) {
      lines.push(`  - ${asset.name} <- ${asset.path}`)
    }
  }

  if (plan.dryRun) {
    lines.push('')
    lines.push('No remote changes were made.')
  }

  return lines
}

export function runPublish(config: PluginConfig, options: PublishPlanOptions = {}): PublishRunResult {
  const rootDir = options.rootDir ?? process.cwd()
  const runCommand = options.runCommand ?? runCommandDefault
  const plan = planPublish(config, options)

  const failedChecks = plan.checks.filter((check) => !check.ok)
  if (failedChecks.length > 0) {
    return {
      ...plan,
      ok: false,
    }
  }

  if (options.dryRun) {
    return {
      ...plan,
      ok: true,
    }
  }

  const execution: NonNullable<PublishRunResult['execution']> = {}

  if (plan.channels.npm.enabled) {
    const npmChannel = plan.channels.npm
    const result = runCommand(
      'npm',
      ['publish', '--tag', plan.tag, '--access', 'public'],
      { cwd: npmChannel.packageDir },
    )
    execution.npm = {
      ok: result.status === 0,
      detail: result.status === 0
        ? (result.stdout.trim() || 'npm publish complete')
        : (result.stderr || result.stdout || 'npm publish failed'),
    }
  }

  if (plan.channels.githubRelease.enabled) {
    const releaseTag = plan.channels.githubRelease.releaseTag!
    const { tempRoot, archives } = createReleaseArchives(rootDir, config, plan.channels.githubRelease.assets, runCommand)

    try {
      const existing = runCommand('gh', ['release', 'view', releaseTag], { cwd: rootDir })

      const result = existing.status === 0
        ? runCommand('gh', ['release', 'upload', releaseTag, '--clobber', ...archives], { cwd: rootDir })
        : runCommand(
          'gh',
          [
            'release',
            'create',
            releaseTag,
            ...archives,
            '--title',
            `${config.name} ${plan.version}`,
            '--notes',
            `Release generated by pluxx publish for ${config.name}@${plan.version}.`,
          ],
          { cwd: rootDir },
        )

      execution.githubRelease = {
        ok: result.status === 0,
        detail: result.status === 0
          ? (result.stdout.trim() || `GitHub release ${releaseTag} updated`)
          : (result.stderr || result.stdout || 'GitHub release publish failed'),
      }
    } finally {
      rmSync(tempRoot, { recursive: true, force: true })
    }
  }

  const ok = Object.values(execution).every((channel) => channel.ok)
  return {
    ...plan,
    ok,
    execution,
  }
}
