# PlayKit Case Study

This is the working case-study draft for PlayKit as a dogfood example of the Pluxx workflow.

## Summary

PlayKit is a strong example of why Pluxx exists.

PlayKit is not a toy MCP. It gives agents direct access to Clay workflows, Clay knowledge, pricing and usage data, table design/build flows, and GTM engineering operations. That makes it exactly the kind of MCP where:

- deterministic scaffolding is necessary
- semantic refinement matters
- long-term maintenance from one repo matters

## The Setup

Input:

- raw MCP: `https://mcp.playkit.sh/mcp`
- auth: `X-API-Key` via `PLAYKIT_API_KEY`
- targets: `claude-code,cursor,codex,opencode`

Dogfood flow:

1. import PlayKit from the raw MCP
2. generate the first-pass scaffold
3. validate the deterministic output
4. use Codex as the host agent
5. verify the generated bundles again

## Why PlayKit Is A Good Test

PlayKit exposes a rich tool surface around:

- Clay setup and connection
- Clay knowledge
- Clay workflow design
- Clay table operations
- pricing and usage/account surfaces

That means a good scaffold has to do more than mirror tool names. It has to separate:

- setup vs runtime workflows
- knowledge tools vs API tools
- account/usage/admin surfaces
- end-user workflows vs maintenance workflows

## What Pluxx Generated

From the raw MCP, Pluxx generated:

- `pluxx.config.ts`
- `INSTRUCTIONS.md`
- `.pluxx/mcp.json`
- workflow skill directories
- platform bundles for Claude Code, Codex, Cursor, and OpenCode

Example top-level shape:

```text
playkit/
├── pluxx.config.ts
├── INSTRUCTIONS.md
├── .pluxx/
│   └── mcp.json
├── scripts/
│   └── check-env.sh
├── skills/
│   ├── account-research/
│   ├── clay-status/
│   ├── contact-discovery/
│   ├── enrichment/
│   ├── general-research/
│   ├── get-usage/
│   ├── list-management/
│   └── technographics/
└── dist/
    ├── claude-code/
    ├── codex/
    ├── cursor/
    └── opencode/
```

## What Worked

The real dogfood result was strong:

- the raw MCP imported successfully
- auth and transport were modeled correctly
- the scaffold validated
- the core-four bundles built
- the generated project was maintainable and syncable

Validated result:

- `doctor`: `0 error(s), 1 warning(s), 1 info message(s)`
- `test`: `PASS claude-code`, `PASS cursor`, `PASS codex`, `PASS opencode`

## Important Product Learning

The PlayKit run also exposed the exact semantic gap Pluxx still needs host-agent help to close.

The first scaffold was structurally right, but semantically rough in places:

- some generated skills were mechanically correct but not product-shaped
- setup/account/admin distinctions were not as clear as the actual PlayKit docs
- the tool taxonomy still benefited from human or agent refinement

This is not a failure of the product.

It is the proof of the product split:

- Pluxx Core should generate the structure
- Codex or Claude should refine the meaning

## Codex-Specific Outcome

This dogfood pass also surfaced and fixed a real generator issue.

Originally, Pluxx treated Codex as if it only supported `bearer_token_env_var` for MCP auth. That caused custom-header auth to degrade in generated Codex output.

The PlayKit case forced the correct fix:

- Codex output now supports `env_http_headers` for env-backed custom headers like `X-API-Key: ${PLAYKIT_API_KEY}`
- PlayKit now round-trips into Codex output without dropping auth

This is a good example of why real MCP dogfooding matters more than theoretical generator coverage.

## Draft Founder Quotes

These are placeholders for final quotes.

> "Pluxx got PlayKit from a raw MCP to a working multi-platform plugin project without forcing us to hand-maintain four separate plugin implementations."

> "The deterministic scaffold got us to valid output fast. Using Codex on top is what makes the final result feel like the product, not just the schema."

> "What matters is not just generating files. It is having one repo we can keep in sync as the MCP evolves."

## Why This Matters

PlayKit shows that the best Pluxx story is not:

- generic plugin generation

It is:

- MCP-first plugin authoring
- agent-assisted refinement
- one maintained source of truth over time

That is the story to keep pushing.

## Next Iteration Ideas

- refine the generated skill taxonomy for PlayKit with Agent Mode
- turn this into a public “raw MCP to working plugin” walkthrough
- replace the draft quotes with final founder language
