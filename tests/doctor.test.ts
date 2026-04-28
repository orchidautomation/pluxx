import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { doctorConsumer, doctorProject } from '../src/cli/doctor'

const ROOT = resolve(import.meta.dir, '..')

function createProjectFixture(): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-doctor-'))
  mkdirSync(resolve(dir, 'skills/hello'), { recursive: true })
  writeFileSync(
    resolve(dir, 'skills/hello/SKILL.md'),
    '---\nname: hello\ndescription: Say hello\nversion: 0.1.0\n---\n\n# Hello\n',
  )
  writeFileSync(resolve(dir, 'INSTRUCTIONS.md'), '# Instructions\n')
  writeFileSync(
    resolve(dir, 'pluxx.config.json'),
    JSON.stringify({
      name: 'doctor-fixture',
      version: '0.1.0',
      description: 'Doctor fixture',
      author: { name: 'Test Author' },
      license: 'MIT',
      userConfig: [
        {
          key: 'fixture-api-key',
          title: 'Fixture API Key',
          description: 'Access token used by the fixture MCP.',
          type: 'secret',
          required: true,
          envVar: 'FIXTURE_API_KEY',
        },
      ],
      skills: './skills/',
      instructions: './INSTRUCTIONS.md',
      hooks: {
        sessionStart: [
          { type: 'command', command: 'bash "${PLUGIN_ROOT}/scripts/check-env.sh"' },
        ],
      },
      mcp: {
        fixture: {
          transport: 'http',
          url: 'https://example.com/mcp',
          auth: {
            type: 'bearer',
            envVar: 'FIXTURE_API_KEY',
            headerName: 'Authorization',
            headerTemplate: 'Bearer ${value}',
          },
        },
      },
      targets: ['claude-code', 'cursor'],
      outDir: './dist',
    }, null, 2),
  )
  return dir
}

function createConsumerFixture(): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-doctor-consumer-'))
  mkdirSync(resolve(dir, '.cursor-plugin'), { recursive: true })
  mkdirSync(resolve(dir, 'scripts'), { recursive: true })
  writeFileSync(
    resolve(dir, '.cursor-plugin/plugin.json'),
    JSON.stringify({
      name: 'consumer-fixture',
      version: '0.1.0',
      mcpServers: './mcp.json',
    }, null, 2),
  )
  writeFileSync(
    resolve(dir, 'mcp.json'),
    JSON.stringify({
      mcpServers: {
        fixture: {
          type: 'http',
          url: 'https://example.com/mcp',
          headers: {
            Authorization: 'Bearer shh-secret',
          },
        },
      },
    }, null, 2),
  )
  writeFileSync(
    resolve(dir, '.pluxx-user.json'),
    JSON.stringify({
      values: {
        'fixture-api-key': 'shh-secret',
      },
      env: {
        FIXTURE_API_KEY: 'shh-secret',
      },
    }, null, 2),
  )
  writeFileSync(
    resolve(dir, 'scripts/check-env.sh'),
    '#!/usr/bin/env bash\nset -euo pipefail\n# pluxx install materialized required config for this local plugin install.\nexit 0\n',
  )
  return dir
}

function createCodexConsumerFixture(options: { includeRuntime?: boolean } = {}): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-doctor-codex-consumer-'))
  mkdirSync(resolve(dir, '.codex-plugin'), { recursive: true })
  if (options.includeRuntime) {
    mkdirSync(resolve(dir, 'mcp-server/dist'), { recursive: true })
    writeFileSync(resolve(dir, 'mcp-server/dist/index.js'), 'console.log("runtime")\n')
  }
  writeFileSync(
    resolve(dir, '.codex-plugin/plugin.json'),
    JSON.stringify({
      name: 'codex-consumer-fixture',
      version: '0.1.0',
      skills: './skills/',
      mcpServers: './.mcp.json',
    }, null, 2),
  )
  writeFileSync(
    resolve(dir, '.mcp.json'),
    JSON.stringify({
      mcpServers: {
        hosted: {
          url: 'https://example.com/mcp',
        },
        localFixture: {
          command: 'node',
          args: ['./mcp-server/dist/index.js', '--stdio'],
          env: {
            LOCAL_FIXTURE_TOKEN: '${LOCAL_FIXTURE_TOKEN}',
          },
        },
      },
    }, null, 2),
  )
  return dir
}

