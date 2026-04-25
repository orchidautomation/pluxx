import { definePlugin } from '../../src/index'

export default definePlugin({
  name: 'exa-research-example',
  version: '0.1.0',
  description:
    'Clean-room Exa-powered deep research workflow pack that ships native plugin bundles to Claude Code, Cursor, Codex, and OpenCode.',
  author: {
    name: 'Orchid Automation',
    url: 'https://github.com/orchidautomation',
  },
  repository: 'https://github.com/orchidautomation/pluxx',
  license: 'MIT',
  keywords: ['exa', 'research', 'deep-research', 'people-search', 'company-research', 'claude-code', 'cursor', 'codex', 'opencode', 'pluxx'],

  brand: {
    displayName: 'Exa Research Example',
    shortDescription: 'A clean-room Exa research workflow pack with specialist agents, rich branding, and native bundles for the core four.',
    longDescription:
      'Use the Exa Research Example to run deep research, people and company discovery, code and docs search, source-quality review, and news scans from one maintained Pluxx source project. This is a clean-room example built against Exa\'s public MCP plus the workflow shape of Exa\'s official Claude plugin, then compiled into native plugin bundles for Claude Code, Cursor, Codex, and OpenCode.',
    category: 'Research',
    color: '#2563FF',
    icon: './assets/icon/exa-research-icon.svg',
    screenshots: [
      './assets/screenshots/deep-research-workflow.svg',
      './assets/screenshots/company-map-workflow.svg',
      './assets/screenshots/code-research-workflow.svg',
    ],
    defaultPrompts: [
      'Use Exa Research Example to run a deep research pass with parallel scouts and source review.',
      'Use Exa Research Example to map this company, its competitors, and the best public sources to read next.',
      'Use Exa Research Example to find the best docs, code examples, and recent writeups for this API or error.',
    ],
    websiteURL: 'https://exa.ai',
    privacyPolicyURL: 'https://exa.ai/privacy-policy',
    termsOfServiceURL: 'https://exa.ai/assets/Exa_Labs_Terms_of_Service.pdf',
  },

  userConfig: [
    {
      key: 'exa-api-key',
      title: 'Exa API Key',
      description: 'Optional Exa API key for higher limits and production use. If omitted, the plugin can still run in anonymous mode with lower limits.',
      type: 'secret',
      required: false,
      envVar: 'EXA_API_KEY',
    },
  ],

  permissions: {
    allow: [
      'Read(*)',
      'Edit(exa-results/**)',
      'MCP(exa.web_search_exa)',
      'MCP(exa.web_fetch_exa)',
      'MCP(exa.web_search_advanced_exa)',
    ],
    ask: [
      'Edit(*)',
      'Bash(*)',
    ],
  },

  skills: './skills/',
  commands: './commands/',
  agents: './agents/',
  instructions: './INSTRUCTIONS.md',
  scripts: './scripts/',
  assets: './assets/',

  mcp: {
    exa: {
      transport: 'http',
      url: 'https://mcp.exa.ai/mcp?client=pluxx-exa-example&tools=web_search_exa,web_fetch_exa,web_search_advanced_exa',
      auth: {
        type: 'header',
        envVar: 'EXA_API_KEY',
        headerName: 'x-api-key',
        headerTemplate: '${value}',
      },
    },
  },

  hooks: {
    sessionStart: [{
      command: 'bash "${PLUGIN_ROOT}/scripts/check-exa-setup.sh"',
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
