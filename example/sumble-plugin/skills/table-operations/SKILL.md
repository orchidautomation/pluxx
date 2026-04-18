---
name: "table-operations"
description: "List all available tables and their columns in the DuckDB."
---

<!-- pluxx:generated:start -->
# Table Operations

Build, inspect, run, document, and export tables, rows, and enrichment workflows.

## Tools In This Skill

### `ListTables`

List all available tables and their columns in the DuckDB.

    Returns table names with column names and types for each table.
    Use this to understand the schema before writing queries.

    Free (no credits used).

    Args:
        reason: Why you are calling this tool.
    

Inputs:
- `reason` (string, required)

## Example Requests

- "List tables with <reason>."

## Usage

- Pick the most specific tool in this skill for the user request.
- Gather required inputs before calling a tool.
- Summarize the returned data clearly instead of dumping raw JSON unless the user asks for it.
<!-- pluxx:generated:end -->

## Custom Notes

<!-- pluxx:custom:start -->
Add custom guidance, examples, or caveats here. This section is preserved across `pluxx sync --from-mcp`.
<!-- pluxx:custom:end -->
