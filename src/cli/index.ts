#!/usr/bin/env bun

import { loadConfig } from '../config/load'
import { build } from '../generators'
import { doctorProject, printDoctorReport } from './doctor'
import { ensureHookTrust, installPlugin, listHookCommands, planInstallPlugin, uninstallPlugin } from './install'
import { runDev } from './dev'
import {
  applyMcpScaffoldPlan,
  buildToolExampleRequest,
  derivePluginName,
  MCP_HOOK_MODES,
  MCP_SKILL_GROUPINGS,
  planMcpScaffold,
  type McpHookMode,
  parseMcpSourceInput,
  type McpSkillGrouping,
  writeMcpScaffold,
} from './init-from-mcp'
import { migrate } from './migrate'
import { lintProject, printLintResult, runLint } from './lint'
import { introspectMcpServer, McpIntrospectionError } from '../mcp/introspect'
import { promptText, promptYesNo, PromptCancelledError } from './prompt'
import * as clack from '@clack/prompts'
import type { TargetPlatform } from '../schema'
import { basename } from 'path'
import { mkdir } from 'fs/promises'
import { formatSyncSummary, planSyncFromMcp, syncFromMcp } from './sync-from-mcp'
import { createCliRuntime, createSpinner, printJson, readMultiValueOption, readOption } from './runtime'
import { printTestResult, runTestSuite } from './test'

const args = process.argv.slice(2)
const command = args[0]
const runtime = createCliRuntime(args)
const DEFAULT_INIT_TARGETS = ['claude-code', 'cursor', 'codex', 'opencode'] as const satisfies readonly TargetPlatform[]
const ALL_TARGET_PLATFORMS = [
  'claude-code',
  'cursor',
  'codex',
  'opencode',
  'github-copilot',
  'openhands',
  'warp',
  'gemini-cli',
  'roo-code',
  'cline',
  'amp',
] as const satisfies readonly TargetPlatform[]

export interface InitFromMcpOptions {
  source?: string
  assumeDefaults: boolean
  name?: string
  author?: string
  displayName?: string
  targets?: string
  authEnv?: string
  grouping?: string
  hooks?: string
  transport?: string
  jsonOutput: boolean
}

interface InitFromMcpSummary {
  pluginName: string
  displayName: string
  source: string
  toolCount: number
  targets: TargetPlatform[]
  grouping: McpSkillGrouping
  requestedHookMode: McpHookMode
  hookMode: McpHookMode
  hookEvents: string[]
  files: string[]
  createdFiles: string[]
  updatedFiles: string[]
  lint: {
    errors: number
    warnings: number
  }
  notes: string[]
  nextSteps: string[]
  dryRun?: boolean
}

export async function main() {
  switch (command) {
    case 'build':
      await runBuild()
      break
    case 'dev':
      await runDev(args.slice(1))
      break
    case 'validate':
      await runValidate()
      break
    case 'lint':
      await runLintCommand()
      break
    case 'doctor':
      await runDoctor()
      break
    case 'init':
      await runInit()
      break
    case 'install':
      await runInstall()
      break
    case 'uninstall':
      await runUninstall()
      break
    case 'sync':
      await runSync()
      break
    case 'migrate':
      await runMigrate()
      break
    case 'test':
      await runTestCommand()
      break
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      printHelp()
      break
    default:
      console.error(`Unknown command: ${command}`)
      printHelp()
      process.exit(1)
  }
}

async function runBuild() {
  const targets = parseTargetFlagValues(args)
  const config = await loadConfig()
  const platforms = targets ?? config.targets

  if (runtime.dryRun) {
    const summary = {
      dryRun: true,
      targets: platforms,
      outDir: config.outDir,
      outputPaths: platforms.map((platform) => `${config.outDir}/${platform}/`),
    }
    if (runtime.jsonOutput) {
      printJson(summary)
    } else if (!runtime.quiet) {
      console.log(`Dry run: would build ${platforms.join(', ')}`)
      summary.outputPaths.forEach((path) => console.log(`  ${path}`))
    }
    return
  }

  if (!runtime.jsonOutput && !runtime.quiet) {
    console.log(`Building for: ${platforms.join(', ')}`)
  }

  await build(config, process.cwd(), { targets })

  if (runtime.jsonOutput) {
    printJson({
      ok: true,
      targets: platforms,
      outDir: config.outDir,
      outputPaths: platforms.map((platform) => `${config.outDir}/${platform}/`),
    })
    return
  }

  if (!runtime.quiet) {
    console.log(`Done! Output in ${config.outDir}/`)
    for (const platform of platforms) {
      console.log(`  ${config.outDir}/${platform}/`)
    }
  }
}

