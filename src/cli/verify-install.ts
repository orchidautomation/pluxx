import { existsSync } from 'fs'
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
  return {
    platform: target.platform,
    installPath: target.pluginDir,
    consumerPath,
    built: target.built,
    installed: existsSync(consumerPath),
    ok: report.errors === 0,
    errors: report.errors,
    warnings: report.warnings,
    infos: report.infos,
  }
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
  }
  console.log(result.ok ? 'pluxx verify-install passed.' : 'pluxx verify-install failed.')
}
