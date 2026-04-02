#!/usr/bin/env bun

import { loadConfig } from '../config/load'
import { build } from '../generators'
import type { TargetPlatform } from '../schema'

const args = process.argv.slice(2)
const command = args[0]

async function main() {
  switch (command) {
    case 'build':
      await runBuild()
      break
    case 'validate':
      await runValidate()
      break
    case 'init':
      await runInit()
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
  const name = args[1] ?? 'my-plugin'

  const template = `import { definePlugin } from 'plugahh'

export default definePlugin({
  name: '${name}',
  version: '0.1.0',
  description: 'TODO: Describe your plugin',
  author: {
    name: 'TODO: Your Name',
  },
  license: 'MIT',

  // Skills directory (SKILL.md files following Agent Skills standard)
  skills: './skills/',

  // MCP servers your plugin connects to
  // mcp: {
  //   'my-server': {
  //     url: 'https://my-server.com/mcp',
  //     auth: {
  //       type: 'bearer',
  //       envVar: 'MY_API_KEY',
  //     },
  //   },
  // },

  // Target platforms to generate
  targets: ['claude-code', 'cursor', 'codex', 'opencode'],
})
`

  await Bun.write('plugahh.config.ts', template)
  console.log('Created plugahh.config.ts')
  console.log('')
  console.log('Next steps:')
  console.log('  1. Edit plugahh.config.ts with your plugin details')
  console.log('  2. Create skills in ./skills/<skill-name>/SKILL.md')
  console.log('  3. Run: plugahh build')
}

function printHelp() {
  console.log(`
plugahh — Cross-platform AI agent plugin SDK

Usage:
  plugahh build [--target <platforms...>]   Generate platform-specific plugin files
  plugahh validate                          Validate your config
  plugahh init [name]                       Create a new plugahh.config.ts
  plugahh help                              Show this help

Targets:
  claude-code, cursor, codex, opencode

Examples:
  plugahh build                             Build for all configured targets
  plugahh build --target claude-code cursor  Build for specific platforms
  plugahh init my-plugin                    Scaffold a new plugin config
`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
