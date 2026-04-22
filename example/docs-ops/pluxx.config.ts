import { definePlugin } from '../../src/index'

export default definePlugin({
  name: 'docs-ops',
  version: '0.1.0',
  description: 'Maintain one docs workflow source and ship native docs-ops plugins to Claude Code, Cursor, Codex, and OpenCode.',
  author: {
    name: 'Orchid Automation',
    url: 'https://github.com/orchidautomation',
  },
  repository: 'https://github.com/orchidautomation/pluxx',
  license: 'MIT',
  keywords: ['docs', 'documentation', 'mcp', 'claude-code', 'cursor', 'codex', 'opencode', 'pluxx'],

  brand: {
    displayName: 'Docs Ops',
    shortDescription: 'A docs operator pack for hosted docs workflows across the core four.',
    longDescription: 'Use Docs Ops to inspect a Docsalot-style docs surface, rewrite pages with stronger context, review docs changes, and publish safely from one maintained source project.',
    category: 'Productivity',
    color: '#1E3A8A',
    icon: './assets/icon/docs-ops-icon.svg',
    screenshots: [
      './assets/screenshots/docs-inspect-workflow.svg',
      './assets/screenshots/docs-publish-workflow.svg',
    ],
    defaultPrompts: [
      'Use Docs Ops to inspect this docs surface and tell me which page we should update first.',
      'Use Docs Ops to rewrite the getting-started page so it is clearer and more product-shaped.',
      'Use Docs Ops to review the changed docs pages, run the bundled checks, and prepare a safe publish.',
    ],
    websiteURL: 'https://pluxx.dev',
  },

  skills: './skills/',
  commands: './commands/',
  instructions: './INSTRUCTIONS.md',
  scripts: './scripts/',
  assets: './assets/',

  mcp: {
    docsalot: {
      transport: 'http',
      url: 'https://orchid-docs.docsalot.dev/api/mcp',
      auth: {
        type: 'none',
      },
    },
  },

  hooks: {
    sessionStart: [{
      command: 'bash "${PLUGIN_ROOT}/scripts/check-docs-ops-setup.sh"',
    }],
  },

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
