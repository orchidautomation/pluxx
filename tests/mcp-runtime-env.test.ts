import { describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { spawnSync } from 'child_process'
import { buildMcpRuntimeEnvScript } from '../src/mcp-runtime-env'

function makeTempDir(prefix: string): string {
  const dir = resolve(tmpdir(), `${prefix}${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

const WORKSPACE_ENV_KEYS = [
  'PLUXX_MCP_WORKSPACE_ROOT',
  'PLUXX_WORKSPACE_ROOT',
  'PLUXX_HOOK_WORKSPACE_ROOT',
  'CODEX_WORKSPACE_ROOT',
  'CODEX_WORKDIR',
  'CODEX_CWD',
  'CLAUDE_PROJECT_DIR',
  'CLAUDE_CWD',
  'CURSOR_WORKSPACE_ROOT',
  'OPENCODE_WORKSPACE_ROOT',
  'WORKSPACE_ROOT',
  'PROJECT_ROOT',
  'INIT_CWD',
  'PWD',
] as const

function isolatedRuntimeEnv(extra: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extra }
  for (const key of WORKSPACE_ENV_KEYS) {
    delete env[key]
  }
  return env
}

function preparePluginRoot(rootDir: string): { pluginRoot: string; wrapperPath: string; capturePath: string } {
  const pluginRoot = resolve(rootDir, 'plugin')
  const runtimeDir = resolve(pluginRoot, 'runtime')
  const scriptsDir = resolve(pluginRoot, 'scripts')
  mkdirSync(runtimeDir, { recursive: true })
  mkdirSync(scriptsDir, { recursive: true })

  const wrapperPath = resolve(runtimeDir, 'pluxx-mcp-env.mjs')
  const capturePath = resolve(scriptsDir, 'capture-env.mjs')

  writeFileSync(wrapperPath, buildMcpRuntimeEnvScript())
  writeFileSync(capturePath, [
    'import { writeFileSync } from "node:fs"',
    'writeFileSync(process.env.PLUXX_CAPTURE_PATH, JSON.stringify({',
    '  apiKey: process.env.SENDLENS_INSTANTLY_API_KEY,',
    '  client: process.env.SENDLENS_CLIENT,',
    '  workspaceRoot: process.env.PLUXX_MCP_WORKSPACE_ROOT,',
    '}, null, 2))',
  ].join('\n'))

  writeFileSync(
    resolve(pluginRoot, '.pluxx-user.json'),
    JSON.stringify({
      env: {
        SENDLENS_INSTANTLY_API_KEY: 'stale-installed-key',
        SENDLENS_CLIENT: 'stale-installed-client',
      },
    }, null, 2) + '\n',
  )

  return { pluginRoot, wrapperPath, capturePath }
}

describe('MCP runtime env launcher', () => {
  it('loads runtime-inherited env from the launch workspace .env ahead of global and installed config', () => {
    const rootDir = makeTempDir('pluxx-mcp-runtime-env-')
    try {
      const workspaceRoot = resolve(rootDir, 'workspace')
      mkdirSync(workspaceRoot, { recursive: true })
      writeFileSync(
        resolve(workspaceRoot, '.env'),
        [
          'SENDLENS_INSTANTLY_API_KEY=workspace-key',
          'SENDLENS_CLIENT=workspace-client',
        ].join('\n') + '\n',
      )

      const { wrapperPath, capturePath } = preparePluginRoot(rootDir)
      const outputPath = resolve(rootDir, 'captured.json')
      const result = spawnSync(process.execPath, [
        wrapperPath,
        '["SENDLENS_CLIENT","SENDLENS_INSTANTLY_API_KEY"]',
        '--',
        process.execPath,
        capturePath,
      ], {
        cwd: workspaceRoot,
        encoding: 'utf-8',
        env: isolatedRuntimeEnv({
          PLUXX_CAPTURE_PATH: outputPath,
          SENDLENS_INSTANTLY_API_KEY: 'global-key',
          SENDLENS_CLIENT: 'global-client',
        }),
      })

      expect(result.status).toBe(0)
      expect(result.stderr).toBe('')
      expect(existsSync(outputPath)).toBe(true)
      expect(JSON.parse(readFileSync(outputPath, 'utf-8'))).toEqual({
        apiKey: 'workspace-key',
        client: 'workspace-client',
        workspaceRoot: realpathSync(workspaceRoot),
      })
    } finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })

  it('parses malicious workspace .env values as literal text without command execution', () => {
    const rootDir = makeTempDir('pluxx-mcp-runtime-env-malicious-')
    try {
      const workspaceRoot = resolve(rootDir, 'workspace')
      mkdirSync(workspaceRoot, { recursive: true })
      const markerPath = resolve(rootDir, 'executed-marker')
      writeFileSync(
        resolve(workspaceRoot, '.env'),
        `SENDLENS_INSTANTLY_API_KEY=$(touch ${markerPath}; printf token)\n`,
      )

      const { wrapperPath, capturePath } = preparePluginRoot(rootDir)
      const outputPath = resolve(rootDir, 'captured.json')
      const result = spawnSync(process.execPath, [
        wrapperPath,
        '["SENDLENS_INSTANTLY_API_KEY"]',
        '--',
        process.execPath,
        capturePath,
      ], {
        cwd: workspaceRoot,
        encoding: 'utf-8',
        env: isolatedRuntimeEnv({
          PLUXX_CAPTURE_PATH: outputPath,
          SENDLENS_INSTANTLY_API_KEY: 'global-key',
        }),
      })

      expect(result.status).toBe(0)
      expect(result.stderr).toBe('')
      expect(existsSync(markerPath)).toBe(false)
      expect(JSON.parse(readFileSync(outputPath, 'utf-8')).apiKey).toBe(`$(touch ${markerPath}; printf token)`)
    } finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })

  it('falls back to global env when the launch workspace does not define runtime vars', () => {
    const rootDir = makeTempDir('pluxx-mcp-runtime-global-')
    try {
      const workspaceRoot = resolve(rootDir, 'workspace')
      mkdirSync(workspaceRoot, { recursive: true })
      mkdirSync(resolve(workspaceRoot, '.git'), { recursive: true })

      const { wrapperPath, capturePath } = preparePluginRoot(rootDir)
      const outputPath = resolve(rootDir, 'captured.json')
      const result = spawnSync(process.execPath, [
        wrapperPath,
        '["SENDLENS_CLIENT","SENDLENS_INSTANTLY_API_KEY"]',
        '--',
        process.execPath,
        capturePath,
      ], {
        cwd: workspaceRoot,
        encoding: 'utf-8',
        env: isolatedRuntimeEnv({
          PLUXX_CAPTURE_PATH: outputPath,
          SENDLENS_INSTANTLY_API_KEY: 'global-key',
          SENDLENS_CLIENT: 'global-client',
        }),
      })

      expect(result.status).toBe(0)
      expect(result.stderr).toBe('')
      expect(JSON.parse(readFileSync(outputPath, 'utf-8'))).toEqual({
        apiKey: 'global-key',
        client: 'global-client',
        workspaceRoot: realpathSync(workspaceRoot),
      })
    } finally {
      rmSync(rootDir, { recursive: true, force: true })
    }
  })
})
