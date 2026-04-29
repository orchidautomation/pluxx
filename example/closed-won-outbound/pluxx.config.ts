import { definePlugin } from '../../src/index'

export default definePlugin({
  name: 'closed-won-outbound-example',
  version: '0.1.0',
  description:
    'First-class Pluxx example for turning closed-won CRM history into lookalike outbound pipeline with explicit adapter boundaries.',
  author: {
    name: 'Orchid Automation',
    url: 'https://github.com/orchidautomation',
  },
  repository: 'https://github.com/orchidautomation/pluxx',
  license: 'MIT',
  keywords: [
    'gtm',
    'outbound',
    'crm',
    'lookalikes',
    'enrichment',
    'pipeline',
    'codex',
    'cursor',
    'claude-code',
    'opencode',
    'pluxx',
  ],

  brand: {
    displayName: 'Closed-Won Outbound Example',
    shortDescription:
      'A workflow-shaped GTM example for turning best customers into lookalike outbound pipeline.',
    longDescription:
      'Use the Closed-Won Outbound Example to start from closed-won CRM truth, segment a best-customer cohort, find lookalike accounts, map target personas, dedupe against CRM state, enrich the remaining records, and hand off a campaign-tagged prospect pipeline. The source project is intentionally explicit about which parts are native Pluxx workflow structure today and which parts still depend on thin provider adapters.',
    category: 'Productivity',
    color: '#0F766E',
    icon: './assets/icon/closed-won-outbound-icon.svg',
    screenshots: [
      './assets/screenshots/cohort-to-lookalikes.svg',
      './assets/screenshots/pipeline-handoff.svg',
    ],
    defaultPrompts: [
      'Use Closed-Won Outbound Example to turn our strongest closed-won accounts into a lookalike outbound pipeline.',
      'Use Closed-Won Outbound Example to map Engineering Manager prospects at companies similar to our best customers.',
      'Use Closed-Won Outbound Example to dedupe, enrich, and stage a campaign-tagged handoff for SDR review.',
    ],
    websiteURL: 'https://pluxx.dev',
  },

  userConfig: [
    {
      key: 'crm-mcp-token',
      title: 'CRM MCP Token',
      description: 'Bearer token for the CRM adapter that exposes closed-won history, account lookup, and CRM dedupe context.',
      type: 'secret',
      required: false,
      envVar: 'PLUXX_CRM_MCP_TOKEN',
    },
    {
      key: 'lead-mcp-token',
      title: 'Lead MCP Token',
      description: 'Bearer token for the lead adapter that handles lookalikes, personas, and enrichment.',
      type: 'secret',
      required: false,
      envVar: 'PLUXX_LEAD_MCP_TOKEN',
    },
    {
      key: 'research-mcp-token',
      title: 'Research MCP Token',
      description: 'Bearer token for the research adapter that validates company context and supporting evidence.',
      type: 'secret',
      required: false,
      envVar: 'PLUXX_RESEARCH_MCP_TOKEN',
    },
    {
      key: 'pipeline-mcp-token',
      title: 'Pipeline MCP Token',
      description: 'Bearer token for the outbound-pipeline adapter that stages tagged records and handoff artifacts.',
      type: 'secret',
      required: false,
      envVar: 'PLUXX_PIPELINE_MCP_TOKEN',
    },
  ],

  permissions: {
    allow: [
      'Read(*)',
      'Edit(outbound-pipeline/**)',
      'MCP(crm.*)',
      'MCP(lead.*)',
      'MCP(research.*)',
      'MCP(pipeline.*)',
      'MCP(runtime.*)',
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
    crm: {
      transport: 'http',
      url: 'https://crm.example.com/mcp',
      auth: {
        type: 'bearer',
        envVar: 'PLUXX_CRM_MCP_TOKEN',
        headerName: 'Authorization',
        headerTemplate: 'Bearer ${value}',
      },
    },
    lead: {
      transport: 'http',
      url: 'https://lead.example.com/mcp',
      auth: {
        type: 'bearer',
        envVar: 'PLUXX_LEAD_MCP_TOKEN',
        headerName: 'Authorization',
        headerTemplate: 'Bearer ${value}',
      },
    },
    research: {
      transport: 'http',
      url: 'https://research.example.com/mcp',
      auth: {
        type: 'bearer',
        envVar: 'PLUXX_RESEARCH_MCP_TOKEN',
        headerName: 'Authorization',
        headerTemplate: 'Bearer ${value}',
      },
    },
    pipeline: {
      transport: 'http',
      url: 'https://pipeline.example.com/mcp',
      auth: {
        type: 'bearer',
        envVar: 'PLUXX_PIPELINE_MCP_TOKEN',
        headerName: 'Authorization',
        headerTemplate: 'Bearer ${value}',
      },
    },
    runtime: {
      transport: 'http',
      url: 'https://runtime.example.com/mcp',
      auth: {
        type: 'none',
      },
    },
  },

  hooks: {
    sessionStart: [{
      command: 'bash "${PLUGIN_ROOT}/scripts/check-closed-won-outbound-setup.sh"',
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
