# Sumble Proof Run

This is the working proof note for a fresh Sumble import using the shipped Pluxx flow.

## Summary

Sumble is a strong real-world proof for Pluxx because it is not a toy MCP.

It is a live commercial MCP with real auth, real workflow depth, and real buyer-facing value around:

- account research
- contact discovery
- hiring signals
- technographics
- table inspection and read-only SQL analysis

For this proof run, Pluxx:

1. scaffolded a fresh workflow-grouped plugin from `https://mcp.sumble.com`
2. generated a maintained source project for Claude Code, Cursor, Codex, and OpenCode
3. passed `doctor`, `lint`, `build`, and `test`
4. successfully used Codex headless to refine the generated `INSTRUCTIONS.md`
5. exposed and fixed a real Codex-runner stability issue in Pluxx itself

## Input

- MCP: `https://mcp.sumble.com`
- auth: bearer token via `SUMBLE_API_KEY`
- targets: `claude-code,cursor,codex,opencode`
- grouping: `workflow`
- hooks: `safe`
- product context:
  - website: `https://sumble.com`
  - docs: `https://docs.sumble.com/api/mcp`

## Command

Deterministic scaffold command:

```bash
SUMBLE_API_KEY=... \
bun bin/pluxx.js init \
  --from-mcp https://mcp.sumble.com \
  --yes \
  --name sumble-plugin \
  --display-name "Sumble" \
  --author "Orchid Labs" \
  --targets claude-code,cursor,codex,opencode \
  --grouping workflow \
  --hooks safe \
  --auth-env SUMBLE_API_KEY \
  --auth-type bearer
```

Verification path:

```bash
bun bin/pluxx.js doctor
bun bin/pluxx.js lint
bun bin/pluxx.js build
bun bin/pluxx.js test --target claude-code cursor codex opencode
```

## What Pluxx Generated

The fresh Sumble scaffold produced:

- `pluxx.config.ts`
- `INSTRUCTIONS.md`
- workflow skills under `skills/`
- explicit commands under `commands/`
- safe hook scripts under `scripts/`
- built outputs under `dist/`

Workflow surfaces generated from the raw MCP:

- `account-research`
- `contact-discovery`
- `hiring-signals`
- `technographics`
- `table-operations`
- `general-research`
- `log-out`

## Verification Result

Observed result from the real run:

- `doctor`: `0 error(s), 1 warning(s), 2 info message(s)`
- `lint`: `0 error(s), 1 warning(s)`
- `build`: generated all core-four bundles
- `test`: passed for Claude Code, Cursor, Codex, and OpenCode

Current warnings:

- `doctor`: local generated hook commands require install trust via `pluxx install --trust`
- `build`: Codex still documents hooks as external config rather than plugin-packaged output, so Pluxx warns honestly instead of pretending Codex hook parity exists

## Headless Codex Result

The direct Codex headless pass successfully rewrote the generated `INSTRUCTIONS.md` block into cleaner Sumble-specific routing guidance:

- setup/auth guidance separated from runtime workflows
- Sumble product language instead of generic scaffold wording
- workflow routing kept concise

That is the exact authoring split Pluxx is designed for:

- Pluxx owns the deterministic scaffold
- Codex refines the meaning inside managed boundaries

## Product Learning

This run surfaced a real Pluxx bug.

The original Codex runner path used:

```text
codex exec
```

That could finish the edit work and then hang during session finalization.

The fix was to switch Pluxx's Codex runner to:

```text
codex exec --ephemeral
```

That keeps the headless worker path stable for Pluxx agent and autopilot runs.

## Why This Matters

This is the strongest kind of proof for Pluxx:

- a live commercial MCP
- real auth
- real workflow grouping
- real core-four output
- real verification
- real dogfood bug discovered and fixed during the run

That is much more useful than a toy scaffold because it shows the whole Pluxx loop on a real MCP team would actually care about.
