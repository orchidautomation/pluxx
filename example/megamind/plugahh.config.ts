import { definePlugin } from '../../src/index'

export default definePlugin({
  name: 'megamind',
  version: '1.0.3',
  description: 'Client intelligence tools powered by Megamind. Synced Slack + Fathom data, queryable from Claude Code.',
  author: {
    name: 'The Kiln',
    url: 'https://thekiln.com',
  },
  repository: 'https://github.com/The-Kiln-Dev/projectmegamind',
  license: 'MIT',
  keywords: ['client-intelligence', 'slack', 'fathom', 'crm'],

  brand: {
    displayName: 'Megamind',
    shortDescription: 'Client intelligence from synced Slack and Fathom data',
    longDescription: 'Use Megamind inside Codex to inspect client activity, pull call context, draft daily updates, and generate post-call recaps from pre-synced Slack and Fathom data.',
    category: 'Productivity',
    color: '#0F766E',
    icon: './assets/megamind.svg',
    defaultPrompts: [
      'Catch me up on Sendoso using Megamind',
      'Draft a daily update for Cognition from Megamind data',
      'Generate a post-call recap for Gates from the latest call',
    ],
    websiteURL: 'https://thekiln.com',
  },

  skills: './skills/',
  commands: './commands/',
  agents: './agents/',
  scripts: './scripts/',
  assets: './assets/',

  instructions: './INSTRUCTIONS.md',

  mcp: {
    megamind: {
      url: 'https://megamind.up.railway.app/mcp',
      transport: 'http',
      auth: {
        type: 'bearer',
        envVar: 'MEGAMIND_API_KEY',
        headerName: 'Authorization',
        headerTemplate: 'Bearer ${value}',
      },
    },
  },

  hooks: {
    sessionStart: [{
      command: '${PLUGIN_ROOT}/scripts/validate-env.sh',
    }],
  },

  platforms: {
    codex: {
      interface: {
        capabilities: ['Interactive', 'Write'],
        privacyPolicyURL: 'https://thekiln.com',
        termsOfServiceURL: 'https://thekiln.com',
      },
    },
  },

  targets: ['claude-code', 'cursor', 'codex', 'opencode', 'github-copilot', 'openhands', 'warp', 'gemini-cli', 'roo-code', 'cline', 'amp'],
  outDir: './dist',
})
