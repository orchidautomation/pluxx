# Core-Four Install And Update Lifecycle

Last updated: 2026-04-30

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

## Installer-Owned Runtime Scripts

Some files are intentionally installer-owned after a local install.

The most important current example is:

- `scripts/check-env.sh`

When Pluxx materializes required `userConfig` into an installed local bundle, install rewrites `scripts/check-env.sh` into a no-op marker file.

That means plugin runtime must not depend on sourcing or chaining through `scripts/check-env.sh` for critical startup behavior.

Treat it as:

- install-time validation only
- mutable after install
- unsafe as a runtime dependency for MCP startup or richer startup hooks

This now exists as an explicit product contract because SendLens failed in Claude after install when runtime startup still sourced `check-env.sh` even though install had already rewritten it.

## Claude Local Stdio Runtime Contract

Claude Code should not be treated as guaranteeing plugin-root cwd for stdio MCP launch.

For project-local Claude stdio runtimes, the generated `.mcp.json` should anchor runtime paths under `${CLAUDE_PLUGIN_ROOT}` instead of assuming relative `./...` paths will resolve from the plugin root after install.

The practical rule is:

- relative source paths in a Pluxx project are fine
- generated Claude bundle output should be plugin-root anchored for local stdio runtime paths
- plugin authors should reason about installed Claude runtime using `${CLAUDE_PLUGIN_ROOT}`, not cwd assumptions

## Portable Native Runtime Pattern

If a plugin needs native Node dependencies such as `@duckdb/node-api`, do not assume a CI-built `node_modules` tree is portable across user machines.

The safer pattern is:

- `load-env.sh` for runtime env loading
- `bootstrap-runtime.sh` for first-run local native dependency install
- `start-mcp.sh` as the MCP entrypoint
- no runtime dependence on installer-mutated `check-env.sh`

This is now also a compiler-owned contract, not only doc guidance:

- `lint` and `doctor` read from one shared runtime-script contract for the installer-owned `check-env.sh` rule
- the recommended portable runtime role split is centralized alongside that rule so follow-on runtime validation work can reuse it instead of restating it
- Codex local installs now rewrite plugin-owned stdio MCP command/arg paths to absolute installed plugin paths so installed MCP launch does not depend on the active workspace cwd
- source-project runtime payload checks now treat bundled `scripts/`, `assets/`, and `passthrough` payload as one runtime surface when validating local stdio MCP startup paths
- `doctor --consumer` now also reports which known runtime script-role files are actually present in an installed bundle
- `install`, `doctor --consumer`, and `verify-install` now fail installed bundles whose real stdio entry scripts still chain runtime startup back through installer-owned `scripts/check-env.sh`

This is the pattern that stabilized SendLens on macOS after the earlier Linux-built `node_modules` release failed to run with DuckDB native bindings.

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
