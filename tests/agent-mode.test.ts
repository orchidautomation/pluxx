import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import {
  applyAgentPreparePlan,
  applyAgentPromptPlan,
  AGENT_CONTEXT_PATH,
  AGENT_DOCS_CONTEXT_PATH,
  AGENT_OVERRIDES_PATH,
  AGENT_PLAN_PATH,
  AGENT_SOURCES_PATH,
  planAgentPrepare,
  planAgentPrompt,
} from '../src/cli/agent'
import { writeMcpScaffold } from '../src/cli/init-from-mcp'
import type { IntrospectedMcpServer } from '../src/mcp/introspect'

const TEST_DIR = resolve(import.meta.dir, '.agent-mode')
const MANUAL_DIR = resolve(import.meta.dir, '.agent-mode-manual')
const ROOT = resolve(import.meta.dir, '..')

const introspection: IntrospectedMcpServer = {
  protocolVersion: '2025-03-26',
  instructions: 'Use the most specific tool for the request.',
  serverInfo: {
    name: 'playkit',
    title: 'PlayKit',
    version: '1.0.0',
    description: 'Clay expertise in every AI conversation.',
    websiteUrl: 'https://playkit.sh/',
  },
  resources: [
    {
      uri: 'playkit://guides/getting-started',
      name: 'getting-started',
      description: 'Setup guide for account connection and onboarding.',
      mimeType: 'text/markdown',
    },
  ],
  resourceTemplates: [
    {
      uriTemplate: 'playkit://workflows/{workflow_id}',
      name: 'workflow-template',
      description: 'Parameterized workflow reference.',
      mimeType: 'application/json',
    },
  ],
  prompts: [
    {
      name: 'design-workflow',
      description: 'Design a Clay workflow before enrichment.',
      arguments: [
        {
          name: 'workflow_goal',
          required: true,
        },
      ],
    },
  ],
  tools: [
    {
      name: 'ask_clay',
      description: 'Answer Clay questions instantly.',
      inputSchema: {
        type: 'object',
        properties: {
          question: { type: 'string' },
        },
        required: ['question'],
      },
    },
    {
      name: 'design_clay',
      description: 'Design a complete Clay workflow.',
      inputSchema: {
        type: 'object',
        properties: {
          use_case: { type: 'string' },
        },
        required: ['use_case'],
      },
    },
    {
      name: 'get_usage',
      description: 'Get current usage and limits.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ],
}

beforeEach(async () => {
  rmSync(TEST_DIR, { recursive: true, force: true })
  rmSync(MANUAL_DIR, { recursive: true, force: true })
  await writeMcpScaffold({
    rootDir: TEST_DIR,
    pluginName: 'playkit',
    authorName: 'Orchid Automation',
    displayName: 'PlayKit',
    skillGrouping: 'workflow',
    hookMode: 'safe',
    targets: ['claude-code', 'cursor', 'codex', 'opencode'],
    source: {
      transport: 'http',
      url: 'https://mcp.playkit.sh/mcp',
      auth: {
        type: 'header',
        envVar: 'PLAYKIT_API_KEY',
        headerName: 'X-API-Key',
        headerTemplate: '${value}',
      },
    },
    introspection,
  })

  writeManualPluginFixture(MANUAL_DIR)
})

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
  rmSync(MANUAL_DIR, { recursive: true, force: true })
})

function writeManualPluginFixture(rootDir: string): void {
  mkdirSync(resolve(rootDir, 'skills/manual-review'), { recursive: true })
  mkdirSync(resolve(rootDir, 'commands'), { recursive: true })

  writeFileSync(
    resolve(rootDir, 'pluxx.config.json'),
    JSON.stringify({
      name: 'manual-review',
      version: '0.1.0',
      description: 'Review a manually authored Pluxx plugin.',
      author: {
        name: 'Orchid Automation',
      },
      license: 'MIT',
      skills: './skills/',
      commands: './commands/',
      instructions: './INSTRUCTIONS.md',
      targets: ['claude-code', 'cursor', 'codex', 'opencode'],
      brand: {
        displayName: 'Manual Review',
      },
      outDir: './dist',
    }, null, 2),
  )

  writeFileSync(
    resolve(rootDir, 'INSTRUCTIONS.md'),
    [
      '# Manual Review',
      '',
      'Review this manually authored Pluxx project for listing quality and operator clarity.',
    ].join('\n'),
  )

  writeFileSync(
    resolve(rootDir, 'skills/manual-review/SKILL.md'),
    [
      '---',
      'name: manual-review',
      'description: Review the manual plugin surface before shipping.',
      '---',
      '',
      '# Manual Review',
      '',
      'Use this skill to review the plugin before shipping.',
    ].join('\n'),
  )

  writeFileSync(
    resolve(rootDir, 'commands/review.md'),
    [
      '---',
      'description: Review the plugin listing surface.',
      '---',
      '',
      '# Review',
      '',
      'Run a findings-first review of the plugin surface.',
    ].join('\n'),
  )
}

