#!/usr/bin/env bun

import { loadConfig } from '../config/load'
import { build } from '../generators'
import { ensureHookTrust, installPlugin, uninstallPlugin } from './install'
import { runDev } from './dev'
import { migrate } from './migrate'
import { runLint } from './lint'
import { promptText, promptYesNo, closePrompts } from './prompt'
import type { TargetPlatform } from '../schema'
import { basename } from 'path'
import { mkdir } from 'fs/promises'

const args = process.argv.slice(2)
const command = args[0]

async function main() {
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
    case 'init':
      await runInit()
      break
    case 'install':
      await runInstall()
      break
    case 'uninstall':
      await runUninstall()
      break
    case 'migrate':
      await runMigrate()
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
  const targetFlag = args.indexOf('--target')
  let targets: TargetPlatform[] | undefined

  if (targetFlag !== -1) {
    targets = args.slice(targetFlag + 1).filter(a => !a.startsWith('-')) as TargetPlatform[]
  }

  console.log('Loading config...')
  const config = await loadConfig()

  const platforms = targets ?? config.targets
  console.log(`Building for: ${platforms.join(', ')}`)

  await build(config, process.cwd(), { targets })

  console.log(`Done! Output in ${config.outDir}/`)
  for (const platform of platforms) {
    console.log(`  ${config.outDir}/${platform}/`)
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
  const exitCode = await runLint(process.cwd())
  if (exitCode !== 0) {
    process.exit(exitCode)
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
  const dirName = basename(process.cwd()).toLowerCase().replace(/[^a-z0-9-]/g, '-')

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

    closePrompts()

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
  } catch {
    closePrompts()
    throw new Error('Init cancelled')
  }
}

async function runInstall() {
  const targetFlag = args.indexOf('--target')
  const trust = args.includes('--trust')
  let targets: TargetPlatform[] | undefined

  if (targetFlag !== -1) {
    targets = args.slice(targetFlag + 1).filter(a => !a.startsWith('-')) as TargetPlatform[]
  }

  const config = await loadConfig()
  const distDir = `${process.cwd()}/${config.outDir}`
  const platforms = targets ?? config.targets

  console.log(`Installing ${config.name} plugin...`)
  await ensureHookTrust({
    pluginName: config.name,
    hooks: config.hooks,
    trust,
  })
  await installPlugin(distDir, config.name, platforms)
}

async function runUninstall() {
  const targetFlag = args.indexOf('--target')
  let targets: TargetPlatform[] | undefined

  if (targetFlag !== -1) {
    targets = args.slice(targetFlag + 1).filter(a => !a.startsWith('-')) as TargetPlatform[]
  }

  const config = await loadConfig()

  console.log(`Uninstalling ${config.name} plugin...`)
  await uninstallPlugin(config.name, targets)
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
  pluxx init [name]                       Create a new pluxx.config.ts
  pluxx migrate <path>                    Import an existing plugin into pluxx
  pluxx install [--target <platforms>] [--trust]  Symlink built plugins for local testing
  pluxx uninstall [--target <platforms>]  Remove symlinked plugins
  pluxx help                              Show this help

Targets:
  claude-code, cursor, codex, opencode, github-copilot, openhands,
  warp, gemini-cli, roo-code, cline, amp

Examples:
  pluxx build                             Build for all configured targets
  pluxx build --target claude-code cursor  Build for specific platforms
  pluxx init my-plugin                    Scaffold a new plugin config
  pluxx install                           Install to all configured targets
  pluxx install --target claude-code      Install to Claude Code only
  pluxx install --trust                   Install without hook trust confirmation
`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
