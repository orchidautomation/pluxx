# Core-Four Install And Update Lifecycle

Last updated: 2026-04-28

This doc explains the practical install, update, and reload behavior for the four primary Pluxx targets:

- Claude Code
- Cursor
- Codex
- OpenCode

Use this doc when the question is not “what files does the host support?” but:

- how does a user install the plugin
- how does a user update it later
- how does the host pick up the new version
- does the host need a reload or a restart

For the official-doc-backed host capability audit, use [Core-Four Provider Docs Audit](./core-four-provider-docs-audit.md).

## Lifecycle Matrix

| Host | Install surface | Update flow | Pick up changes | Notes |
|---|---|---|---|---|
| Claude Code | Plugin marketplace or local install path | rerun install flow or update marketplace source | `/reload-plugins` | Claude has the cleanest documented reload story |
| Cursor | local plugin dir / local plugin install | replace local bundle or rerun installer | `Developer: Reload Window` or restart Cursor | official docs support reload-window or restart behavior |
| Codex | local plugin dir plus marketplace catalog entry | replace local bundle or rerun installer | use `Plugins > Refresh` if available in the current UI, otherwise restart Codex | plugin-bundled MCP servers may show on the plugin detail page without appearing in the global MCP servers page |
| OpenCode | local plugin dir, entry wrapper, or config-based plugin loading | replace local bundle or update config/plugin reference | restart or reload OpenCode | the supplied docs do not document a dedicated hot-reload plugin command |

## Important Distinction

There are two different update cases:

1. editing a local skill or config file that the host may notice quickly
2. replacing an installed plugin bundle that the host may only notice on refresh or restart

Pluxx should treat plugin updates conservatively.

That means:

- Claude Code: tell the user to run `/reload-plugins`
- Cursor: tell the user to use `Developer: Reload Window` or restart
- Codex: tell the user to use `Plugins > Refresh` if present in the current UI, otherwise restart
- OpenCode: tell the user to restart or reload

## Codex Note

The official Codex plugin docs audited in April 2026 still describe plugin updates in restart-oriented terms.

Separately, the current Codex desktop UI observed on 2026-04-23 also exposes a plugin refresh action in the Plugins view.

So the most truthful current guidance is:

- first-party docs basis: restart after updating the local plugin bundle
- current observed UI: use `Plugins > Refresh` if available
- safe fallback: restart Codex

Codex plugin-bundled MCP visibility has one extra wrinkle.

When a Pluxx-generated Codex plugin includes `.mcp.json`, Codex may display that MCP server inside the plugin detail page while not listing it in the global **MCP servers** settings page. That does not automatically mean the MCP failed to install. The safer check is:

- run `pluxx verify-install --target codex`
- inspect the installed bundle with `pluxx doctor --consumer ~/.codex/plugins/<plugin-name>`
- refresh/restart Codex if the plugin UI still shows stale state
- confirm tools are visible from the plugin inside chat

If a Codex plugin-owned MCP needs an API key, install-time `userConfig` is the expected Pluxx path. Codex may not provide a global MCP settings form for that plugin-owned secret, so reinstall with the real env var exported or rerun the installer interactively. Generated `pluxx publish` installer scripts should prompt consumers for required secrets, materialize them into the installed bundle, reject obvious placeholder values, and let `doctor --consumer` warn if an older install contains one.

## What Pluxx Should Emit

Pluxx install and publish surfaces should communicate lifecycle behavior like this:

- Claude Code: `/reload-plugins`
- Cursor: `Developer: Reload Window` or restart
- Codex: `Plugins > Refresh` if available, otherwise restart; plugin-bundled MCP may be visible from the plugin detail page rather than the global MCP servers page
- OpenCode: restart or reload

That is the wording users should see in:

- `pluxx install`
- generated installer scripts
- host-facing docs
- walkthroughs and demo assets

The repo now also asserts these follow-up notes directly in install-surface tests, so lifecycle wording is no longer only doc guidance.

## No-Context Install Success Contract

`pluxx install`, `pluxx test --install`, `pluxx autopilot --install`, and generated release installers should leave a user with the same minimum next-step clarity:

- which host bundle was installed
- where that host-visible bundle lives
- the exact `pluxx verify-install --target <host>` command to run next
- the host-specific reload or restart action
- auth guidance before install, not after the user opens a host UI that may not expose plugin-owned MCP secrets

When verification fails, `pluxx verify-install` should print a concrete recovery action:

- missing build: run `pluxx build --target <host>`
- missing install: run `pluxx install --target <host>`
- stale symlink or stale version: rerun install for that host
- Codex cache mismatch: refresh plugins if available or restart Codex
- unknown consumer failure: run `pluxx doctor --consumer <installed-path>`
