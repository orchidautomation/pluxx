import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync, statSync } from 'fs'
import { resolve } from 'path'
import type { PluginConfig, TargetPlatform } from '../schema'
import { doctorConsumer } from './doctor'
import { planInstallPlugin, resolveInstalledConsumerPath, type PlannedInstallTarget } from './install'

export interface VerifyInstallCheck {
  platform: TargetPlatform
  installPath: string
  consumerPath: string
  built: boolean
  installed: boolean
  stale: boolean
  staleReason?: string
  ok: boolean
  errors: number
  warnings: number
  infos: number
}

export interface VerifyInstallResult {
  ok: boolean
  pluginName: string
  outDir: string
  checks: VerifyInstallCheck[]
}

function buildCheckFromReport(
  target: PlannedInstallTarget,
  pluginName: string,
  report: Awaited<ReturnType<typeof doctorConsumer>>,
): VerifyInstallCheck {
  const consumerPath = resolveInstalledConsumerPath(target, pluginName)
  const staleReason = target.built && existsSync(consumerPath)
    ? detectStaleInstall(target, pluginName, consumerPath)
    : undefined
  const stale = staleReason !== undefined
  return {
    platform: target.platform,
    installPath: target.pluginDir,
    consumerPath,
    built: target.built,
    installed: existsSync(consumerPath),
    stale,
    ...(staleReason ? { staleReason } : {}),
    ok: report.errors === 0 && !stale,
    errors: report.errors + (stale ? 1 : 0),
    warnings: report.warnings,
    infos: report.infos,
  }
}

function manifestPathForPlatform(platform: TargetPlatform): string | undefined {
  switch (platform) {
    case 'claude-code':
      return '.claude-plugin/plugin.json'
    case 'cursor':
      return '.cursor-plugin/plugin.json'
    case 'codex':
      return '.codex-plugin/plugin.json'
    case 'opencode':
      return 'package.json'
    default:
      return undefined
  }
}

function readInstalledManifestVersion(rootDir: string, platform: TargetPlatform): string | undefined {
  const manifestPath = manifestPathForPlatform(platform)
  if (!manifestPath) return undefined

  const filepath = resolve(rootDir, manifestPath)
  if (!existsSync(filepath)) return undefined

  try {
    const manifest = JSON.parse(readFileSync(filepath, 'utf-8')) as { version?: unknown }
    return typeof manifest.version === 'string' ? manifest.version : undefined
  } catch {
    return undefined
  }
}

function findCodexCacheCandidates(pluginName: string): Array<{ path: string; version?: string; mtimeMs: number }> {
  const home = process.env.HOME ?? '~'
  const cacheRoot = resolve(home, '.codex/plugins/cache')
  if (!existsSync(cacheRoot)) return []

  const candidates: Array<{ path: string; version?: string; mtimeMs: number }> = []
  for (const marketplace of readdirSync(cacheRoot)) {
    const pluginRoot = resolve(cacheRoot, marketplace, pluginName)
    if (!existsSync(pluginRoot)) continue

    for (const versionDir of readdirSync(pluginRoot)) {
      const candidatePath = resolve(pluginRoot, versionDir)
      try {
        const stats = statSync(candidatePath)
        if (!stats.isDirectory()) continue
        candidates.push({
          path: candidatePath,
          version: readInstalledManifestVersion(candidatePath, 'codex') ?? versionDir,
          mtimeMs: stats.mtimeMs,
        })
      } catch {
        // Ignore malformed cache entries; doctorConsumer will handle the source install path.
      }
    }
  }

  return candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)
}

function detectCodexCacheStaleness(pluginName: string, builtVersion: string | undefined): string | undefined {
  if (!builtVersion) return undefined

  const candidates = findCodexCacheCandidates(pluginName)
  if (candidates.length === 0) return undefined
  if (candidates.some((candidate) => candidate.version === builtVersion)) return undefined

  const newest = candidates[0]
  return `Codex active cache appears stale at ${newest.path}; cached version ${newest.version ?? 'unknown'} does not match built version ${builtVersion}. Use Plugins > Refresh if available, or restart/reinstall Codex to load the current plugin bundle.`
}

