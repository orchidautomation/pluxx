import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import {
  buildHostTargetSelection,
  detectHostFamilies,
  type HostDetectionEvidenceType,
  type HostDetectionReport,
} from '../src/host-detection'
import type { TargetPlatform } from '../src/schema'

let rootDir = ''
let homeDir = ''
let binDir = ''
let appDir = ''

beforeEach(() => {
  rootDir = mkdtempSync(resolve(tmpdir(), 'pluxx-host-detect-root-'))
  homeDir = mkdtempSync(resolve(tmpdir(), 'pluxx-host-detect-home-'))
  binDir = resolve(rootDir, 'bin')
  appDir = resolve(rootDir, 'Applications')
  mkdirSync(binDir, { recursive: true })
  mkdirSync(appDir, { recursive: true })
})

afterEach(() => {
  rmSync(rootDir, { recursive: true, force: true })
  rmSync(homeDir, { recursive: true, force: true })
})

describe('host detection', () => {
  it('detects core-four host families from CLI, app, config, project config, and installed plugin evidence', () => {
    writeExecutable('claude')
    writeExecutable('cursor-agent')
    writeExecutable('codex')
    writeExecutable('opencode')

    mkdirSync(resolve(appDir, 'Cursor.app'), { recursive: true })
    mkdirSync(resolve(appDir, 'Codex.app'), { recursive: true })

    writeJson(resolve(homeDir, '.claude.json'), { projects: {} })
    writeJson(resolve(rootDir, '.claude/settings.json'), {})
    mkdirSync(resolve(homeDir, '.claude/plugins/cache/pluxx-local-demo/demo/1.0.0'), { recursive: true })

    writeJson(resolve(homeDir, '.cursor/mcp.json'), { mcpServers: {} })
    writeJson(resolve(rootDir, '.cursor/mcp.json'), { mcpServers: {} })
    mkdirSync(resolve(homeDir, '.cursor/plugins/local/demo'), { recursive: true })

    writeText(resolve(homeDir, '.codex/config.toml'), 'model = "gpt-5"\n')
    writeText(resolve(rootDir, '.codex/config.toml'), 'model = "gpt-5"\n')
    mkdirSync(resolve(homeDir, '.codex/plugins/demo'), { recursive: true })

    writeJson(resolve(homeDir, '.config/opencode/opencode.json'), {})
    writeJson(resolve(rootDir, 'opencode.json'), {})
    mkdirSync(resolve(homeDir, '.config/opencode/plugins/demo'), { recursive: true })

    const report = detectHostFamilies({
      rootDir,
      homeDir,
      pathEnv: binDir,
      appDirs: [appDir],
      platform: 'darwin',
    })

    expect(report.detectedHosts).toEqual(['claude-code', 'cursor', 'codex', 'opencode'])
    expect(evidenceTypes(report, 'claude-code')).toEqual(expect.arrayContaining(['cli', 'user-config', 'project-config', 'installed-plugin']))
    expect(evidenceTypes(report, 'cursor')).toEqual(expect.arrayContaining(['cli', 'app', 'user-config', 'project-config', 'installed-plugin']))
    expect(evidenceTypes(report, 'codex')).toEqual(expect.arrayContaining(['cli', 'app', 'user-config', 'project-config', 'installed-plugin']))
    expect(evidenceTypes(report, 'opencode')).toEqual(expect.arrayContaining(['cli', 'user-config', 'project-config', 'installed-plugin']))
  })

  it('returns deterministic negative results when no temp fixture evidence exists', () => {
    const report = detectHostFamilies({
      rootDir,
      homeDir,
      pathEnv: '',
      appDirs: [appDir],
      platform: 'darwin',
    })

    expect(report.detectedHosts).toEqual([])
    expect(report.hosts.map((host) => ({
      host: host.host,
      detected: host.detected,
      evidence: host.evidence,
    }))).toEqual([
      { host: 'claude-code', detected: false, evidence: [] },
      { host: 'cursor', detected: false, evidence: [] },
      { host: 'codex', detected: false, evidence: [] },
      { host: 'opencode', detected: false, evidence: [] },
    ])
  })

  it('reports project config evidence without treating it as an installed host signal', () => {
    writeText(resolve(rootDir, '.codex/config.toml'), 'model = "gpt-5"\n')

    const report = detectHostFamilies({
      rootDir,
      homeDir,
      pathEnv: '',
      appDirs: [appDir],
      platform: 'darwin',
      hosts: ['codex'],
    })

    expect(report.detectedHosts).toEqual([])
    expect(report.hosts).toEqual([
      {
        host: 'codex',
        detected: false,
        evidence: [
          {
            type: 'project-config',
            label: 'Codex project config',
            path: resolve(rootDir, '.codex/config.toml'),
          },
        ],
      },
    ])
  })

  it('keeps explicit install targets authoritative while exposing suggestions', () => {
    const report: HostDetectionReport = {
      detectedHosts: ['codex', 'opencode'],
      hosts: [],
    }
    const configTargets: TargetPlatform[] = ['claude-code', 'codex', 'github-copilot']

    const explicit = buildHostTargetSelection(configTargets, ['cursor'], report)
    expect(explicit.source).toBe('explicit-targets')
    expect(explicit.selectedTargets).toEqual(['cursor'])
    expect(explicit.suggestedTargets).toEqual(['codex'])
    expect(explicit.explicitOverride).toBe(true)
    expect(explicit.note).toContain('Explicit --target selection is authoritative')

    const fromConfig = buildHostTargetSelection(configTargets, undefined, report)
    expect(fromConfig.source).toBe('config-targets')
    expect(fromConfig.selectedTargets).toEqual(configTargets)
    expect(fromConfig.suggestedTargets).toEqual(['codex'])
    expect(fromConfig.explicitOverride).toBe(false)
  })
})

function evidenceTypes(report: HostDetectionReport, host: string): HostDetectionEvidenceType[] {
  return report.hosts.find((entry) => entry.host === host)?.evidence.map((evidence) => evidence.type) ?? []
}

function writeExecutable(name: string): void {
  const filepath = resolve(binDir, name)
  writeFileSync(filepath, '#!/usr/bin/env sh\nexit 0\n')
  chmodSync(filepath, 0o755)
}

function writeJson(filepath: string, value: unknown): void {
  mkdirSync(resolve(filepath, '..'), { recursive: true })
  writeFileSync(filepath, JSON.stringify(value, null, 2) + '\n')
}

function writeText(filepath: string, value: string): void {
  mkdirSync(resolve(filepath, '..'), { recursive: true })
  writeFileSync(filepath, value)
}
