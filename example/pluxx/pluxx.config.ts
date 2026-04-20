import { definePlugin } from '../../src/index'

export default definePlugin({
  name: 'pluxx',
  version: '0.1.0',
  description: 'Use Pluxx inside your host agent to import, migrate, validate, refine, build, install, review, and sync plugins.',
  author: {
    name: 'Orchid Automation',
    url: 'https://github.com/orchidautomation',
  },
  repository: 'https://github.com/orchidautomation/pluxx',
  license: 'MIT',
  keywords: ['mcp', 'plugins', 'claude-code', 'cursor', 'codex', 'opencode', 'pluxx'],

  brand: {
    displayName: 'Pluxx',
    shortDescription: 'Use Pluxx to build, validate, and maintain plugins across the core four',
    longDescription: 'Use Pluxx inside Claude Code, Cursor, Codex, or OpenCode to import MCPs, migrate existing plugins, validate scaffolds, refine taxonomy and instructions, build native outputs, and keep plugin projects synced over time.',
    category: 'Productivity',
    color: '#0F172A',
    defaultPrompts: [
      'Use Pluxx to import or migrate this plugin into a maintained Pluxx project and validate the first pass.',
      'Use Pluxx to refine the taxonomy and instructions in this scaffold, then rerun validation safely.',
      'Use Pluxx to build this scaffold for the core four and install the target I want to test.',
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