describe('agent mode', () => {
  it('plans deterministic context and boundary files from MCP scaffold metadata', async () => {
    const plan = await planAgentPrepare(TEST_DIR)

    expect(plan.pluginName).toBe('playkit')
    expect(plan.toolCount).toBe(3)
    expect(plan.generatedFiles).toEqual([AGENT_CONTEXT_PATH, AGENT_PLAN_PATH])
    expect(plan.editableFiles).toContain('.pluxx/taxonomy.json')
    expect(plan.editableFiles).toContain('INSTRUCTIONS.md')
    expect(plan.editableFiles.some((file) => file.startsWith('skills/'))).toBe(true)
    expect(plan.editableFiles.some((file) => file.startsWith('commands/'))).toBe(true)
    expect(plan.protectedFiles).toContain('pluxx.config.ts')
    expect(plan.createdFiles).toEqual([AGENT_CONTEXT_PATH, AGENT_PLAN_PATH])
    expect(plan.lint.errors).toBe(0)
  })

  it('writes agent context and plan files', async () => {
    const plan = await planAgentPrepare(TEST_DIR)
    await applyAgentPreparePlan(TEST_DIR, plan)

    const contextPath = resolve(TEST_DIR, AGENT_CONTEXT_PATH)
    const planPath = resolve(TEST_DIR, AGENT_PLAN_PATH)

    expect(existsSync(contextPath)).toBe(true)
    expect(existsSync(planPath)).toBe(true)

    const context = readFileSync(contextPath, 'utf-8')
    const planFile = JSON.parse(readFileSync(planPath, 'utf-8')) as {
      version: number
      files: {
        editable: Array<{ path: string }>
        protected: string[]
      }
      successCriteria: string[]
    }

    expect(context).toContain('# Pluxx Agent Context')
    expect(context).toContain('- Server name: `playkit`')
    expect(context).toContain('- Semantic taxonomy: `.pluxx/taxonomy.json`')
    expect(context).toContain('- Resource count: 1')
    expect(context).toContain('- Prompt template count: 1')
    expect(context).toContain('### `ask-clay`')
    expect(context).toContain('### `workflow-design`')
    expect(context).toContain('- Related resources: `workflow-template`')
    expect(context).toContain('- Related prompt templates: `design-workflow`')
    expect(context).toContain('Resource `getting-started`')
    expect(context).toContain('## MCP Discovery Surfaces')
    expect(context).toContain('Resource `getting-started`')
    expect(context).toContain('Prompt `design-workflow`')
    expect(context).toContain('Respect the per-skill resource and prompt-template associations in the metadata/context unless stronger discovery evidence shows they are wrong.')
    expect(context).toContain('Preserve custom sections marked by')
    expect(planFile.version).toBe(1)
    expect(planFile.files.editable.some((file) => file.path === '.pluxx/taxonomy.json')).toBe(true)
    expect(planFile.files.editable.some((file) => file.path === 'INSTRUCTIONS.md')).toBe(true)
    expect(planFile.files.protected).toContain('dist/')
    expect(planFile.successCriteria.length).toBeGreaterThan(0)
  })

  it('supports CLI dry-run and JSON output without writing files', async () => {
    const proc = Bun.spawn(
      ['bun', resolve(ROOT, 'bin/pluxx.js'), 'agent', 'prepare', '--json', '--dry-run'],
      {
        cwd: TEST_DIR,
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(stderr).toBe('')

    const summary = JSON.parse(stdout) as {
      pluginName: string
      generatedFiles: string[]
      dryRun: boolean
    }

    expect(summary.pluginName).toBe('playkit')
    expect(summary.generatedFiles).toEqual([AGENT_CONTEXT_PATH, AGENT_PLAN_PATH])
    expect(summary.dryRun).toBe(true)
    expect(existsSync(resolve(TEST_DIR, AGENT_CONTEXT_PATH))).toBe(false)
    expect(existsSync(resolve(TEST_DIR, AGENT_PLAN_PATH))).toBe(false)
  })

  it('generates a taxonomy prompt pack after prepare', async () => {
    const preparePlan = await planAgentPrepare(TEST_DIR)
    await applyAgentPreparePlan(TEST_DIR, preparePlan)

    const promptPlan = await planAgentPrompt(TEST_DIR, 'taxonomy')
    await applyAgentPromptPlan(TEST_DIR, promptPlan)

    const promptPath = resolve(TEST_DIR, '.pluxx/agent/taxonomy-prompt.md')
    expect(existsSync(promptPath)).toBe(true)

    const prompt = readFileSync(promptPath, 'utf-8')
    expect(prompt).toContain('# Taxonomy Prompt')
    expect(prompt).toContain('.pluxx/agent/context.md')
    expect(prompt).toContain('.pluxx/taxonomy.json')
    expect(prompt).toContain('Only edit Pluxx-managed generated sections.')
    expect(prompt).toContain('- each skill represents a real user workflow or product surface')
    expect(prompt).toContain('skill names are product-shaped and avoid raw MCP tool/server identifiers when possible')
    expect(prompt).toContain('singleton skills are avoided unless they represent a real standalone user workflow')
    expect(prompt).toContain('Eliminate misleading labels such as contact or people discovery')
    expect(prompt).toContain('Pluxx will re-render generated skills and commands from that taxonomy after the pass')
    expect(prompt).toContain('tools, resources, resource templates, and prompt templates')
    expect(prompt).toContain('Use per-skill related resources and prompt templates as strong evidence for workflow shape')
    expect(prompt).toContain('Reject stale scaffold assumptions')
    expect(prompt).toContain('avoid weak command UX')
    expect(prompt).toContain('per-skill resource and prompt-template associations remain coherent with the chosen taxonomy')
    expect(prompt).toContain('not stale scaffold assumptions')
  })

  it('supports CLI dry-run for prompt generation without writing files', async () => {
    const preparePlan = await planAgentPrepare(TEST_DIR)
    await applyAgentPreparePlan(TEST_DIR, preparePlan)

    const proc = Bun.spawn(
      ['bun', resolve(ROOT, 'bin/pluxx.js'), 'agent', 'prompt', 'review', '--json', '--dry-run'],
      {
        cwd: TEST_DIR,
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(stderr).toBe('')

    const summary = JSON.parse(stdout) as {
      kind: string
      outputPath: string
      dryRun: boolean
    }

    expect(summary.kind).toBe('review')
    expect(summary.outputPath).toBe('.pluxx/agent/review-prompt.md')
    expect(summary.dryRun).toBe(true)
    expect(existsSync(resolve(TEST_DIR, '.pluxx/agent/review-prompt.md'))).toBe(false)
  })

  it('includes metadata-quality and scaffold-vs-runtime guidance in review prompts', async () => {
    const preparePlan = await planAgentPrepare(TEST_DIR)
    await applyAgentPreparePlan(TEST_DIR, preparePlan)

    const promptPlan = await planAgentPrompt(TEST_DIR, 'review')
    await applyAgentPromptPlan(TEST_DIR, promptPlan)

    const promptPath = resolve(TEST_DIR, '.pluxx/agent/review-prompt.md')
    const prompt = readFileSync(promptPath, 'utf-8')
    expect(prompt).toContain('weak MCP metadata signals')
    expect(prompt).toContain('Separate scaffold quality findings from runtime-correctness findings.')
    expect(prompt).toContain('scaffold quality gaps are distinguished from runtime correctness')
    expect(prompt).toContain('raw documentation dumps')
    expect(prompt).toContain('lexical skill names')
    expect(prompt).toContain('stale scaffold assumptions')
    expect(prompt).toContain('incoherent per-skill resource/prompt associations')
    expect(prompt).toContain('weak command UX')
    expect(prompt).toContain('stale assumptions, incoherent per-skill discovery associations, and command-UX weaknesses are identified explicitly when present')
  })

  it('supports CLI dry-run for review runs and keeps Claude in plan mode', async () => {
    const proc = Bun.spawn(
      ['bun', resolve(ROOT, 'bin/pluxx.js'), 'agent', 'run', 'review', '--runner', 'claude', '--json', '--dry-run'],
      {
        cwd: TEST_DIR,
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(stderr).toBe('')

    const summary = JSON.parse(stdout) as {
      kind: string
      runner: string
      verify: boolean
      command: string[]
      dryRun: boolean
    }

    expect(summary.kind).toBe('review')
    expect(summary.runner).toBe('claude')
    expect(summary.verify).toBe(false)
    expect(summary.command).toContain('--no-session-persistence')
    expect(summary.command).toContain('--verbose')
    expect(summary.command).toContain('--output-format')
    expect(summary.command).toContain('stream-json')
    expect(summary.command).toContain('--permission-mode')
    expect(summary.command).toContain('plan')
    expect(summary.dryRun).toBe(true)
    expect(existsSync(resolve(TEST_DIR, AGENT_CONTEXT_PATH))).toBe(false)
    expect(existsSync(resolve(TEST_DIR, '.pluxx/agent/review-prompt.md'))).toBe(false)
  })

  it('supports CLI dry-run for Codex runs and uses codex exec semantics', async () => {
    const proc = Bun.spawn(
      ['bun', resolve(ROOT, 'bin/pluxx.js'), 'agent', 'run', 'taxonomy', '--runner', 'codex', '--json', '--dry-run'],
      {
        cwd: TEST_DIR,
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(stderr).toBe('')

    const summary = JSON.parse(stdout) as {
      runner: string
      command: string[]
      verify: boolean
    }

    expect(summary.runner).toBe('codex')
    expect(summary.command.slice(0, 11)).toEqual([
      'codex',
      'exec',
      '--ephemeral',
      '--skip-git-repo-check',
      '--disable',
      'general_analytics',
      '--disable',
      'plugins',
      '--disable',
      'shell_snapshot',
      '--full-auto',
    ])
    expect(summary.verify).toBe(true)
  })

  it('keeps Codex review runs read-only in dry-run mode', async () => {
    const proc = Bun.spawn(
      ['bun', resolve(ROOT, 'bin/pluxx.js'), 'agent', 'run', 'review', '--runner', 'codex', '--json', '--dry-run'],
      {
        cwd: TEST_DIR,
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(stderr).toBe('')

    const summary = JSON.parse(stdout) as {
      runner: string
      command: string[]
      verify: boolean
    }

    expect(summary.runner).toBe('codex')
    expect(summary.command[0]).toBe('codex')
    expect(summary.command[1]).toBe('exec')
    expect(summary.command).toContain('--ephemeral')
    expect(summary.command).toContain('--skip-git-repo-check')
    expect(summary.command).toContain('--disable')
    expect(summary.command).toContain('general_analytics')
    expect(summary.command).toContain('plugins')
    expect(summary.command).toContain('shell_snapshot')
    expect(summary.command).not.toContain('--full-auto')
    expect(summary.verify).toBe(false)
  })

  it('supports CLI dry-run for Cursor runs and uses workspace + force semantics', async () => {
    const proc = Bun.spawn(
      ['bun', resolve(ROOT, 'bin/pluxx.js'), 'agent', 'run', 'taxonomy', '--runner', 'cursor', '--model', 'gpt-5-mini', '--json', '--dry-run'],
      {
        cwd: TEST_DIR,
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(stderr).toBe('')

    const summary = JSON.parse(stdout) as {
      runner: string
      command: string[]
      verify: boolean
    }

    expect(summary.runner).toBe('cursor')
    expect(summary.command[0]).toBe('agent')
    expect(summary.command).toContain('-p')
    expect(summary.command).toContain('--trust')
    expect(summary.command).toContain('--workspace')
    expect(summary.command).toContain(TEST_DIR)
    expect(summary.command).toContain('--force')
    expect(summary.command).toContain('--model')
    expect(summary.command).toContain('gpt-5-mini')
    expect(summary.verify).toBe(true)
  })

  it('supports CLI dry-run for OpenCode runs and includes attach/model options', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        resolve(ROOT, 'bin/pluxx.js'),
        'agent',
        'run',
        'taxonomy',
        '--runner',
        'opencode',
        '--attach',
        'http://localhost:4096',
        '--model',
        'gpt-5-mini',
        '--json',
        '--dry-run',
      ],
      {
        cwd: TEST_DIR,
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(stderr).toBe('')

    const summary = JSON.parse(stdout) as {
      runner: string
      command: string[]
      verify: boolean
    }

    expect(summary.runner).toBe('opencode')
    expect(summary.command[0]).toBe('opencode')
    expect(summary.command[1]).toBe('run')
    expect(summary.command).toContain('--attach')
    expect(summary.command).toContain('http://localhost:4096')
    expect(summary.command).toContain('--model')
    expect(summary.command).toContain('gpt-5-mini')
    expect(summary.verify).toBe(true)
  })

  it('rejects --attach for the Cursor runner', async () => {
    const proc = Bun.spawn(
      ['bun', resolve(ROOT, 'bin/pluxx.js'), 'agent', 'run', 'taxonomy', '--runner', 'cursor', '--attach', 'http://localhost:4096', '--dry-run'],
      {
        cwd: TEST_DIR,
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(1)
    expect(stdout).toBe('')
    expect(stderr).toContain('--attach is only supported for the opencode runner.')
  })

  it('keeps Cursor review runs read-only in dry-run mode', async () => {
    const proc = Bun.spawn(
      ['bun', resolve(ROOT, 'bin/pluxx.js'), 'agent', 'run', 'review', '--runner', 'cursor', '--json', '--dry-run'],
      {
        cwd: TEST_DIR,
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(stderr).toBe('')

    const summary = JSON.parse(stdout) as {
      runner: string
      command: string[]
      verify: boolean
    }

    expect(summary.runner).toBe('cursor')
    expect(summary.command[0]).toBe('agent')
    expect(summary.command).toContain('-p')
    expect(summary.command).toContain('--trust')
    expect(summary.command).toContain('--workspace')
    expect(summary.command).not.toContain('--force')
    expect(summary.verify).toBe(false)
  })

  it('executes the Cursor runner in non-interactive mode and checks auth status first', async () => {
    const binDir = resolve(TEST_DIR, '.bin')
    const runnerArgsPath = resolve(TEST_DIR, 'cursor-runner-args.txt')
    const cursorAgentPath = resolve(binDir, 'agent')

    mkdirSync(binDir, { recursive: true })
    writeFileSync(
      cursorAgentPath,
      '#!/bin/sh\nprintf "%s\\0" "$@" >> "$PLUXX_RUNNER_ARGS"\nif [ "$1" = "status" ]; then\n  exit 0\nfi\nexit 0\n',
    )
    chmodSync(cursorAgentPath, 0o755)

    const proc = Bun.spawn(
      ['bun', resolve(ROOT, 'bin/pluxx.js'), 'agent', 'run', 'taxonomy', '--runner', 'cursor', '--json', '--no-verify'],
      {
        cwd: TEST_DIR,
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH ?? ''}`,
          PLUXX_RUNNER_ARGS: runnerArgsPath,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(stderr).toBe('')

    const summary = JSON.parse(stdout) as {
      ok: boolean
      runner: string
      runnerExitCode: number
      verify: boolean
    }
    expect(summary.ok).toBe(true)
    expect(summary.runner).toBe('cursor')
    expect(summary.runnerExitCode).toBe(0)
    expect(summary.verify).toBe(false)

    const runnerArgs = readFileSync(runnerArgsPath, 'utf-8').split('\0').filter(Boolean)
    expect(runnerArgs).toContain('status')
    expect(runnerArgs).toContain('-p')
    expect(runnerArgs).toContain('--workspace')
    expect(runnerArgs).toContain('--force')
  })

  it('supports Cursor installs that expose only the cursor-agent binary', async () => {
    const binDir = resolve(TEST_DIR, '.bin-cursor-agent')
    const runnerArgsPath = resolve(TEST_DIR, 'cursor-agent-runner-args.txt')
    const cursorAgentPath = resolve(binDir, 'cursor-agent')

    mkdirSync(binDir, { recursive: true })
    writeFileSync(
      cursorAgentPath,
      '#!/bin/sh\nprintf "%s\\0" "$@" >> "$PLUXX_RUNNER_ARGS"\nif [ "$1" = "status" ]; then\n  exit 0\nfi\nexit 0\n',
    )
    chmodSync(cursorAgentPath, 0o755)

    const proc = Bun.spawn(
      ['bun', resolve(ROOT, 'bin/pluxx.js'), 'agent', 'run', 'taxonomy', '--runner', 'cursor', '--json', '--no-verify'],
      {
        cwd: TEST_DIR,
        env: {
          ...process.env,
          PATH: `${binDir}:${(process.env.PATH ?? '').split(':').filter((segment) => !segment.endsWith('/.local/bin')).join(':')}`,
          PLUXX_RUNNER_ARGS: runnerArgsPath,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(stderr).toBe('')

    const summary = JSON.parse(stdout) as {
      ok: boolean
      runner: string
      runnerExitCode: number
      verify: boolean
    }

    expect(summary.ok).toBe(true)
    expect(summary.runner).toBe('cursor')
    expect(summary.runnerExitCode).toBe(0)
    expect(summary.verify).toBe(false)

    const runnerArgs = readFileSync(runnerArgsPath, 'utf-8').split('\0').filter(Boolean)
    expect(runnerArgs).toContain('status')
    expect(runnerArgs).toContain('-p')
    expect(runnerArgs).toContain('--workspace')
    expect(runnerArgs).toContain('--force')
  })

  it('executes the OpenCode runner with attach support', async () => {
    const binDir = resolve(TEST_DIR, '.bin')
    const runnerArgsPath = resolve(TEST_DIR, 'opencode-runner-args.txt')
    const opencodePath = resolve(binDir, 'opencode')

    mkdirSync(binDir, { recursive: true })
    writeFileSync(
      opencodePath,
      '#!/bin/sh\nprintf "%s\\0" "$@" >> "$PLUXX_RUNNER_ARGS"\nexit 0\n',
    )
    chmodSync(opencodePath, 0o755)

    const proc = Bun.spawn(
      [
        'bun',
        resolve(ROOT, 'bin/pluxx.js'),
        'agent',
        'run',
        'taxonomy',
        '--runner',
        'opencode',
        '--attach',
        'http://localhost:4096',
        '--json',
        '--no-verify',
      ],
      {
        cwd: TEST_DIR,
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH ?? ''}`,
          PLUXX_RUNNER_ARGS: runnerArgsPath,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(stderr).toBe('')

    const summary = JSON.parse(stdout) as {
      ok: boolean
      runner: string
      runnerExitCode: number
      verify: boolean
    }
    expect(summary.ok).toBe(true)
    expect(summary.runner).toBe('opencode')
    expect(summary.runnerExitCode).toBe(0)
    expect(summary.verify).toBe(false)

    const runnerArgs = readFileSync(runnerArgsPath, 'utf-8').split('\0').filter(Boolean)
    expect(runnerArgs).toContain('run')
    expect(runnerArgs).toContain('--attach')
    expect(runnerArgs).toContain('http://localhost:4096')
  })

  it('prints actionable guidance when Cursor auth is missing', async () => {
    const binDir = resolve(TEST_DIR, '.bin')
    const cursorAgentPath = resolve(binDir, 'agent')

    mkdirSync(binDir, { recursive: true })
    writeFileSync(
      cursorAgentPath,
      '#!/bin/sh\nif [ "$1" = "status" ]; then\n  exit 1\nfi\nexit 0\n',
    )
    chmodSync(cursorAgentPath, 0o755)

    const proc = Bun.spawn(
      ['bun', resolve(ROOT, 'bin/pluxx.js'), 'agent', 'run', 'taxonomy', '--runner', 'cursor', '--no-verify'],
      {
        cwd: TEST_DIR,
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH ?? ''}`,
          CURSOR_API_KEY: '',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(1)
    expect(stdout).toBe('')
    expect(stderr).toContain('Cursor CLI authentication is required')
    expect(stderr).toContain('agent login')
    expect(stderr).toContain('CURSOR_API_KEY')
  })

  it('executes the Claude runner, writes the agent pack, and verifies the scaffold', async () => {
    const binDir = resolve(TEST_DIR, '.bin')
    const runnerArgsPath = resolve(TEST_DIR, 'runner-args.txt')
    const claudePath = resolve(binDir, 'claude')

    mkdirSync(binDir, { recursive: true })
    writeFileSync(
      claudePath,
      '#!/bin/sh\nprintf "%s\\0" "$@" > "$PLUXX_RUNNER_ARGS"\nexit 0\n',
    )
    chmodSync(claudePath, 0o755)

    const proc = Bun.spawn(
      ['bun', resolve(ROOT, 'bin/pluxx.js'), 'agent', 'run', 'taxonomy', '--runner', 'claude', '--json'],
      {
        cwd: TEST_DIR,
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH ?? ''}`,
          PLUXX_RUNNER_ARGS: runnerArgsPath,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(stderr).toBe('')

    const summary = JSON.parse(stdout) as {
      ok: boolean
      kind: string
      runner: string
      verify: boolean
      runnerExitCode: number
      verification?: { ok: boolean }
    }

    expect(summary.ok).toBe(true)
    expect(summary.kind).toBe('taxonomy')
    expect(summary.runner).toBe('claude')
    expect(summary.verify).toBe(true)
    expect(summary.runnerExitCode).toBe(0)
    expect(summary.verification?.ok).toBe(true)
    expect(existsSync(resolve(TEST_DIR, AGENT_CONTEXT_PATH))).toBe(true)
    expect(existsSync(resolve(TEST_DIR, '.pluxx/agent/taxonomy-prompt.md'))).toBe(true)

    const runnerArgs = readFileSync(runnerArgsPath, 'utf-8').split('\0').filter(Boolean)
    expect(runnerArgs).toContain('--no-session-persistence')
    expect(runnerArgs).toContain('--verbose')
    expect(runnerArgs).toContain('--output-format')
    expect(runnerArgs).toContain('stream-json')
    expect(runnerArgs).toContain('--permission-mode')
    expect(runnerArgs).toContain('acceptEdits')
    expect(runnerArgs).toContain('-p')
    expect(runnerArgs.some((arg) => arg.includes('.pluxx/agent/context.md'))).toBe(true)
    expect(runnerArgs.some((arg) => arg.includes('.pluxx/agent/taxonomy-prompt.md'))).toBe(true)
  })

  it('re-renders skills and commands after a taxonomy run updates .pluxx/taxonomy.json', async () => {
    const binDir = resolve(TEST_DIR, '.bin')
    const codexPath = resolve(binDir, 'codex')
    const taxonomyPath = resolve(TEST_DIR, '.pluxx/taxonomy.json')

    mkdirSync(binDir, { recursive: true })
    writeFileSync(
      codexPath,
      `#!/bin/sh
if [ "$1" = "exec" ]; then
  cat > "$PLUXX_TAXONOMY_PATH" <<'EOF'
[
  {
    "dirName": "research",
    "title": "Research",
    "description": "Handle Clay workflow design and usage context.",
    "toolNames": ["ask_clay", "design_clay", "get_usage"]
  }
]
EOF
  exit 0
fi
exit 1
`,
    )
    chmodSync(codexPath, 0o755)

    const proc = Bun.spawn(
      ['bun', resolve(ROOT, 'bin/pluxx.js'), 'agent', 'run', 'taxonomy', '--runner', 'codex', '--json', '--no-verify'],
      {
        cwd: TEST_DIR,
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH ?? ''}`,
          PLUXX_TAXONOMY_PATH: taxonomyPath,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(stderr).toBe('')

    const summary = JSON.parse(stdout) as { ok: boolean; runner: string; verify: boolean }
    expect(summary.ok).toBe(true)
    expect(summary.runner).toBe('codex')
    expect(summary.verify).toBe(false)

    expect(existsSync(resolve(TEST_DIR, 'skills/research/SKILL.md'))).toBe(true)
    expect(existsSync(resolve(TEST_DIR, 'commands/research.md'))).toBe(true)
    expect(existsSync(resolve(TEST_DIR, 'skills/ask-clay/SKILL.md'))).toBe(false)
    expect(existsSync(resolve(TEST_DIR, 'commands/ask-clay.md'))).toBe(false)
    expect(existsSync(resolve(TEST_DIR, '.pluxx/agent/instructions-prompt.md'))).toBe(true)
    expect(existsSync(resolve(TEST_DIR, '.pluxx/agent/review-prompt.md'))).toBe(true)

    const context = readFileSync(resolve(TEST_DIR, AGENT_CONTEXT_PATH), 'utf-8')
    const instructionsPrompt = readFileSync(resolve(TEST_DIR, '.pluxx/agent/instructions-prompt.md'), 'utf-8')
    const reviewPrompt = readFileSync(resolve(TEST_DIR, '.pluxx/agent/review-prompt.md'), 'utf-8')
    expect(context).toContain('### `research`')
    expect(context).not.toContain('### `ask-clay`')
    expect(instructionsPrompt).toContain('`skills/research/SKILL.md`')
    expect(instructionsPrompt).not.toContain('`skills/ask-clay/SKILL.md`')
    expect(reviewPrompt).toContain('`skills/research/SKILL.md`')
    expect(reviewPrompt).not.toContain('`skills/ask-clay/SKILL.md`')
  })

  it('force-closes sticky Codex process trees once the final message is available', async () => {
    const binDir = resolve(MANUAL_DIR, '.bin')
    const codexPath = resolve(binDir, 'codex')

    mkdirSync(binDir, { recursive: true })
    writeFileSync(
      codexPath,
      `#!/bin/sh
if [ "$1" = "exec" ]; then
  shift
  output=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --output-last-message)
        output="$2"
        shift 2
        ;;
      --disable|--model)
        shift 2
        ;;
      *)
        shift
        ;;
    esac
  done
  mkdir -p "$(dirname "$output")"
  printf 'OK\\n' > "$output"
  printf '{"type":"thread.started"}\\n'
  printf '{"type":"turn.started"}\\n'
  printf '{"type":"turn.completed"}\\n'
  sh -c 'trap "" TERM; while true; do sleep 10; done' &
  worker=$!
  trap '' TERM
  wait "$worker"
  exit 0
fi
exit 1
`,
    )
    chmodSync(codexPath, 0o755)

    const start = Date.now()
    const proc = Bun.spawn(
      ['bun', resolve(ROOT, 'bin/pluxx.js'), 'agent', 'run', 'review', '--runner', 'codex', '--json'],
      {
        cwd: MANUAL_DIR,
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH ?? ''}`,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const timedExit = await Promise.race([
      proc.exited.then((value) => ({ kind: 'exit' as const, value })),
      new Promise<{ kind: 'timeout' }>((resolvePromise) => {
        setTimeout(() => resolvePromise({ kind: 'timeout' }), 7_000)
      }),
    ])

    if (timedExit.kind === 'timeout') {
      proc.kill()
      throw new Error('Codex runner remained stuck after the final message was available.')
    }

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()

    expect(timedExit.value).toBe(0)
    expect(stderr).toBe('')
    expect(Date.now() - start).toBeLessThan(7_000)

    const summary = JSON.parse(stdout) as {
      ok: boolean
      runner: string
      runnerExitCode: number
      verify: boolean
    }

    expect(summary.ok).toBe(true)
    expect(summary.runner).toBe('codex')
    expect(summary.runnerExitCode).toBe(0)
    expect(summary.verify).toBe(false)
  })

  it('captures website, docs, inferred docs root, and local file context inputs in the generated context pack', async () => {
    writeFileSync(resolve(TEST_DIR, 'notes.md'), '# Notes\n\nPlayKit separates Clay knowledge tools from Clay API tools.')

    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input) => {
      const request = new Request(input)
      const isDocsRoot = request.url === 'https://docs.playkit.sh/'
      const title = isDocsRoot
        ? 'Introduction | PlayKit'
        : request.url.includes('docs')
          ? 'PlayKit Docs'
          : 'PlayKit'
      const body = isDocsRoot
        ? '<h1>Introduction</h1><h2>Knowledge Search</h2><h2>Clay API Workflows</h2><p>Get started with PlayKit by connecting Clay before using the API-heavy workflows.</p>'
        : '<h1>Clay expertise in every AI conversation</h1><p>Knowledge tools work immediately. Clay API tools require Clay auth.</p>'
      return new Response(
        `<!doctype html><html><head><title>${title}</title><meta name="description" content="Clay expertise in every AI conversation."></head><body>${body}</body></html>`,
        {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        },
      )
    }) as typeof fetch

    try {
      const plan = await planAgentPrepare(TEST_DIR, {
        websiteUrl: 'https://playkit.sh/',
        docsUrl: 'https://docs.playkit.sh/docs',
        contextPaths: ['notes.md'],
      })
      await applyAgentPreparePlan(TEST_DIR, plan)

      expect(plan.generatedFiles).toContain(AGENT_SOURCES_PATH)
      expect(plan.generatedFiles).toContain(AGENT_DOCS_CONTEXT_PATH)
      expect(plan.contextInputs).toEqual([
        'https://playkit.sh/',
        'https://docs.playkit.sh/docs',
        'https://docs.playkit.sh/',
        'notes.md',
      ])

      const context = readFileSync(resolve(TEST_DIR, AGENT_CONTEXT_PATH), 'utf-8')
      const sources = JSON.parse(readFileSync(resolve(TEST_DIR, AGENT_SOURCES_PATH), 'utf-8')) as {
        sources: Array<{ label: string; selected: boolean; role: string }>
      }
      const docsContext = JSON.parse(readFileSync(resolve(TEST_DIR, AGENT_DOCS_CONTEXT_PATH), 'utf-8')) as {
        productName?: string
        workflowHints: string[]
        authHints: string[]
      }
      expect(context).toContain('## Additional Context')
      expect(context).toContain('https://playkit.sh/')
      expect(context).toContain('https://docs.playkit.sh/docs')
      expect(context).toContain('https://docs.playkit.sh/')
      expect(context).toContain('`notes.md`')
      expect(context).toContain('Knowledge tools work immediately. Clay API tools require Clay auth.')
      expect(context).toContain('PlayKit separates Clay knowledge tools from Clay API tools.')
      expect(context).toContain('## Structured Source Signals')
      expect(context).toContain('Workflow hints: Knowledge Search | Clay API Workflows')
      expect(context).toContain('Auth hints:')
      expect(sources.sources.some((source) => source.label === 'https://docs.playkit.sh/' && source.selected && source.role === 'inferred-root')).toBe(true)
      expect(docsContext.productName).toBe('PlayKit')
      expect(docsContext.workflowHints).toContain('Knowledge Search')
      expect(docsContext.authHints.some((hint) => hint.includes('Clay auth'))).toBe(true)

      const promptPlan = await planAgentPrompt(TEST_DIR, 'taxonomy')
      await applyAgentPromptPlan(TEST_DIR, promptPlan)
      const prompt = readFileSync(resolve(TEST_DIR, '.pluxx/agent/taxonomy-prompt.md'), 'utf-8')
      expect(prompt).toContain(AGENT_SOURCES_PATH)
      expect(prompt).toContain(AGENT_DOCS_CONTEXT_PATH)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('discovers a docs root from a website URL when no explicit docs URL is provided', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input) => {
      const request = new Request(input)
      if (request.url === 'https://docs.playkit.sh/') {
        return new Response(
          '<!doctype html><html><head><title>PlayKit Docs</title><meta name="description" content="Clay expertise in every AI conversation."></head><body><h1>PlayKit Docs</h1><h2>Knowledge Search</h2><p>Connect Clay before using API tools.</p></body></html>',
          {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          },
        )
      }

      return new Response(
        '<!doctype html><html><head><title>PlayKit</title><meta name="description" content="Clay expertise in every AI conversation."></head><body><h1>PlayKit</h1><p>Clay expertise in every AI conversation.</p></body></html>',
        {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        },
      )
    }) as typeof fetch

    try {
      const plan = await planAgentPrepare(TEST_DIR, {
        websiteUrl: 'https://playkit.sh/',
      })
      await applyAgentPreparePlan(TEST_DIR, plan)

      expect(plan.contextInputs).toEqual([
        'https://playkit.sh/',
        'https://docs.playkit.sh/',
      ])

      const sources = JSON.parse(readFileSync(resolve(TEST_DIR, AGENT_SOURCES_PATH), 'utf-8')) as {
        sources: Array<{ label: string; selected: boolean; role: string }>
      }
      expect(sources.sources.some((source) => source.label === 'https://docs.playkit.sh/' && source.selected && source.role === 'discovered-root')).toBe(true)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('uses Firecrawl-backed ingestion when configured and records provider provenance', async () => {
    const originalFetch = globalThis.fetch
    const originalFirecrawlKey = process.env.FIRECRAWL_API_KEY
    process.env.FIRECRAWL_API_KEY = 'fc-test-key'

    globalThis.fetch = (async (input, init) => {
      const request = new Request(input, init)
      if (request.url !== 'https://api.firecrawl.dev/v2/scrape') {
        throw new Error(`Unexpected fetch to ${request.url}`)
      }

      const body = await request.json() as { url: string; formats: string[]; onlyMainContent: boolean }
      const title = body.url.includes('docs') ? 'PlayKit Docs' : 'PlayKit'
      return Response.json({
        success: true,
        data: {
          markdown: `# ${title}\n\n## Knowledge Search\n\n## Clay API Workflows\n\nClay auth required for API workflows.`,
          metadata: {
            title,
            description: 'Clay expertise in every AI conversation.',
            sourceURL: body.url,
            url: body.url,
            statusCode: 200,
            contentType: 'text/markdown',
          },
        },
      })
    }) as typeof fetch

    try {
      const plan = await planAgentPrepare(TEST_DIR, {
        websiteUrl: 'https://playkit.sh/',
        docsUrl: 'https://docs.playkit.sh/docs',
        ingestProvider: 'auto',
      })
      await applyAgentPreparePlan(TEST_DIR, plan)

      const context = readFileSync(resolve(TEST_DIR, AGENT_CONTEXT_PATH), 'utf-8')
      const sources = JSON.parse(readFileSync(resolve(TEST_DIR, AGENT_SOURCES_PATH), 'utf-8')) as {
        version: number
        ingestion?: {
          requestedProvider: string
          resolvedProvider: string
          fallbackToLocalOnError: boolean
        }
        sources: Array<{ label: string; provider?: string }>
      }
      const docsContext = JSON.parse(readFileSync(resolve(TEST_DIR, AGENT_DOCS_CONTEXT_PATH), 'utf-8')) as {
        version: number
        providers: string[]
      }

      expect(sources.version).toBe(2)
      expect(sources.ingestion).toEqual({
        requestedProvider: 'auto',
        resolvedProvider: 'firecrawl',
        fallbackToLocalOnError: true,
      })
      expect(sources.sources.filter((source) => source.label.startsWith('https://')).every((source) => source.provider === 'firecrawl')).toBe(true)
      expect(docsContext.version).toBe(2)
      expect(docsContext.providers).toEqual(['firecrawl'])
      expect(context).toContain('Ingestion provider: auto -> firecrawl')
      expect(context).toContain('Providers observed: firecrawl')
      expect(context).toContain('- Provider: firecrawl')
    } finally {
      globalThis.fetch = originalFetch
      if (originalFirecrawlKey === undefined) {
        delete process.env.FIRECRAWL_API_KEY
      } else {
        process.env.FIRECRAWL_API_KEY = originalFirecrawlKey
      }
    }
  })

  it('falls back to local ingestion when auto-selected Firecrawl fails', async () => {
    const originalFetch = globalThis.fetch
    const originalFirecrawlKey = process.env.FIRECRAWL_API_KEY
    process.env.FIRECRAWL_API_KEY = 'fc-test-key'

    globalThis.fetch = (async (input, init) => {
      const request = new Request(input, init)
      if (request.url === 'https://api.firecrawl.dev/v2/scrape') {
        return new Response(JSON.stringify({ success: false, error: 'upstream unavailable' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (request.url === 'https://docs.playkit.sh/') {
        return new Response(
          '<!doctype html><html><head><title>PlayKit Docs</title><meta name="description" content="Clay expertise in every AI conversation."></head><body><h1>PlayKit Docs</h1><h2>Knowledge Search</h2><p>Connect Clay before using API tools.</p></body></html>',
          {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          },
        )
      }

      return new Response(
        '<!doctype html><html><head><title>PlayKit</title><meta name="description" content="Clay expertise in every AI conversation."></head><body><h1>PlayKit</h1><p>Clay expertise in every AI conversation.</p></body></html>',
        {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        },
      )
    }) as typeof fetch

    try {
      const plan = await planAgentPrepare(TEST_DIR, {
        websiteUrl: 'https://playkit.sh/',
        ingestProvider: 'auto',
      })
      await applyAgentPreparePlan(TEST_DIR, plan)

      const context = readFileSync(resolve(TEST_DIR, AGENT_CONTEXT_PATH), 'utf-8')
      const sources = JSON.parse(readFileSync(resolve(TEST_DIR, AGENT_SOURCES_PATH), 'utf-8')) as {
        ingestion?: {
          requestedProvider: string
          resolvedProvider: string
          fallbackToLocalOnError: boolean
        }
        sources: Array<{ label: string; provider?: string; note?: string }>
      }
      expect(sources.ingestion).toEqual({
        requestedProvider: 'auto',
        resolvedProvider: 'firecrawl',
        fallbackToLocalOnError: true,
      })
      expect(sources.sources.every((source) => !source.label.startsWith('https://') || source.provider === 'local')).toBe(true)
      expect(sources.sources.some((source) => source.note?.includes('fell back to local fetch'))).toBe(true)
      expect(context).toContain('Provider: local')
      expect(context).toContain('fell back to local fetch')
      expect(context).toContain('Ingestion provider: auto -> firecrawl')
    } finally {
      globalThis.fetch = originalFetch
      if (originalFirecrawlKey === undefined) {
        delete process.env.FIRECRAWL_API_KEY
      } else {
        process.env.FIRECRAWL_API_KEY = originalFirecrawlKey
      }
    }
  })

  it('fails fast when firecrawl is explicitly requested without a key', async () => {
    const originalFirecrawlKey = process.env.FIRECRAWL_API_KEY
    delete process.env.FIRECRAWL_API_KEY

    try {
      await expect(planAgentPrepare(TEST_DIR, {
        websiteUrl: 'https://playkit.sh/',
        ingestProvider: 'firecrawl',
      })).rejects.toThrow('Firecrawl ingestion requires FIRECRAWL_API_KEY')
    } finally {
      if (originalFirecrawlKey !== undefined) {
        process.env.FIRECRAWL_API_KEY = originalFirecrawlKey
      }
    }
  })

  it('applies project-level agent overrides to context collection and prompt generation', async () => {
    writeFileSync(
      resolve(TEST_DIR, AGENT_OVERRIDES_PATH),
      [
        '# Pluxx Agent Overrides',
        '',
        '## Context Paths',
        '- notes.md',
        '',
        '## Product Hints',
        'PlayKit has a split between knowledge tools and Clay API tools.',
        '',
        '## Setup/Auth Notes',
        'Knowledge tools work immediately. Clay API tools require Clay auth.',
        '',
        '## Grouping Hints',
        '- setup-and-auth: clay_connect, clay_status',
        '- clay-knowledge: ask_clay',
        '',
        '## Taxonomy Guidance',
        'Prefer product-shaped skills over raw tool buckets.',
        '',
        '## Instructions Guidance',
        'Make the Clay auth boundary explicit in the shared instructions.',
        '',
        '## Review Criteria',
        'Flag any skill grouping that mixes setup/admin tools with runtime workflows.',
        '',
      ].join('\n'),
    )
    writeFileSync(resolve(TEST_DIR, 'notes.md'), '# Notes\n\nTreat usage and pricing as account/admin surfaces.')

    const preparePlan = await planAgentPrepare(TEST_DIR)
    await applyAgentPreparePlan(TEST_DIR, preparePlan)

    expect(preparePlan.contextInputs).toContain('notes.md')
    expect(preparePlan.protectedFiles).toContain(AGENT_OVERRIDES_PATH)

    const context = readFileSync(resolve(TEST_DIR, AGENT_CONTEXT_PATH), 'utf-8')
    expect(context).toContain('## Project Overrides')
    expect(context).toContain('PlayKit has a split between knowledge tools and Clay API tools.')
    expect(context).toContain('Knowledge tools work immediately. Clay API tools require Clay auth.')
    expect(context).toContain('setup-and-auth: clay_connect, clay_status')
    expect(context).toContain('Treat usage and pricing as account/admin surfaces.')

    const taxonomyPlan = await planAgentPrompt(TEST_DIR, 'taxonomy')
    await applyAgentPromptPlan(TEST_DIR, taxonomyPlan)
    const instructionsPlan = await planAgentPrompt(TEST_DIR, 'instructions')
    await applyAgentPromptPlan(TEST_DIR, instructionsPlan)
    const reviewPlan = await planAgentPrompt(TEST_DIR, 'review')
    await applyAgentPromptPlan(TEST_DIR, reviewPlan)

    const taxonomyPrompt = readFileSync(resolve(TEST_DIR, '.pluxx/agent/taxonomy-prompt.md'), 'utf-8')
    const instructionsPrompt = readFileSync(resolve(TEST_DIR, '.pluxx/agent/instructions-prompt.md'), 'utf-8')
    const reviewPrompt = readFileSync(resolve(TEST_DIR, '.pluxx/agent/review-prompt.md'), 'utf-8')

    expect(taxonomyPrompt).toContain('Project overrides:')
    expect(taxonomyPrompt).toContain('Grouping hints:')
    expect(taxonomyPrompt).toContain('Prefer product-shaped skills over raw tool buckets.')
    expect(taxonomyPrompt).toContain('Treat `.pluxx/taxonomy.json` as the semantic source of truth for skill grouping and naming.')
    expect(instructionsPrompt).toContain('Instructions guidance:')
    expect(instructionsPrompt).toContain('Make the Clay auth boundary explicit in the shared instructions.')
    expect(instructionsPrompt).toContain('short routing guidance, not a raw documentation dump')
    expect(instructionsPrompt).toContain('Prefer the branded product name in user-facing copy')
    expect(instructionsPrompt).toContain('wording is branded and product-facing, not raw MCP-internal naming')
    expect(instructionsPrompt).toContain('reads like routing guidance, not pasted vendor docs')
    expect(instructionsPrompt).toContain('Replace stale scaffold claims with current discovery-backed language')
    expect(instructionsPrompt).toContain('copy-paste runnable')
    expect(instructionsPrompt).toContain('strong command UX')
    expect(reviewPrompt).toContain('Additional review criteria:')
    expect(reviewPrompt).toContain('Flag any skill grouping that mixes setup/admin tools with runtime workflows.')
  })

  it('supports prepare + review prompt generation for manual Pluxx projects without MCP metadata', async () => {
    const preparePlan = await planAgentPrepare(MANUAL_DIR)
    await applyAgentPreparePlan(MANUAL_DIR, preparePlan)

    expect(preparePlan.pluginName).toBe('manual-review')
    expect(preparePlan.toolCount).toBe(0)
    expect(preparePlan.skillCount).toBe(1)
    expect(preparePlan.editableFiles).toContain('INSTRUCTIONS.md')
    expect(preparePlan.editableFiles).toContain('skills/manual-review/SKILL.md')
    expect(preparePlan.editableFiles).toContain('commands/review.md')
    expect(preparePlan.editableFiles).not.toContain('.pluxx/taxonomy.json')
    expect(preparePlan.files.find((file) => file.relativePath === AGENT_PLAN_PATH)?.content).toContain('"path": "commands/review.md"')
    expect(preparePlan.files.find((file) => file.relativePath === AGENT_PLAN_PATH)?.content).not.toContain('"managedSections"')

    const context = readFileSync(resolve(MANUAL_DIR, AGENT_CONTEXT_PATH), 'utf-8')
    expect(context).toContain('## Source Project')
    expect(context).toContain('manual Pluxx project (no .pluxx/mcp.json)')
    expect(context).toContain('Keep the configured compiler buckets coherent')
    expect(context).toContain('`commands/review.md`')
    expect(context).toContain('review mode only in Agent Mode')

    const reviewPlan = await planAgentPrompt(MANUAL_DIR, 'review')
    await applyAgentPromptPlan(MANUAL_DIR, reviewPlan)

    const reviewPrompt = readFileSync(resolve(MANUAL_DIR, '.pluxx/agent/review-prompt.md'), 'utf-8')
    expect(reviewPrompt).toContain('weak marketplace/listing copy')
    expect(reviewPrompt).toContain('`commands/review.md`')
    expect(reviewPrompt).not.toContain('`.pluxx/taxonomy.json`')
  })

  it('supports CLI dry-run review runs for manual Pluxx projects', async () => {
    const proc = Bun.spawn(
      ['bun', resolve(ROOT, 'bin/pluxx.js'), 'agent', 'run', 'review', '--runner', 'codex', '--json', '--dry-run'],
      {
        cwd: MANUAL_DIR,
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).toBe(0)
    expect(stderr).toBe('')

    const summary = JSON.parse(stdout) as {
      kind: string
      runner: string
      verify: boolean
      promptPath: string
      dryRun: boolean
      command: string[]
    }

    expect(summary.kind).toBe('review')
    expect(summary.runner).toBe('codex')
    expect(summary.verify).toBe(false)
    expect(summary.promptPath).toBe('.pluxx/agent/review-prompt.md')
    expect(summary.dryRun).toBe(true)
    expect(summary.command).toContain('exec')
  })
})
