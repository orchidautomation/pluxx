# Exa Research Example

This directory is a clean-room Pluxx example that ports the workflow shape of Exa's official Claude plugin into one maintained source project for:

- Claude Code
- Cursor
- Codex
- OpenCode

It is built against Exa's public MCP, not copied from Exa's internal plugin source.

## Why This Example Matters

This is not a thin MCP wrapper.

It is meant to show that Pluxx can take a Claude-first product shape and carry the same intent across:

- specialist agents and subagents
- richer commands
- one intentionally richer Claude-only orchestrator skill
- review-before-synthesis workflow structure
- auth and setup checks
- brand metadata, screenshots, prompts, and installable native bundles

## What It Demonstrates

- deep research orchestration instead of a thin MCP wrapper
- specialist agents and subagents for people, companies, code, news, and source review
- explicit commands and skills instead of one generic search surface
- portable auth, hooks, permissions, and install metadata across the core four
- rich shared brand metadata:
  - icon
  - screenshots
  - category
  - color
  - website / privacy / terms links
  - default prompts

## Runtime

Hosted MCP:

- `https://mcp.exa.ai/mcp`

Optional auth:

- `EXA_API_KEY`

Advanced search is enabled in this example by default through the MCP URL query string.

## Brand And Listing Surface

The source project intentionally exercises the richer shared brand layer that Pluxx can map today:

- [icon](./assets/icon/exa-research-icon.svg)
- [deep research screenshot](./assets/screenshots/deep-research-workflow.svg)
- [company research screenshot](./assets/screenshots/company-map-workflow.svg)
- [code research screenshot](./assets/screenshots/code-research-workflow.svg)

The generated bundles then carry that intent into the most native host surfaces available:

- Codex: rich interface metadata plus screenshots and default prompts
- Cursor: homepage / listing subset
- Claude Code: bundle-native skills, commands, agents, hooks, and MCP wiring
- OpenCode: code-first plugin plus permission-first agent output

## Current Local Proof

This example has already been:

- built from one maintained source project
- installed into Claude Code, Cursor, Codex, and OpenCode
- checked with `verify-install` across all four

It also surfaced a real compiler gap during authoring: canonical Pluxx agents needed a stronger Claude-native translation layer instead of raw pass-through. That fix now lives in the main Pluxx generators.

## Direct Install

These one-command installers build the current Exa example from the public repo source and install it into the host you actually use.

Important:

- this example includes a local `sessionStart` hook: `scripts/check-exa-setup.sh`
- the hook only reports whether `EXA_API_KEY` is set and prints setup guidance
- using these installers means explicitly trusting that local hook
- the equivalent source-path install command is `pluxx install --target <host> --trust`

Claude Code:

```bash
curl -fsSL https://raw.githubusercontent.com/orchidautomation/pluxx/main/example/exa-plugin/release/install-claude-code.sh | bash
```

Cursor:

```bash
curl -fsSL https://raw.githubusercontent.com/orchidautomation/pluxx/main/example/exa-plugin/release/install-cursor.sh | bash
```

Codex:

```bash
curl -fsSL https://raw.githubusercontent.com/orchidautomation/pluxx/main/example/exa-plugin/release/install-codex.sh | bash
```

OpenCode:

```bash
curl -fsSL https://raw.githubusercontent.com/orchidautomation/pluxx/main/example/exa-plugin/release/install-opencode.sh | bash
```

Optional for higher limits:

```bash
export EXA_API_KEY="your_exa_api_key"
```

## Local Validation

From this directory:

```bash
pluxx doctor
pluxx lint
pluxx build
pluxx install --target codex --trust
pluxx verify-install --target codex
```

Repeat `install` and `verify-install` for Claude Code, Cursor, and OpenCode when you want full local proof.

For the current Exa behavioral smoke across the core four:

```bash
pluxx test --install --trust --behavioral --target claude-code cursor codex opencode
```

Until the next npm release lands, the repo-local Claude manifest fix is ahead of the published `pluxx` package. From this repo checkout, the exact equivalent is:

```bash
node ../../bin/pluxx.js test --install --trust --behavioral --target claude-code cursor codex opencode
```

## Important Note

This example is intentionally public-repo safe:

- it uses Exa's public MCP and docs
- it follows the workflow shape of Exa's official Claude experience
- it does not republish Exa's official plugin internals verbatim
