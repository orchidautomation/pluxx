import { definePlugin } from 'pluxx'

export default definePlugin({
  name: "sumble-plugin",
  version: '0.1.0',
  description: "Sumble plugin scaffold for account research and contact discovery workflows.",
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
    shortDescription: "Sumble plugin scaffold for account research and contact discovery workflows."
  },

  targets: ["claude-code", "cursor", "codex", "opencode"],
})
