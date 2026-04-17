import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import {
  applyAgentPreparePlan,
  applyAgentPromptPlan,
  AGENT_CONTEXT_PATH,
  AGENT_OVERRIDES_PATH,
  AGENT_PLAN_PATH,
  planAgentPrepare,
  planAgentPrompt,
} from '../src/cli/agent'
import { writeMcpScaffold } from '../src/cli/init-from-mcp'
import type { IntrospectedMcpServer } from '../src/mcp/introspect'

const TEST_DIR = resolve(import.meta.dir, '.agent-mode')
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
      name: 'qualify-table',
      description: 'Qualify a Clay table before enrichment.',
      arguments: [
        {
          name: 'table_name',
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
})

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

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
    expect(context).toContain('## MCP Discovery Surfaces')
    expect(context).toContain('Resource `getting-started`')
    expect(context).toContain('Prompt `qualify-table`')
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
    expect(prompt).toContain('Reject stale scaffold assumptions')
    expect(prompt).toContain('avoid weak command UX')
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
    expect(prompt).toContain('weak command UX')
    expect(prompt).toContain('stale assumptions and command-UX weaknesses are identified explicitly when present')
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
    expect(summary.command.slice(0, 3)).toEqual(['codex', 'exec', '--full-auto'])
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

  it('captures website, docs, and local file context inputs in the generated context pack', async () => {
    writeFileSync(resolve(TEST_DIR, 'notes.md'), '# Notes\n\nPlayKit separates Clay knowledge tools from Clay API tools.')

    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input) => {
      const request = new Request(input)
      return new Response(
        `<!doctype html><html><head><title>${request.url.includes('docs') ? 'PlayKit Docs' : 'PlayKit'}</title><meta name="description" content="Clay expertise in every AI conversation."></head><body><h1>Clay expertise in every AI conversation</h1><p>Knowledge tools work immediately. Clay API tools require Clay auth.</p></body></html>`,
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

      expect(plan.contextInputs).toEqual([
        'https://playkit.sh/',
        'https://docs.playkit.sh/docs',
        'notes.md',
      ])

      const context = readFileSync(resolve(TEST_DIR, AGENT_CONTEXT_PATH), 'utf-8')
      expect(context).toContain('## Additional Context')
      expect(context).toContain('https://playkit.sh/')
      expect(context).toContain('https://docs.playkit.sh/docs')
      expect(context).toContain('`notes.md`')
      expect(context).toContain('Knowledge tools work immediately. Clay API tools require Clay auth.')
      expect(context).toContain('PlayKit separates Clay knowledge tools from Clay API tools.')
    } finally {
      globalThis.fetch = originalFetch
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
})