async function runValidate() {
  try {
    const config = await loadConfig()
    console.log(`Config valid: ${config.name}@${config.version}`)
    console.log(`  Targets: ${config.targets.join(', ')}`)
    console.log(`  Skills: ${config.skills}`)
    if (config.mcp) {
      console.log(`  MCP servers: ${Object.keys(config.mcp).join(', ')}`)
    }
    if (config.hooks) {
      const events = Object.keys(config.hooks).filter(k => config.hooks![k as keyof typeof config.hooks])
      console.log(`  Hook events: ${events.join(', ')}`)
    }
  } catch (err) {
    console.error('Validation failed:')
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

async function runLintCommand() {
  if (runtime.jsonOutput) {
    const result = await lintProject(process.cwd())
    printJson(result)
    if (result.errors > 0) {
      process.exit(1)
    }
    return
  }

  if (runtime.quiet) {
    const result = await lintProject(process.cwd())
    if (result.errors > 0 || result.warnings > 0) {
      printLintResult(result, process.cwd())
    }
    if (result.errors > 0) {
      process.exit(1)
    }
    return
  }

  const exitCode = await runLint(process.cwd())
  if (exitCode !== 0) {
    process.exit(exitCode)
  }
}

async function resolveTextOption(options: {
  label: string
  defaultValue?: string
  providedValue?: string
  assumeDefaults?: boolean
}): Promise<string> {
  if (options.providedValue !== undefined) {
    return options.providedValue
  }

  if (options.assumeDefaults) {
    return options.defaultValue ?? ''
  }

  return await promptText(options.label, options.defaultValue)
}

async function resolveChoiceOption<T extends string>(options: {
  label: string
  values: readonly T[]
  defaultValue: T
  providedValue?: string
  assumeDefaults?: boolean
}): Promise<T> {
  const raw = await resolveTextOption({
    label: `${options.label} (${options.values.join('/')})`,
    defaultValue: options.defaultValue,
    providedValue: options.providedValue,
    assumeDefaults: options.assumeDefaults,
  })
  return parseChoiceOption(raw, options.values, options.label)
}

function parseChoiceOption<T extends string>(value: string, validValues: readonly T[], label: string): T {
  const normalized = value.trim().toLowerCase()
  const match = validValues.find((entry) => entry.toLowerCase() === normalized)
  if (!match) {
    throw new Error(`${label} must be one of: ${validValues.join(', ')}`)
  }
  return match
}

function parseTargetPlatforms(raw: string): TargetPlatform[] {
  const targets = raw
    .split(',')
    .map((target) => target.trim())
    .filter(Boolean)

  if (targets.length === 0) {
    throw new Error('Provide at least one target platform.')
  }

  const invalid = targets.filter((target) => !(ALL_TARGET_PLATFORMS as readonly string[]).includes(target))
  if (invalid.length > 0) {
    throw new Error(
      `Unknown target platform(s): ${invalid.join(', ')}. Supported: ${ALL_TARGET_PLATFORMS.join(', ')}`,
    )
  }

  return targets as TargetPlatform[]
}

function parseTargetFlagValues(rawArgs: string[]): TargetPlatform[] | undefined {
  const values = readMultiValueOption(rawArgs, '--target')
  if (!values) return undefined
  return parseTargetPlatforms(values.join(','))
}

function defaultHookMode(source: { auth?: { type: string; envVar?: string }; transport?: string; env?: Record<string, string> }): McpHookMode {
  if (source.auth?.type && source.auth.type !== 'none' && source.auth.envVar) {
    return 'safe'
  }

  if (source.transport === 'stdio' && source.env && Object.keys(source.env).length > 0) {
    return 'safe'
  }

  return 'none'
}

function applyGeneratedAuthEnv(source: ReturnType<typeof parseMcpSourceInput>, envVar?: string) {
  if (!envVar) return source

  if (source.transport === 'stdio') {
    return {
      ...source,
      env: {
        ...(source.env ?? {}),
        [envVar]: `\${${envVar}}`,
      },
    }
  }

  if (!source.auth) {
    return {
      ...source,
      auth: {
        type: 'bearer' as const,
        envVar,
        headerName: 'Authorization',
        headerTemplate: 'Bearer ${value}',
      },
    }
  }

  return source
}

function buildInitSummary(input: {
  pluginName: string
  displayName: string
  source: string
  toolCount: number
  targets: TargetPlatform[]
  grouping: McpSkillGrouping
  requestedHookMode: McpHookMode
  hookMode: McpHookMode
  hookEvents: string[]
  files: string[]
  createdFiles: string[]
  updatedFiles: string[]
  lint: { errors: number; warnings: number }
  dryRun?: boolean
}): InitFromMcpSummary {
  const installTarget = input.targets[0]
  const installCommand = input.hookMode === 'safe'
    ? `Run: pluxx install --trust --target ${installTarget}`
    : `Run: pluxx install --target ${installTarget}`
  const notes: string[] = []

  if (input.requestedHookMode === 'safe' && input.hookMode === 'none') {
    notes.push('No safe hooks were generated for this MCP source. Safe hooks currently require explicit env vars in the generated MCP config.')
  } else if (input.hookMode === 'safe') {
    notes.push(`Generated install-ready hook events: ${input.hookEvents.join(', ')}`)
  }

  const nextSteps = [
    'Review INSTRUCTIONS.md and the generated skills before publishing.',
    'Run: pluxx build',
    installCommand,
  ]

  return {
    pluginName: input.pluginName,
    displayName: input.displayName,
    source: input.source,
    toolCount: input.toolCount,
    targets: input.targets,
    grouping: input.grouping,
    requestedHookMode: input.requestedHookMode,
    hookMode: input.hookMode,
    hookEvents: input.hookEvents,
    files: input.files,
    createdFiles: input.createdFiles,
    updatedFiles: input.updatedFiles,
    lint: input.lint,
    notes,
    nextSteps,
    dryRun: input.dryRun,
  }
}

export function parseInitFromMcpOptions(rawArgs: string[], initialName?: string, initialSource?: string): InitFromMcpOptions {
  return {
    source: initialSource ?? readOption(rawArgs, '--from-mcp'),
    assumeDefaults: rawArgs.includes('--yes'),
    name: readOption(rawArgs, '--name') ?? initialName,
    author: readOption(rawArgs, '--author'),
    displayName: readOption(rawArgs, '--display-name'),
    targets: readOption(rawArgs, '--targets'),
    authEnv: readOption(rawArgs, '--auth-env'),
    grouping: readOption(rawArgs, '--grouping'),
    hooks: readOption(rawArgs, '--hooks'),
    transport: readOption(rawArgs, '--transport'),
    jsonOutput: rawArgs.includes('--json'),
  }
}

function toKebabCase(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toTsString(value: string): string {
  return JSON.stringify(value)
}

async function runInit() {
  const positionalName = args[1] && !args[1].startsWith('-') ? args[1] : undefined
  const fromMcpFlag = args.indexOf('--from-mcp')
  const fromMcpInput = fromMcpFlag !== -1 && args[fromMcpFlag + 1] && !args[fromMcpFlag + 1].startsWith('-')
    ? args[fromMcpFlag + 1]
    : undefined

  if (fromMcpFlag !== -1) {
    await runInitFromMcp(positionalName, fromMcpInput)
    return
  }

  if (!runtime.isInteractive) {
    throw new Error('pluxx init requires an interactive terminal unless you use `pluxx init --from-mcp ... --yes`.')
  }

  const dirName = positionalName
    ? toKebabCase(positionalName)
    : basename(process.cwd()).toLowerCase().replace(/[^a-z0-9-]/g, '-')

  console.log('')
  console.log('  pluxx init — Create a new plugin')
  console.log('  ─────────────────────────────────')
  console.log('')

  try {
    // 1. Plugin identity
    const name = await promptText('Plugin name', dirName)
    const description = await promptText('Description')
    const authorName = await promptText('Author name')

    // 2. MCP server
    const hasMcp = await promptYesNo('Does your plugin connect to an MCP server?')
    let mcpUrl = ''
    let mcpEnvVar = ''
    if (hasMcp) {
      mcpUrl = await promptText('MCP server URL')
      mcpEnvVar = await promptText('Auth env var name (e.g. MY_API_KEY)')
    }

    // 3. Platforms
    const defaultTargets = 'claude-code,cursor,codex,opencode'
    const targetsRaw = await promptText('Which platforms? (comma-separated)', defaultTargets)
    const targets = targetsRaw.split(',').map(t => t.trim()).filter(Boolean)

    // 4. Brand metadata
    const hasBrand = await promptYesNo('Add brand metadata?')
    let displayName = ''
    let brandColor = ''
    if (hasBrand) {
      displayName = await promptText('Display name')
      brandColor = await promptText('Brand color (hex)', '#000000')
    }

    const pluginName = toKebabCase(name) || dirName
    const skillName = pluginName

    if (pluginName !== name) {
      console.log(`  Normalized plugin name to ${pluginName}`)
      console.log('')
    }

    // Build the config file content
    const targetsList = targets.map(toTsString).join(', ')
    let mcpBlock = ''
    if (hasMcp && mcpUrl) {
      const serverName = pluginName
      mcpBlock = `
  // MCP servers your plugin connects to
  mcp: {
    ${toTsString(serverName)}: {
      url: ${toTsString(mcpUrl)},${mcpEnvVar ? `
      auth: {
        type: 'bearer',
        envVar: ${toTsString(mcpEnvVar)},
      },` : ''}
    },
  },
`
    }

    let brandBlock = ''
    if (hasBrand && displayName) {
      brandBlock = `
  // Brand metadata
  brand: {
    displayName: ${toTsString(displayName)},${brandColor ? `
    color: ${toTsString(brandColor)},` : ''}
  },
`
    }

    const template = `import { definePlugin } from 'pluxx'

export default definePlugin({
  name: ${toTsString(pluginName)},
  version: '0.1.0',
  description: ${toTsString(description)},
  author: {
    name: ${toTsString(authorName)},
  },
  license: 'MIT',

  // Skills directory (SKILL.md files following Agent Skills standard)
  skills: './skills/',
${mcpBlock}${brandBlock}
  // Target platforms to generate
  targets: [${targetsList}],
})
`

    // Write config
    await Bun.write('pluxx.config.ts', template)

    // Create skills directory with a starter SKILL.md
    const skillDir = `skills/${skillName}`
    await mkdir(skillDir, { recursive: true })

    const skillContent = `---
name: ${JSON.stringify(skillName)}
description: ${JSON.stringify(description || `A starter skill for ${skillName}`)}
version: 0.1.0
---

# ${displayName || pluginName}

${description || `TODO: Describe what ${displayName || pluginName} does.`}

## Usage

Describe how agents should use this skill.

## Examples

\`\`\`
Example prompt or command here
\`\`\`
`

    await Bun.write(`${skillDir}/SKILL.md`, skillContent)

    console.log('')
    console.log('  Created:')
    console.log('    pluxx.config.ts')
    console.log(`    ${skillDir}/SKILL.md`)
    console.log('')
    console.log('  Next steps:')
    console.log(`    1. Edit ${skillDir}/SKILL.md with your skill instructions`)
    console.log('    2. Run: pluxx build')
    console.log('    3. Run: pluxx install')
    console.log('')
  } catch (error) {
    if (error instanceof PromptCancelledError) {
      console.log('Init cancelled')
      return
    }

    throw error instanceof Error ? error : new Error(String(error))
  }
}

async function runInitFromMcp(initialName?: string, initialSource?: string) {
  const options = parseInitFromMcpOptions(args, initialName, initialSource)
  const defaultTargets = DEFAULT_INIT_TARGETS.join(',')
  const interactive = !options.jsonOutput && !options.assumeDefaults && runtime.isInteractive

  if (!options.jsonOutput && !runtime.quiet) {
    clack.intro('pluxx init --from-mcp')
  }

  try {
    // ── Step 1/4 · Connecting to MCP server ──────────────────────────

    const rawSource = options.source ?? (interactive
      ? await clackText('MCP server URL or local command')
      : '')
    if (!rawSource) {
      throw new Error('Provide an MCP server URL or local command. Example: pluxx init --from-mcp https://example.com/mcp')
    }

    let source = parseMcpSourceInput(rawSource, options.transport)

    const s = createSpinner(runtime)
    s?.start('Step 1/4 \u00b7 Connecting to MCP server...')

    let introspection
    try {
      introspection = await introspectMcpServer(source)
    } catch (error) {
      if (
        error instanceof McpIntrospectionError
        && source.transport !== 'stdio'
        && (error.status === 401 || error.status === 403)
      ) {
        s?.stop('Server requires authentication')
        const envVar = options.authEnv ?? (interactive
          ? await clackText('Bearer auth env var for this MCP server')
          : '')
        if (!envVar) {
          throw new Error(
            'This MCP server requires auth. Re-run init with --auth-env YOUR_ENV_VAR or provide an auth env var name interactively.',
          )
        }

        source = {
          ...source,
          auth: {
            type: 'bearer',
            envVar,
            headerName: 'Authorization',
            headerTemplate: 'Bearer ${value}',
          },
        }
        s?.start('Step 1/4 \u00b7 Reconnecting with auth...')
        introspection = await introspectMcpServer(source)
      } else {
        s?.stop('Connection failed')
        throw error
      }
    }

    const serverLabel = introspection.serverInfo.title ?? introspection.serverInfo.name
    s?.stop(`Connected: ${serverLabel} (${introspection.tools.length} tools discovered)`)

    // Only ask for stdio auth env when the source has no env vars and no auth already
    const stdioHasEnv = source.transport === 'stdio'
      && source.env
      && Object.keys(source.env).length > 0
    const stdioNeedsAuthPrompt = source.transport === 'stdio'
      && !stdioHasEnv
      && !source.auth
      && !options.authEnv

    const generatedAuthEnv = stdioNeedsAuthPrompt && interactive
      ? await clackText('Auth env var for generated plugin (optional)', '')
      : source.transport === 'stdio'
        ? (options.authEnv ?? undefined)
        : options.authEnv

    source = applyGeneratedAuthEnv(source, generatedAuthEnv)

    // ── Step 2/4 · Plugin identity ───────────────────────────────────

    if (!options.jsonOutput && !runtime.quiet) {
      clack.log.step('Step 2/4 \u00b7 Plugin identity')
    }

    const defaultPluginName = options.name ? toKebabCase(options.name) : derivePluginName(introspection, source)
    const pluginName = toKebabCase(
      options.name ?? (interactive
        ? await clackText('Plugin name', defaultPluginName)
        : defaultPluginName),
    )
    const defaultDisplayName = options.displayName ?? introspection.serverInfo.title ?? pluginName
    const displayName = options.displayName ?? (interactive
      ? await clackText('Display name', defaultDisplayName)
      : defaultDisplayName)
    const defaultAuthor = process.env.USER ?? ''
    const authorName = options.author ?? (interactive
      ? await clackText('Author name', defaultAuthor)
      : defaultAuthor)

    // ── Step 3/4 · Build settings ────────────────────────────────────

    if (!options.jsonOutput && !runtime.quiet) {
      clack.log.step('Step 3/4 \u00b7 Build settings')
    }

    const defaultTargetsValue = options.targets ?? defaultTargets
    const targetsRaw = options.targets ?? (interactive
      ? await clackText('Platforms (comma-separated)', defaultTargetsValue)
      : defaultTargetsValue)
    const targets = parseTargetPlatforms(targetsRaw)

    const defaultGrouping: McpSkillGrouping = 'workflow'
    const grouping: McpSkillGrouping = options.grouping
      ? parseChoiceOption(options.grouping, MCP_SKILL_GROUPINGS, 'Skill grouping')
      : interactive
        ? await clackSelect<McpSkillGrouping>('Skill grouping', [
            { value: 'workflow', label: 'workflow', hint: 'Group related tools into workflow skills' },
            { value: 'tool', label: 'tool', hint: 'One skill per tool' },
          ], defaultGrouping)
        : defaultGrouping

    const defaultHookModeValue = defaultHookMode(source)
    const hookMode: McpHookMode = options.hooks
      ? parseChoiceOption(options.hooks, MCP_HOOK_MODES, 'Install-ready hooks')
      : interactive
        ? await clackSelect<McpHookMode>('Install-ready hooks', [
            { value: 'none', label: 'none', hint: 'No install hooks' },
            { value: 'safe', label: 'safe', hint: 'Auto-generate safe install hooks' },
          ], defaultHookModeValue)
        : defaultHookModeValue

    // ── Step 4/4 · Generating scaffold ───────────────────────────────

    const g = createSpinner(runtime)
    g?.start('Step 4/4 \u00b7 Generating scaffold...')
    const plan = await planMcpScaffold({
      rootDir: process.cwd(),
      pluginName,
      authorName,
      targets,
      source,
      introspection,
      displayName,
      skillGrouping: grouping,
      hookMode,
    })
    const createdFiles = plan.files
      .filter((file) => file.action === 'create')
      .map((file) => file.relativePath)
    const updatedFiles = plan.files
      .filter((file) => file.action === 'update')
      .map((file) => file.relativePath)

    if (!runtime.dryRun) {
      await applyMcpScaffoldPlan(process.cwd(), plan)
    }

    const lintResult = runtime.dryRun
      ? { errors: 0, warnings: 0, issues: [] }
      : await lintProject(process.cwd())
    const summary = buildInitSummary({
      pluginName,
      displayName,
      source: rawSource,
      toolCount: introspection.tools.length,
      targets,
      grouping,
      requestedHookMode: hookMode,
      hookMode: plan.generatedHookMode,
      hookEvents: plan.generatedHookEvents,
      files: plan.generatedFiles,
      createdFiles,
      updatedFiles,
      lint: {
        errors: lintResult.errors,
        warnings: lintResult.warnings,
      },
      dryRun: runtime.dryRun,
    })

    if (options.jsonOutput) {
      printJson(summary)
      return
    }

    g?.stop(`${runtime.dryRun ? 'Planned' : 'Created'} ${summary.files.length} files`)

    if (runtime.quiet) {
      return
    }

    if (summary.createdFiles.length > 0) {
      clack.log.info(`Create: ${summary.createdFiles.join(', ')}`)
    }
    if (summary.updatedFiles.length > 0) {
      clack.log.info(`Update: ${summary.updatedFiles.join(', ')}`)
    }

    if (!runtime.dryRun) {
      if (lintResult.errors > 0) {
        clack.log.error(`Lint: ${lintResult.errors} errors, ${lintResult.warnings} warnings`)
      } else if (lintResult.warnings > 0) {
        clack.log.warn(`Lint: ${lintResult.errors} errors, ${lintResult.warnings} warnings`)
      } else {
        clack.log.success('Lint: 0 errors, 0 warnings')
      }
    } else {
      clack.log.info('Dry run only: scaffold files were not written and lint was skipped.')
    }

    if (!runtime.dryRun && lintResult.issues.length > 0) {
      for (const issue of lintResult.issues) {
        const levelLabel = issue.level === 'error' ? 'ERROR' : 'WARN '
        const platformLabel = issue.platform ? `[${issue.platform}] ` : ''
        const loc = issue.file ? `${issue.file}: ` : ''
        const message = `${levelLabel} ${issue.code} ${platformLabel}${loc}${issue.message}`
        if (issue.level === 'error') {
          clack.log.error(message)
        } else {
          clack.log.warn(message)
        }
      }
    }

    if (summary.notes.length > 0) {
      for (const n of summary.notes) {
        clack.log.info(n)
      }
    }

    // Build a concrete test prompt from the first tool's example request
    const firstTool = introspection.tools[0]
    const testPrompt = firstTool ? buildToolExampleRequest(firstTool) : undefined
    const installTarget = targets[0]
    const installCommand = summary.hookMode === 'safe'
      ? `pluxx install --trust --target ${installTarget}`
      : `pluxx install --target ${installTarget}`

    const nextStepLines = [
      '1. Review INSTRUCTIONS.md and skills/',
      '2. pluxx build',
      `3. ${installCommand}`,
    ]
    if (testPrompt) {
      nextStepLines.push(`4. Test in ${installTarget}: "${testPrompt}"`)
    }
    nextStepLines.push('')
    nextStepLines.push(`To refresh later: pluxx sync --from-mcp`)

    clack.note(nextStepLines.join('\n'), 'Next steps')

    clack.outro(runtime.dryRun ? 'Dry run complete' : 'Scaffold complete')
  } catch (error) {
    if (error instanceof PromptCancelledError) {
      if (!options.jsonOutput && !runtime.quiet) {
        clack.cancel(error.message)
      }
      return
    }

    throw error instanceof Error ? error : new Error(String(error))
  }
}

/** Wrapper for clack.text that handles cancellation. */
async function clackText(message: string, defaultValue?: string): Promise<string> {
  const result = await clack.text({
    message,
    defaultValue,
    placeholder: defaultValue,
  })
  if (clack.isCancel(result)) {
    throw new PromptCancelledError()
  }
  return result
}

/** Wrapper for clack.select that handles cancellation. */
async function clackSelect<T extends string>(
  message: string,
  options: Array<{ value: T; label: string; hint?: string }>,
  initialValue: T,
): Promise<T> {
  const result = await clack.select({
    message,
    options: options as Array<{ value: string; label: string; hint?: string }>,
    initialValue: initialValue as string,
  })
  if (clack.isCancel(result)) {
    throw new PromptCancelledError()
  }
  return result as T
}

async function runSync() {
  const fromMcpFlag = args.indexOf('--from-mcp')
  const fromMcpInput = fromMcpFlag !== -1 && args[fromMcpFlag + 1] && !args[fromMcpFlag + 1].startsWith('-')
    ? args[fromMcpFlag + 1]
    : undefined
  const source = fromMcpInput ? parseMcpSourceInput(fromMcpInput) : undefined
  const result = runtime.dryRun
    ? await planSyncFromMcp({
        rootDir: process.cwd(),
        source,
      })
    : await syncFromMcp({
        rootDir: process.cwd(),
        source,
      })

  if (runtime.jsonOutput) {
    printJson({
      ...result,
      dryRun: runtime.dryRun,
    })
    return
  }

  if (runtime.quiet) {
    return
  }

  const lines = formatSyncSummary(result, process.cwd())
  if (runtime.dryRun) {
    console.log('Dry run: planned sync changes')
  }
  lines.forEach((line) => console.log(line))
}

async function runDoctor() {
  const report = await doctorProject(process.cwd())

  if (runtime.jsonOutput) {
    printJson(report)
  } else if (!runtime.quiet) {
    printDoctorReport(report)
  }

  if (!report.ok) {
    process.exit(1)
  }
}

async function runTestCommand() {
  const targets = parseTargetFlagValues(args)
  const result = await runTestSuite({
    rootDir: process.cwd(),
    targets,
  })

  if (runtime.jsonOutput) {
    printJson(result)
    return
  }

  if (!runtime.quiet) {
    printTestResult(result)
  }

  if (!result.ok) {
    process.exit(1)
  }
}

async function runInstall() {
  const trust = args.includes('--trust')
  const targets = parseTargetFlagValues(args)

  const config = await loadConfig()
  const distDir = `${process.cwd()}/${config.outDir}`
  const platforms = targets ?? config.targets

  if (runtime.dryRun) {
    const plan = planInstallPlugin(distDir, config.name, platforms)
    const hookCommands = listHookCommands(config.hooks)
    const summary = {
      dryRun: true,
      pluginName: config.name,
      platforms,
      trustRequired: hookCommands.length > 0,
      installTargets: plan.map((target) => ({
        platform: target.platform,
        sourceDir: target.sourceDir,
        pluginDir: target.description,
        built: target.built,
        existing: target.existing,
      })),
    }
    if (runtime.jsonOutput) {
      printJson(summary)
    } else if (!runtime.quiet) {
      console.log(`Dry run: would install ${config.name} for ${platforms.join(', ')}`)
      plan.forEach((target) => {
        console.log(`  ${target.platform} -> ${target.description}${target.built ? '' : ' (not built)'}`)
      })
      if (listHookCommands(config.hooks).length > 0) {
        console.log('  trust reminder: this plugin defines local hook commands; install requires review or --trust')
      }
    }
    return
  }

  if (!runtime.jsonOutput && !runtime.quiet) {
    console.log(`Installing ${config.name} plugin...`)
  }
  await ensureHookTrust({
    pluginName: config.name,
    hooks: config.hooks,
    trust,
    isTTY: runtime.isInteractive,
  })
  await installPlugin(distDir, config.name, platforms, { quiet: runtime.quiet })
}

async function runUninstall() {
  const targets = parseTargetFlagValues(args)

  const config = await loadConfig()

  if (!runtime.jsonOutput && !runtime.quiet) {
    console.log(`Uninstalling ${config.name} plugin...`)
  }
  await uninstallPlugin(config.name, targets, { quiet: runtime.quiet })
}

async function runMigrate() {
  const inputPath = args[1]
  if (!inputPath) {
    console.error('Usage: pluxx migrate <path>')
    console.error('')
    console.error('  Import an existing single-platform plugin into a pluxx.config.ts.')
    console.error('  Pass the path to a plugin directory containing .claude-plugin/,')
    console.error('  .cursor-plugin/, .codex-plugin/, or a package.json with @opencode-ai/plugin.')
    process.exit(1)
  }
  await migrate(inputPath)
}

function printHelp() {
  console.log(`
pluxx — Cross-platform AI agent plugin SDK

Usage:
  pluxx build [--target <platforms...>]   Generate platform-specific plugin files
  pluxx dev [--target <platforms...>]     Watch for changes and auto-rebuild
  pluxx validate                          Validate your config
  pluxx lint                              Lint skills and cross-platform metadata
  pluxx doctor                            Check runtime, config, paths, MCP, and trust advisories
  pluxx init [name] [--from-mcp <source>] Create a new pluxx.config.ts
  pluxx sync [--from-mcp <source>]        Refresh MCP-derived scaffold files
  pluxx migrate <path>                    Import an existing plugin into pluxx
  pluxx test [--target <platforms...>]    Run config, lint, build, and smoke checks
  pluxx install [--target <platforms>] [--trust]  Symlink built plugins for local testing
  pluxx uninstall [--target <platforms>]  Remove symlinked plugins
  pluxx help                              Show this help

Common flags:
  --json                                  Print machine-readable output
  --quiet                                 Suppress non-error chatter
  --dry-run                               Show planned work without writing files or installing anything

Targets:
  claude-code, cursor, codex, opencode, github-copilot, openhands,
  warp, gemini-cli, roo-code, cline, amp

Examples:
  pluxx build                             Build for all configured targets
  pluxx build --target claude-code cursor  Build for specific platforms
  pluxx init my-plugin                    Scaffold a new plugin config
  pluxx init --from-mcp https://example.com/mcp  Scaffold from a remote MCP server
  pluxx init --from-mcp "npx -y @acme/mcp"       Scaffold from a local MCP command
  pluxx init --from-mcp https://example.com/mcp --yes --name acme --display-name "Acme" --author "Acme" --targets claude-code,codex --grouping workflow --hooks safe --json
  pluxx init --from-mcp https://example.com/sse --transport sse   Scaffold from an SSE-transport MCP server
  pluxx init --from-mcp https://example.com/mcp --yes --dry-run   Preview scaffold files without writing
  pluxx sync                              Refresh a scaffold using .pluxx/mcp.json metadata
  pluxx sync --from-mcp https://example.com/mcp  Refresh using an explicit MCP source override
  pluxx doctor --json                     Inspect project health as JSON
  pluxx test --target claude-code codex  Verify selected target outputs
  pluxx install                           Install to all configured targets
  pluxx install --target claude-code      Install to Claude Code only
  pluxx install --dry-run                 Preview local install paths and trust implications
  pluxx install --trust                   Install without hook trust confirmation
`)
}

if (import.meta.main) {
  main().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
