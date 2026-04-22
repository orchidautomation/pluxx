# Docsalot MCP Notes

- Official hosted endpoint pattern: `{subdomain}-docs.docsalot.dev/api/mcp`
- Docsalot's public documentation says the hosted MCP surface is for public docs.
- Example tools/workflows exposed on the Docsalot MCP page:
  - `search_docs`
  - `list_pages`
  - `get_page`

Use those patterns as the model for this flagship plugin.

Do not assume authenticated end-user docs are available through the same hosted MCP surface unless the product docs say so.
