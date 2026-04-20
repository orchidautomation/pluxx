import { definePlugin } from '../../src/index'

export default definePlugin({
  name: 'pluxx',
  version: '0.1.0',
  description: 'Build once, ship installable plugins to Claude, Cursor, Codex, and OpenCode.',
  author: {
    name: 'Orchid Automation',
    url: 'https://github.com/orchidautomation',
  },
  repository: 'https://github.com/orchidautomation/pluxx',
  license: 'MIT',
  keywords: ['mcp', 'plugins', 'claude-code', 'cursor', 'codex', 'opencode', 'pluxx'],

  brand: {
    displayName: 'Pluxx',
    shortDescription: 'Build once, ship installable plugins to Claude, Cursor, Codex, and OpenCode',
    longDescription: 'Use Pluxx to import MCPs or migrate existing plugins, validate and refine the scaffold, then generate installable plugins for Claude, Cursor, Codex, and OpenCode from one maintained source project.',
    category: 'Productivity',
    color: '#0F172A',
    icon: './assets/icon/pluxx-icon.svg',
    screenshots: [
      './assets/screenshots/import-workflow.svg',
      './assets/screenshots/build-install-workflow.svg',
    ],
    defaultPrompts: [
      'Use Pluxx to import or migrate this plugin into a maintained Pluxx project and validate the first pass.',
      'Use Pluxx to refine the taxonomy and instructions in this scaffold, then rerun validation safely.',
      'Use Pluxx to build installable plugins for Claude, Cursor, Codex, and OpenCode, then install the target I want to test.',
    ],
    websiteURL: 'https://pluxx.dev',
    privacyPolicyURL: 'https://docs.pluxx.dev/reference/privacy-policy',
    termsOfServiceURL: 'https://docs.pluxx.dev/reference/terms-of-service',
  },

  skills: './skills/',
  commands: './commands/',
  instructions: './INSTRUCTIONS.md',
  assets: './assets/',

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
