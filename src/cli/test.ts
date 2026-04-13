import { existsSync } from 'fs'
import { resolve } from 'path'
import { loadConfig } from '../config/load'
import { build } from '../generators'
import { lintProject, type LintResult } from './lint'
import type { TargetPlatform } from '../schema'

export interface TestRunOptions {
  rootDir?: string
  targets?: TargetPlatform[]
}

export interface TestSmokeCheck {
  platform: TargetPlatform
  requiredPath: string
  ok: boolean
}

export interface TestRunResult {
  ok: boolean
  config: {
    ok: boolean
    name?: string
    version?: string
    error?: string
  }
  lint?: LintResult
  build?: {
    ok: boolean
    outDir: string
    targets: TargetPlatform[]
  }
  smoke?: {
    ok: boolean
    checks: TestSmokeCheck[]
  }
}

const SMOKE_PATHS: Record<TargetPlatform, string> = {
  'claude-code': '.claude-plugin/plugin.json',
  cursor: '.cursor-plugin/plugin.json',
  codex: '.codex-plugin/plugin.json',
  opencode: 'package.json',
  'github-copilot': '.claude-plugin/plugin.json',
  openhands: '.plugin/plugin.json',
  warp: 'AGENTS.md',
  'gemini-cli': 'gemini-extension.json',
  'roo-code': '.roo/mcp.json',
  cline: '.cline/mcp.json',
  amp: '.amp/settings.json',
}

export async function runTestSuite(options: TestRunOptions = {}): Promise<TestRunResult> {
  const rootDir = options.rootDir ?? process.cwd()

  try {
    const config = await loadConfig(rootDir)
    const targets = options.targets ?? config.targets
    const lint = await lintProject(rootDir)

    if (lint.errors > 0) {
      return {
        ok: false,
        config: {
          ok: true,
          name: config.name,
          version: config.version,
        },
        lint,
      }
    }

    await build(config, rootDir, { targets })

    const checks = targets.map((platform) => {
      const requiredPath = SMOKE_PATHS[platform]
      const ok = existsSync(resolve(rootDir, config.outDir, platform, requiredPath))
      return { platform, requiredPath, ok }
    })

    return {
      ok: checks.every((check) => check.ok),
      config: {
        ok: true,
        name: config.name,
        version: config.version,
      },
      lint,
      build: {
        ok: true,
        outDir: config.outDir,
        targets,
      },
      smoke: {
        ok: checks.every((check) => check.ok),
        checks,
      },
    }
  } catch (error) {
    return {
      ok: false,
      config: {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
    }
  }
}

export function printTestResult(result: TestRunResult): void {
  if (!result.config.ok) {
    console.error(`Config: ${result.config.error}`)
    return
  }

  console.log(`Config: ${result.config.name}@${result.config.version}`)

  if (result.lint) {
    console.log(`Lint: ${result.lint.errors} error(s), ${result.lint.warnings} warning(s)`)
  }

  if (result.build) {
    console.log(`Build: ${result.build.targets.join(', ')} -> ${result.build.outDir}`)
  }

  if (result.smoke) {
    for (const check of result.smoke.checks) {
      const prefix = check.ok ? 'PASS' : 'FAIL'
      console.log(`${prefix} ${check.platform}: ${check.requiredPath}`)
    }
  }

  console.log(result.ok ? 'pluxx test passed.' : 'pluxx test failed.')
}
