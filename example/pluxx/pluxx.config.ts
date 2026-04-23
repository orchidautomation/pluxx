import { definePlugin } from '../../src/index'

export default definePlugin({
  name: 'pluxx',
  version: '0.1.1',
  description:
    'Turn a raw MCP or single-host plugin into one maintained source project with native outputs for Claude, Cursor, Codex, and OpenCode.',
  author: {
    name: 'Orchid Automation',
    url: 'https://github.com/orchidautomation',
  },
  repository: 'https://github.com/orchidautomation/pluxx-plugin',
  license: 'MIT',
  keywords: ['mcp', 'plugins', 'claude-code', 'cursor', 'codex', 'opencode', 'pluxx'],

  brand: {
    displayName: 'Pluxx',
    shortDescription: 'One maintained plugin source project. Native bundles for Claude, Cursor, Codex, and OpenCode.',
    longDescription:
      'Use Pluxx to import MCPs or migrate existing plugins into one maintained source project, prepare context, validate and refine the scaffold, then build, verify, install, and publish native plugin bundles for Claude, Cursor, Codex, and OpenCode.',
    category: 'Productivity',
    color: '#0F172A',
    icon: './assets/icon/pluxx-icon.svg',
    screenshots: [
      './assets/screenshots/import-workflow.svg',
      './assets/screenshots/build-install-workflow.svg',
      './assets/screenshots/verify-install-workflow.svg',
    ],
    defaultPrompts: [
      'Use Pluxx to turn this MCP into one maintained source project and validate the first pass across the core four.',
      'Use Pluxx to prepare context, refine the taxonomy and instructions, then rebuild and verify the install state.',
      'Use Pluxx to package this plugin for release and explain the install and update path for the core four.',
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
