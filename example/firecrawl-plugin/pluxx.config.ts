import { definePlugin } from 'pluxx'

export default definePlugin({
  name: 'firecrawl-plugin',
  description: 'Workflow-shaped Firecrawl MCP plugin scaffold',
  author: { name: 'Pluxx' },
  mcp: {
    firecrawl: {
      url: 'https://api.firecrawl.dev/mcp',
      auth: { type: 'bearer', envVar: 'FIRECRAWL_API_KEY' }
    }
  },
  skills: './skills',
  instructions: './INSTRUCTIONS.md',
  scripts: './scripts',
  targets: ['claude-code', 'cursor', 'codex', 'opencode']
})