function createOpenCodeConsumerFixture(options: { includeEntry?: boolean; includeSyncedSkills?: boolean } = {}): string {
  const includeEntry = options.includeEntry ?? true
  const includeSyncedSkills = options.includeSyncedSkills ?? true

  const root = mkdtempSync(resolve(tmpdir(), 'pluxx-doctor-opencode-'))
  const pluginDir = resolve(root, '.config/opencode/plugins/megamind')
  const skillDir = resolve(pluginDir, 'skills/client-intel')

  mkdirSync(skillDir, { recursive: true })
  writeFileSync(
    resolve(pluginDir, 'package.json'),
    JSON.stringify({
      name: 'opencode-megamind',
      version: '0.1.0',
      keywords: ['opencode-plugin'],
      peerDependencies: {
        '@opencode-ai/plugin': '*',
      },
    }, null, 2),
  )
  writeFileSync(resolve(pluginDir, 'index.ts'), 'export const MegamindPlugin = async () => ({});\n')
  writeFileSync(
    resolve(pluginDir, 'skills/client-intel/SKILL.md'),
    '---\nname: client-intel\ndescription: Client intel\n---\n\n# Client Intel\n',
  )

  if (includeEntry) {
    writeFileSync(
      resolve(root, '.config/opencode/plugins/megamind.ts'),
      [
        'import type { Plugin } from "@opencode-ai/plugin"',
        'import { join } from "path"',
        '',
        'import * as PluginModule from "./megamind/index.ts"',
        '',
        'const pluginFactory = Object.values(PluginModule).find((value): value is Plugin => typeof value === "function")',
        '',
        'if (!pluginFactory) {',
        '  throw new Error("OpenCode plugin bundle for megamind did not export a plugin function.")',
        '}',
        '',
        'export const Megamind: Plugin = async (context) =>',
        '  pluginFactory({',
        '    ...context,',
        '    directory: join(context.directory, "megamind"),',
        '  })',
        '',
      ].join('\n'),
    )
  }

  if (includeSyncedSkills) {
    const syncedSkillDir = resolve(root, '.config/opencode/skills/megamind-client-intel')
    mkdirSync(syncedSkillDir, { recursive: true })
    writeFileSync(
      resolve(syncedSkillDir, 'SKILL.md'),
      '---\nname: megamind/client-intel\ndescription: Client intel\n---\n\n# Client Intel\n',
    )
  }

  return pluginDir
}

