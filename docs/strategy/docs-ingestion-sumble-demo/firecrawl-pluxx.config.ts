import { definePlugin } from 'pluxx'

export default definePlugin({
  name: "sumble-plugin",
  version: '0.1.0',
  description: "Sumble provides account intelligence data, enabling sales teams to do deep research. Use it to better inform your targeting and outreach.",
  author: {
    name: "Orchid Labs",
  },
  license: 'MIT',

  skills: './skills/',
  commands: "./commands/",

  instructions: './INSTRUCTIONS.md',

  userConfig: [
    {
      key: "sumble-api-key",
      title: "Sumble Api Key",
      description: "Authentication credential for the sumble MCP server.",
      type: "secret",
      required: true,
      envVar: "SUMBLE_API_KEY",
      targets: ["codex","opencode"]
    }
  ],

  scripts: "./scripts/",


  mcp: {
    "sumble": {
      url: "https://mcp.sumble.com/",
      auth: {
        type: "bearer",
        envVar: "SUMBLE_API_KEY"
      }
    },
  },

  hooks: {
    sessionStart: [
      {
        command: "bash \"${PLUGIN_ROOT}/scripts/check-env.sh\""
      }
    ],
    preToolUse: [
      {
        command: "bash \"${PLUGIN_ROOT}/scripts/confirm-mutation.sh\"",
        matcher: "mcp__sumble__CreateContactList"
      },
      {
        command: "bash \"${PLUGIN_ROOT}/scripts/confirm-mutation.sh\"",
        matcher: "mcp__sumble__AddContactsToList"
      },
      {
        command: "bash \"${PLUGIN_ROOT}/scripts/confirm-mutation.sh\"",
        matcher: "mcp__sumble__CreateOrganizationList"
      },
      {
        command: "bash \"${PLUGIN_ROOT}/scripts/confirm-mutation.sh\"",
        matcher: "mcp__sumble__AddOrganizationsToList"
      }
    ]
  },



  platforms: {
    'claude-code': {
      mcpAuth: 'platform',
    },
    cursor: {
      mcpAuth: 'platform',
    },
  },


  brand: {
    displayName: "Sumble",
    shortDescription: "Sumble provides account intelligence data, enabling sales teams to do deep research.",
    websiteURL: "https://sumble.com"
  },

  targets: ["claude-code", "cursor", "codex", "opencode"],
})
