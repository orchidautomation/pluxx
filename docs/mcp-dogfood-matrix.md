# Real MCP Dogfood Matrix

This matrix tracks real-world MCP classes we intentionally test so Pluxx quality gates are based on runtime reality, not ideal metadata.

## Matrix

| MCP class | Example shape | Runtime correctness (connect/auth/tools) | Scaffold quality risk | Current quality signal |
| --- | --- | --- | --- | --- |
| Messy metadata | Missing tool descriptions, generic names (`tool_1`) | Usually still works if transport/auth are valid | Skills and instructions become generic/non-product-shaped | `pluxx doctor` warns with `mcp-metadata-quality-weak` before publish |
| Local stdio under active dev | `npx -y @acme/mcp` with changing tools | Can drift quickly as local command or schema changes | Generated taxonomy can go stale after server changes | `pluxx sync --from-mcp` + metadata ownership keeps managed files refreshable |
| OAuth-first remote | Remote HTTP MCP requiring OAuth/session flow | May fail for non-interactive import unless explicit auth strategy is supplied | Scaffold can be delayed by auth handshake complexity | Treated as a runtime gate; requires explicit auth modeling and follow-up docs |
| Production remote with bearer/header auth | HTTP MCP with bearer token or custom header | Stable when env vars and header templates are configured correctly | Metadata quality still determines first-pass UX quality | Auth translation is deterministic; metadata warnings + review prompt gate quality |
| Host authoring runners (Cursor + OpenCode) | `pluxx agent run` and `pluxx autopilot` using real runner adapters | Runner invocation path must handle auth/attach semantics correctly and return non-flaky results | A platform can look "supported" from bundle tests while runner-level authoring flows are under-tested | End-to-end runner tests now cover Cursor and OpenCode for both `agent run` and `autopilot`, including OpenCode `--attach` behavior |

## Scaffold Quality vs Runtime Correctness

- Runtime correctness asks: can we connect, authenticate, and call tools safely?
- Scaffold quality asks: does generated taxonomy/instructions feel product-shaped and publishable?
- A server can pass runtime checks and still fail scaffold quality if metadata is weak.

## Findings Converted To Productized Fixes

1. Docs fix:
Added this matrix so dogfood coverage and failure modes are explicit and repeatable.

2. Prompt-pack fix:
`pluxx agent prompt review` now requires calling out weak metadata signals and separating scaffold-quality findings from runtime-correctness findings.

3. Product fix:
`pluxx doctor` now analyzes `.pluxx/mcp.json` tool metadata and warns on missing descriptions, low-information descriptions, and generic tool names before publishing.

4. Test coverage fix:
`tests/agent-mode.test.ts` and `tests/autopilot.test.ts` now validate both Cursor and OpenCode runner flows in dry-run and execution paths so authoring-host claims are backed by explicit regression coverage.
