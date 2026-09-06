import { describe, it, expect } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { spawnSync } from 'child_process'
import { buildHookCommandWrapperScript } from '../src/hook-command-env'

function createHookWrapperFixture(): {
  root: string
  pluginRoot: string
  workspaceRoot: string
  wrapperPath: string
} {
  const root = mkdtempSync(resolve(tmpdir(), 'pluxx-hook-command-env-'))
  const pluginRoot = resolve(root, 'plugin')
  const workspaceRoot = resolve(root, 'workspace')
  const wrapperPath = resolve(pluginRoot, 'hooks/pluxx-hook-command-1.mjs')

  mkdirSync(resolve(pluginRoot, 'hooks'), { recursive: true })
  mkdirSync(resolve(pluginRoot, 'scripts'), { recursive: true })
  mkdirSync(workspaceRoot, { recursive: true })

  writeFileSync(
    resolve(pluginRoot, 'scripts/print-workspace.mjs'),
    [
      'import { readFileSync } from "node:fs"',
      'const stdin = readFileSync(0, "utf8")',
      'process.stdout.write(JSON.stringify({',
      '  workspaceRoot: process.env.PLUXX_HOOK_WORKSPACE_ROOT ?? null,',
      '  pluginRoot: process.env.PLUXX_PLUGIN_ROOT ?? null,',
      '  stdin,',
      '}))',
      '',
    ].join('\n'),
  )
  writeFileSync(
    wrapperPath,
    buildHookCommandWrapperScript(
      'node "${PLUXX_PLUGIN_ROOT}/scripts/print-workspace.mjs"',
      'PLUGIN_ROOT',
    ),
  )

  return { root, pluginRoot, workspaceRoot, wrapperPath }
}

describe('hook command wrapper environment', () => {
  it('exposes the active workspace from the hook payload without consuming command stdin', () => {
    const fixture = createHookWrapperFixture()
    const payload = JSON.stringify({ cwd: fixture.workspaceRoot })

    try {
      const result = spawnSync('node', [fixture.wrapperPath], {
        cwd: fixture.root,
        input: payload,
        encoding: 'utf-8',
        env: {
          ...process.env,
          PLUGIN_ROOT: fixture.pluginRoot,
        },
      })

      expect(result.status).toBe(0)
      const output = JSON.parse(result.stdout)
      expect(output.workspaceRoot).toBe(fixture.workspaceRoot)
      expect(output.pluginRoot).toBe(fixture.pluginRoot)
      expect(output.stdin).toBe(payload)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('prefers an explicit workspace env var and does not default to plugin root', () => {
    const fixture = createHookWrapperFixture()

    try {
      const explicitResult = spawnSync('node', [fixture.wrapperPath], {
        cwd: fixture.root,
        input: '',
        encoding: 'utf-8',
        env: {
          ...process.env,
          PLUGIN_ROOT: fixture.pluginRoot,
          PLUXX_HOOK_WORKSPACE_ROOT: fixture.workspaceRoot,
        },
      })

      expect(explicitResult.status).toBe(0)
      expect(JSON.parse(explicitResult.stdout).workspaceRoot).toBe(fixture.workspaceRoot)

      const noWorkspaceResult = spawnSync('node', [fixture.wrapperPath], {
        cwd: fixture.root,
        input: '',
        encoding: 'utf-8',
        env: {
          ...process.env,
          PLUGIN_ROOT: fixture.pluginRoot,
        },
      })

      expect(noWorkspaceResult.status).toBe(0)
      expect(JSON.parse(noWorkspaceResult.stdout).workspaceRoot).toBe(null)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('prefers the hook payload over a stale generic workspace env var', () => {
    const fixture = createHookWrapperFixture()
    const payloadWorkspace = resolve(fixture.root, 'payload-workspace')
    mkdirSync(payloadWorkspace, { recursive: true })
    const payload = JSON.stringify({ cwd: payloadWorkspace })

    try {
      const result = spawnSync('node', [fixture.wrapperPath], {
        cwd: fixture.root,
        input: payload,
        encoding: 'utf-8',
        env: {
          ...process.env,
          PLUGIN_ROOT: fixture.pluginRoot,
          CODEX_WORKSPACE_ROOT: fixture.workspaceRoot,
        },
      })

      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout).workspaceRoot).toBe(payloadWorkspace)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('falls back to the installed wrapper bundle when the documented root is unset', () => {
    const fixture = createHookWrapperFixture()

    try {
      const env = { ...process.env }
      delete env.PLUGIN_ROOT
      const result = spawnSync('node', [fixture.wrapperPath], {
        cwd: fixture.root,
        input: '',
        encoding: 'utf-8',
        env,
      })

      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout).pluginRoot).toBe(fixture.pluginRoot)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('rejects a stale documented root and uses the installed wrapper bundle', () => {
    const fixture = createHookWrapperFixture()
    const staleRoot = resolve(fixture.root, 'stale-bundle')
    mkdirSync(staleRoot, { recursive: true })

    try {
      const result = spawnSync('node', [fixture.wrapperPath], {
        cwd: fixture.root,
        input: '',
        encoding: 'utf-8',
        env: {
          ...process.env,
          PLUGIN_ROOT: staleRoot,
        },
      })

      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout).pluginRoot).toBe(fixture.pluginRoot)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })
})