function detectStaleInstall(target: PlannedInstallTarget, pluginName: string, consumerPath: string): string | undefined {
  try {
    const details = lstatSync(consumerPath)
    if (details.isSymbolicLink()) {
      const installedRealPath = realpathSync(consumerPath)
      const builtRealPath = realpathSync(target.sourceDir)
      if (installedRealPath !== builtRealPath) {
        return `installed symlink points to ${readlinkSync(consumerPath)}, not the current build at ${target.sourceDir}`
      }
    }
  } catch {
    return undefined
  }

  const builtVersion = readInstalledManifestVersion(target.sourceDir, target.platform)
  const installedVersion = readInstalledManifestVersion(consumerPath, target.platform)
  if (builtVersion && installedVersion && builtVersion !== installedVersion) {
    return `installed version ${installedVersion} does not match built version ${builtVersion}`
  }

  if (target.platform === 'codex') {
    return detectCodexCacheStaleness(pluginName, builtVersion)
  }

  return undefined
}

export async function verifyInstall(
  config: PluginConfig,
  options: {
    rootDir?: string
    targets?: TargetPlatform[]
    builtOnly?: boolean
  } = {},
): Promise<VerifyInstallResult> {
  const rootDir = options.rootDir ?? process.cwd()
  const distDir = resolve(rootDir, config.outDir)
  const targets = options.targets ?? config.targets
  const installPlan = planInstallPlugin(distDir, config.name, targets)
  const filteredPlan = options.builtOnly
    ? installPlan.filter((target) => target.built)
    : installPlan
  const checks = await Promise.all(
    filteredPlan.map(async (target) => {
      const consumerPath = resolveInstalledConsumerPath(target, config.name)
      const report = await doctorConsumer(consumerPath)
      return buildCheckFromReport(target, config.name, report)
    }),
  )

  return {
    ok: checks.every((check) => check.ok),
    pluginName: config.name,
    outDir: config.outDir,
    checks,
  }
}

export function printVerifyInstallResult(result: VerifyInstallResult): void {
  console.log(`Verify install: ${result.pluginName}`)
  for (const check of result.checks) {
    const prefix = check.ok ? 'PASS' : 'FAIL'
    console.log(`${prefix} ${check.platform}: ${check.consumerPath}`)
    console.log(`  install path: ${check.installPath}`)
    console.log(`  built: ${check.built ? 'yes' : 'no'}; installed: ${check.installed ? 'yes' : 'no'}; errors: ${check.errors}; warnings: ${check.warnings}; infos: ${check.infos}`)
    if (check.stale) {
      console.log(`  stale install: ${check.staleReason}`)
    }
    if (!check.ok) {
      for (const action of getVerifyInstallRecoveryActions(check)) {
        console.log(`  fix: ${action}`)
      }
    }
  }
  console.log(result.ok ? 'pluxx verify-install passed.' : 'pluxx verify-install failed.')
}

function getVerifyInstallRecoveryActions(check: VerifyInstallCheck): string[] {
  const actions: string[] = []

  if (!check.built) {
    actions.push(`run pluxx build --target ${check.platform}`)
  }

  if (check.built && !check.installed) {
    actions.push(`run pluxx install --target ${check.platform}${check.platform === 'claude-code' ? ' and accept/trust any hook prompt if expected' : ''}`)
  }

  if (check.stale) {
    actions.push(`rerun pluxx install --target ${check.platform} to replace the stale local install`)
    if (check.platform === 'codex') {
      actions.push('in Codex, use Plugins > Refresh if available, or restart Codex so the plugin cache reloads')
    }
  }

  if (check.errors > 0 && actions.length === 0) {
    actions.push(`run pluxx doctor --consumer "${check.consumerPath}" for the detailed host-specific failure`)
  }

  return actions
}