describe('doctorProject', () => {
  it('returns warnings and infos without failing a healthy project', async () => {
    const dir = createProjectFixture()

    try {
      const report = await doctorProject(dir)

      expect(report.ok).toBe(true)
      expect(report.errors).toBe(0)
      expect(report.warnings).toBeGreaterThanOrEqual(1)
      expect(report.checks.some((check) => check.code === 'node-version' && check.level === 'success')).toBe(true)
      expect(report.checks.some((check) => check.code === 'hooks-trust-required' && check.level === 'warning')).toBe(true)
      expect(report.checks.some((check) => check.code === 'mcp-auth-env' && check.level === 'info')).toBe(true)
      expect(report.checks.some((check) => check.code === 'user-config-declared' && check.level === 'info')).toBe(true)
      expect(report.checks.some((check) => check.code === 'primitive-preserve' && check.level === 'success')).toBe(true)
      expect(report.checks.some((check) => check.code === 'primitive-translate' && check.level === 'info' && check.title.includes('distribution') && check.title.includes('claude-code'))).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('fails when no config is present', async () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'pluxx-doctor-empty-'))

    try {
      const report = await doctorProject(dir)
      expect(report.ok).toBe(false)
      expect(report.errors).toBe(1)
      expect(report.checks.some((check) => check.code === 'config-not-found')).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reports malformed MCP scaffold metadata as a blocking error', async () => {
    const dir = createProjectFixture()
    mkdirSync(resolve(dir, '.pluxx'), { recursive: true })
    writeFileSync(resolve(dir, '.pluxx/mcp.json'), '{broken')

    try {
      const report = await doctorProject(dir)
      expect(report.ok).toBe(false)
      expect(report.checks.some((check) => check.code === 'mcp-metadata-invalid' && check.level === 'error')).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('warns when MCP scaffold metadata has weak tool metadata', async () => {
    const dir = createProjectFixture()
    mkdirSync(resolve(dir, '.pluxx'), { recursive: true })
    writeFileSync(
      resolve(dir, '.pluxx/mcp.json'),
      JSON.stringify({
        version: 1,
        source: {
          transport: 'http',
          url: 'https://example.com/mcp',
        },
        serverInfo: {
          name: 'fixture',
        },
        settings: {
          pluginName: 'doctor-fixture',
          displayName: 'Doctor Fixture',
          skillGrouping: 'workflow',
          requestedHookMode: 'none',
          generatedHookMode: 'none',
          generatedHookEvents: [],
        },
        tools: [
          { name: 'tool_1', description: 'N/A' },
          { name: 'search_accounts' },
        ],
        skills: [],
        managedFiles: ['INSTRUCTIONS.md'],
      }, null, 2),
    )

    try {
      const report = await doctorProject(dir)
      expect(report.checks.some((check) => check.code === 'mcp-metadata-quality-weak' && check.level === 'warning')).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('does not warn on terse but valid tool descriptions', async () => {
    const dir = createProjectFixture()
    mkdirSync(resolve(dir, '.pluxx'), { recursive: true })
    writeFileSync(
      resolve(dir, '.pluxx/mcp.json'),
      JSON.stringify({
        version: 1,
        source: {
          transport: 'http',
          url: 'https://example.com/mcp',
        },
        serverInfo: {
          name: 'fixture',
        },
        settings: {
          pluginName: 'doctor-fixture',
          displayName: 'Doctor Fixture',
          skillGrouping: 'workflow',
          requestedHookMode: 'none',
          generatedHookMode: 'none',
          generatedHookEvents: [],
        },
        tools: [
          { name: 'check_status', description: 'Check status' },
          { name: 'list_tables', description: 'List tables' },
        ],
        skills: [],
        managedFiles: ['INSTRUCTIONS.md'],
      }, null, 2),
    )

    try {
      const report = await doctorProject(dir)
      expect(report.checks.some((check) => check.code === 'mcp-metadata-quality-weak')).toBe(false)
      expect(report.checks.some((check) => check.code === 'mcp-metadata-quality-ok' && check.level === 'success')).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('explains when migrated source-host assumptions still influence compilation', async () => {
    const dir = createProjectFixture()
    mkdirSync(resolve(dir, '.pluxx'), { recursive: true })
    writeFileSync(
      resolve(dir, '.pluxx/compiler-intent.json'),
      JSON.stringify({
        version: 1,
        skillPolicies: [
          {
            skillDir: 'hello',
            title: 'hello',
            source: {
              kind: 'claude-allowed-tools',
              platform: 'claude-code',
            },
            permissions: {
              allow: ['Read(*)'],
            },
          },
        ],
      }, null, 2),
    )

    try {
      const report = await doctorProject(dir)
      expect(report.checks.some((check) => check.code === 'compiler-intent-source-host' && check.level === 'info')).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('explains Codex prompt-hook and permission guidance at project level', async () => {
    const dir = createProjectFixture()
    writeFileSync(
      resolve(dir, 'pluxx.config.json'),
      JSON.stringify({
        name: 'doctor-codex-guidance',
        version: '0.1.0',
        description: 'doctor guidance fixture',
        author: { name: 'Test Author' },
        skills: './skills/',
        targets: ['codex'],
        permissions: {
          allow: ['Read(src/**)'],
          ask: ['Bash(git status)'],
        },
        hooks: {
          beforeSubmitPrompt: [
            {
              type: 'prompt',
              prompt: 'Add one last review pass before sending the prompt.',
            },
          ],
        },
      }, null, 2),
    )

    try {
      const report = await doctorProject(dir)
      expect(report.checks.some((check) => check.code === 'codex-permissions-guidance' && check.level === 'info')).toBe(true)
      expect(report.checks.some((check) => check.code === 'codex-prompt-hook-translation' && check.level === 'info')).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('prints stable JSON from the CLI', async () => {
    const dir = createProjectFixture()

    try {
      const proc = Bun.spawn(['bun', resolve(ROOT, 'bin/pluxx.js'), 'doctor', '--json'], {
        cwd: dir,
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
      expect(stderr).toBe('')

      const report = JSON.parse(stdout) as {
        ok: boolean
        errors: number
        warnings: number
        infos: number
        checks: Array<{ code: string }>
      }

      expect(report.ok).toBe(true)
      expect(typeof report.errors).toBe('number')
      expect(typeof report.warnings).toBe('number')
      expect(typeof report.infos).toBe('number')
      expect(Array.isArray(report.checks)).toBe(true)
      expect(report.checks.some((check) => check.code === 'config-valid')).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('doctorConsumer', () => {
  it('reports installed bundle health for a materialized consumer install', async () => {
    const dir = createConsumerFixture()

    try {
      const report = await doctorConsumer(dir)
      expect(report.ok).toBe(true)
      expect(report.checks.some((check) => check.code === 'consumer-platform-detected' && check.level === 'success')).toBe(true)
      expect(report.checks.some((check) => check.code === 'consumer-manifest-valid' && check.level === 'success')).toBe(true)
      expect(report.checks.some((check) => check.code === 'consumer-user-config-valid' && check.level === 'success')).toBe(true)
      expect(report.checks.some((check) => check.code === 'consumer-env-script-materialized' && check.level === 'success')).toBe(true)
      expect(report.checks.some((check) => check.code === 'consumer-mcp-inline-auth' && check.level === 'success')).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('fails cleanly when consumer mode points at a source project', async () => {
    const dir = createProjectFixture()

    try {
      const report = await doctorConsumer(dir)
      expect(report.ok).toBe(false)
      expect(report.checks.some((check) => check.code === 'consumer-source-project' && check.level === 'error')).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('prints stable JSON from the CLI in consumer mode', async () => {
    const dir = createConsumerFixture()

    try {
      const proc = Bun.spawn(['bun', resolve(ROOT, 'bin/pluxx.js'), 'doctor', '--consumer', '--json', dir], {
        cwd: ROOT,
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      expect(exitCode).toBe(0)
      expect(stderr).toBe('')

      const report = JSON.parse(stdout) as {
        ok: boolean
        checks: Array<{ code: string }>
      }

      expect(report.ok).toBe(true)
      expect(report.checks.some((check) => check.code === 'consumer-platform-detected')).toBe(true)
      expect(report.checks.some((check) => check.code === 'consumer-mcp-inline-auth')).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reports stdio and runtime-auth expectations for Codex-style installed bundles', async () => {
    const dir = createCodexConsumerFixture()

    try {
      const report = await doctorConsumer(dir)
      expect(report.ok).toBe(true)
      expect(report.checks.some((check) => check.code === 'consumer-platform-detected' && check.level === 'success')).toBe(true)
      expect(report.checks.some((check) => check.code === 'consumer-mcp-stdio' && check.level === 'info')).toBe(true)
      expect(report.checks.some((check) => check.code === 'consumer-mcp-stdio-runtime-missing' && check.level === 'warning')).toBe(true)
      expect(report.checks.some((check) => check.code === 'consumer-mcp-remote-auth-runtime' && check.level === 'info')).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('clears the missing-runtime warning when the bundled stdio files are present', async () => {
    const dir = createCodexConsumerFixture({ includeRuntime: true })

    try {
      const report = await doctorConsumer(dir)
      expect(report.checks.some((check) => check.code === 'consumer-mcp-stdio' && check.level === 'info')).toBe(true)
      expect(report.checks.some((check) => check.code === 'consumer-mcp-stdio-runtime-missing')).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('validates OpenCode host-visible wrapper and exported skills for installed bundles', async () => {
    const dir = createOpenCodeConsumerFixture()

    try {
      const report = await doctorConsumer(dir)
      expect(report.ok).toBe(true)
      expect(report.checks.some((check) => check.code === 'consumer-opencode-entry-valid' && check.level === 'success')).toBe(true)
      expect(report.checks.some((check) => check.code === 'consumer-opencode-skill-sync-valid' && check.level === 'success')).toBe(true)
    } finally {
      rmSync(resolve(dir, '..', '..', '..', '..'), { recursive: true, force: true })
    }
  })

  it('fails OpenCode consumer checks when the host entry file is missing', async () => {
    const dir = createOpenCodeConsumerFixture({ includeEntry: false })

    try {
      const report = await doctorConsumer(dir)
      expect(report.ok).toBe(false)
      expect(report.checks.some((check) => check.code === 'consumer-opencode-entry-missing' && check.level === 'error')).toBe(true)
    } finally {
      rmSync(resolve(dir, '..', '..', '..', '..'), { recursive: true, force: true })
    }
  })
})
