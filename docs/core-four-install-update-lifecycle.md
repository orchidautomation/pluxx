# Core-Four Install And Update Lifecycle

Last updated: 2026-04-23

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
| Codex | local plugin dir plus marketplace catalog entry | replace local bundle or rerun installer | use `Plugins > Refresh` if available in the current UI, otherwise restart Codex | official docs still describe restart-after-update; current desktop UI also exposes a refresh action |
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

## What Pluxx Should Emit

Pluxx install and publish surfaces should communicate lifecycle behavior like this:

- Claude Code: `/reload-plugins`
- Cursor: `Developer: Reload Window` or restart
- Codex: `Plugins > Refresh` if available, otherwise restart
- OpenCode: restart or reload

That is the wording users should see in:

- `pluxx install`
- generated installer scripts
- host-facing docs
- walkthroughs and demo assets
