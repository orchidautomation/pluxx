#!/usr/bin/env bun

import { loadConfig } from '../config/load'
import { build } from '../generators'
import { installPlugin, uninstallPlugin } from './install'
import { runDev } from './dev'
import { migrate } from './migrate'
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

    // Build the config file content
    const targetsList = targets.map(t => `'${t}'`).join(', ')
    let mcpBlock = ''
    if (hasMcp && mcpUrl) {
      const serverName = name.replace(/[^a-z0-9]/g, '-')
      mcpBlock = `
  // MCP servers your plugin connects to
  mcp: {
    '${serverName}': {
      url: '${mcpUrl}',${mcpEnvVar ? `
      auth: {
        type: 'bearer',
        envVar: '${mcpEnvVar}',
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
    displayName: '${displayName}',${brandColor ? `
    color: '${brandColor}',` : ''}
  },
`
    }

    const template = `import { definePlugin } from 'pluxx'

export default definePlugin({
  name: '${name}',
  version: '0.1.0',
  description: '${description.replace(/'/g, "\\'")}',
  author: {
    name: '${authorName.replace(/'/g, "\\'")}',
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
    await mkdir('skills', { recursive: true })

    const skillContent = `---
name: ${name}
description: ${description || 'A starter skill for ' + name}
version: 0.1.0
---

# ${displayName || name}

${description || 'TODO: Describe what this skill does.'}

## Usage

Describe how agents should use this skill.

## Examples

\`\`\`
Example prompt or command here
\`\`\`
`

    await Bun.write('skills/SKILL.md', skillContent)

    console.log('')
    console.log('  Created:')
    console.log('    pluxx.config.ts')
    console.log('    skills/SKILL.md')
    console.log('')
    console.log('  Next steps:')
    console.log('    1. Edit skills/SKILL.md with your skill instructions')
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
  let targets: TargetPlatform[] | undefined

  if (targetFlag !== -1) {
    targets = args.slice(targetFlag + 1).filter(a => !a.startsWith('-')) as TargetPlatform[]
  }

  const config = await loadConfig()
  const distDir = `${process.cwd()}/${config.outDir}`
  const platforms = targets ?? config.targets

  console.log(`Installing ${config.name} plugin...`)
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
  pluxx init [name]                       Create a new pluxx.config.ts
  pluxx migrate <path>                    Import an existing plugin into pluxx
  pluxx install [--target <platforms>]    Symlink built plugins for local testing
  pluxx uninstall [--target <platforms>]  Remove symlinked plugins
  pluxx help                              Show this help

Targets:
  claude-code, cursor, codex, opencode

Examples:
  pluxx build                             Build for all configured targets
  pluxx build --target claude-code cursor  Build for specific platforms
  pluxx init my-plugin                    Scaffold a new plugin config
  pluxx install                           Install to all detected tools
  pluxx install --target claude-code      Install to Claude Code only
`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
