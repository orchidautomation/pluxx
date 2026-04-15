import { definePlugin } from '../../src/index'

export default definePlugin({
  name: 'pluxx',
  version: '0.1.0',
  description: 'Use Pluxx inside your host agent to scaffold, refine, review, and sync plugins from MCP servers.',
  author: {
    name: 'Orchid Automation',
    url: 'https://github.com/orchidautomation',
  },
  repository: 'https://github.com/orchidautomation/pluxx',
  license: 'MIT',
  keywords: ['mcp', 'plugins', 'claude-code', 'cursor', 'codex', 'opencode', 'pluxx'],

  brand: {
    displayName: 'Pluxx',
    shortDescription: 'Use Pluxx to build and maintain plugins from MCP servers',
    longDescription: 'Use Pluxx inside Claude Code, Cursor, Codex, or OpenCode to scaffold plugin projects from MCP servers, refine taxonomy and instructions, review scaffolds critically, and keep them synced over time.',
    category: 'Productivity',
    color: '#0F172A',
    defaultPrompts: [
      'Use Pluxx to scaffold a plugin from this MCP and validate the first pass.',
      'Use Pluxx to refine the taxonomy in this plugin scaffold and keep edits safe.',
      'Use Pluxx to sync this scaffold from its MCP source and explain what changed.',
    ],
    websiteURL: 'https://github.com/orchidautomation/pluxx',
    privacyPolicyURL: 'https://github.com/orchidautomation/pluxx',
    termsOfServiceURL: 'https://github.com/orchidautomation/pluxx',
  },

  skills: './skills/',
  commands: './commands/',
  instructions: './INSTRUCTIONS.md',

  platforms: {
    codex: {
      interface: {
        capabilities: ['Interactive', 'Read', 'Write'],
      },
    },
  },

  targets: ['claude-code', 'cursor', 'codex', 'opencode'],
  outDir: './dist',
})
