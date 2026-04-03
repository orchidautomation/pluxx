import { definePlugin } from '../../src/index'

export default definePlugin({
  name: 'prospeo',
  version: '1.0.0',
  description: 'Search 200M+ contacts, enrich people and companies, and get verified work emails via Prospeo.',
  author: {
    name: 'Orchid Automation',
    url: 'https://github.com/orchidautomation',
  },
  repository: 'https://github.com/orchidautomation/prospeo-mcp',
  license: 'MIT',
  keywords: ['prospeo', 'email-finder', 'enrichment', 'sales', 'contacts', 'mcp'],

  brand: {
    displayName: 'Prospeo',
    shortDescription: 'Find verified emails and enrich contacts from 200M+ records',
    category: 'Productivity',
  },

  skills: './skills/',

  mcp: {
    prospeo: {
      transport: 'stdio',
      command: 'node',
      args: ['${PLUGIN_ROOT}/server/dist/index.js'],
      env: {
        PROSPEO_API_KEY: '${PROSPEO_API_KEY}',
      },
    },
  },

  hooks: {
    sessionStart: [{
      command: '${PLUGIN_ROOT}/scripts/check-api-key.sh',
    }],
  },

  instructions: './INSTRUCTIONS.md',

  targets: ['claude-code', 'cursor', 'codex', 'opencode', 'github-copilot', 'openhands', 'warp'],
  outDir: './dist',
})
