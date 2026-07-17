# Core-Four Install And Update Lifecycle

Last updated: 2026-07-16

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

For the current release/distribution/proof boundary, use [Release Distribution Proof Map](./release-distribution-proof-map.md).

For the parser-backed reference shape that future install-link and ownership work should reuse, use [Install Reference Syntax](./install-reference-syntax.md).

## Host Install And Discovery Capability Matrix

This is the code-owned source of truth for issue #306: install method, local path, reload behavior, cache semantics, discovery surface, and brand/listing support per primary host.

<!-- BEGIN GENERATED HOST INSTALL DISCOVERY CAPABILITIES -->
| Host | Install method | Local install path | Reload / update pickup | Cache semantics | Discovery surface | Brand / listing support |
|---|---|---|---|---|---|---|
| Claude Code | Native Claude plugin install from a generated local marketplace, or the generated release installer. | ~/.claude/plugins/cache/pluxx-local-<plugin>/<plugin>/<version> after native install; legacy direct installs may still appear at ~/.claude/plugins/<plugin>. | Run /reload-plugins in the active Claude window. | Claude copies the selected marketplace plugin into a versioned plugin cache. Pluxx verifies that cache path rather than assuming the source bundle is live. | Claude plugin marketplace/listing commands, the active plugin list, and plugin-native agents under the bundle root agents/ directory; use /agents after reload to confirm agent discovery. | No shared manifest-backed brand fields from Pluxx brand today; instructions, skills, commands, and assets still ship inside the bundle. |
| Cursor | Local plugin install or generated release installer that replaces the local bundle. | ~/.cursor/plugins/local/<plugin> | Use Developer: Reload Window or restart Cursor. | Pluxx installs the local bundle path directly; no separate Pluxx-managed active cache is modeled. | Cursor local plugin directory and host plugin UI; plugin-native agents are discovered from the bundle root agents/ directory after reload or restart. | Narrow shared-brand translation: homepage and logo can be emitted; richer listing copy is not a shared Cursor surface today. |
| Codex | Local plugin install plus a local marketplace catalog entry, or the generated release installer. | ~/.codex/plugins/<plugin> plus a local marketplace catalog entry; generated custom agents are registered under the active CODEX_HOME/agents/<plugin>/. | Use Plugins > Refresh when that UI action is available, otherwise restart Codex. | Codex may load a separate active cache under ~/.codex/plugins/cache/local-plugins/<plugin>/<version>. Pluxx clears local cache on install/uninstall, verifies custom-agent registrations, and detects stale cache contents. | Codex Plugins view and plugin detail page. Plugin-bundled MCP servers may appear on the plugin detail page without appearing in the global MCP servers settings page. Custom agents are a project/user config surface, not a plugin-native registration surface. | Richest current shared-brand target: display name, descriptions, category, color, icon/logo, screenshots, default prompt, website, and policy links can be emitted into .codex-plugin/plugin.json interface metadata. |
| OpenCode | Local plugin directory plus generated entry wrapper, generated release installer, or npm-backed wrapper package path. | ~/.config/opencode/plugins/<plugin> plus ~/.config/opencode/plugins/<plugin>.ts and synced skills under ~/.config/opencode/skills/<plugin>-<skill>. | Restart or reload OpenCode. | Pluxx writes the local plugin wrapper and synced skill files directly; no separate Pluxx-managed active cache is modeled. | OpenCode plugin loader, plugin wrapper file, config-hook-injected agent definitions, and synced skill namespace; invoke discovered specialists with @agent-name. | No shared manifest-backed brand fields from Pluxx brand today; OpenCode receives functional plugin module, instructions, skills, and package metadata. |
<!-- END GENERATED HOST INSTALL DISCOVERY CAPABILITIES -->

## Lifecycle Matrix

| Host | Install surface | Update flow | Pick up changes | Notes |
|---|---|---|---|---|
| Claude Code | Plugin marketplace or local install path | rerun install flow or update marketplace source | `/reload-plugins` | Claude has the cleanest documented reload story |
| Cursor | local plugin dir / local plugin install | replace local bundle or rerun installer | `Developer: Reload Window` or restart Cursor | official docs support reload-window or restart behavior |
| Codex | local plugin dir plus marketplace catalog entry | replace local bundle or rerun installer | use `Plugins > Refresh` if available in the current UI, otherwise restart Codex | plugin-bundled MCP servers may show on the plugin detail page without appearing in the global MCP servers page |
| OpenCode | local plugin dir, entry wrapper, or config-based plugin loading | replace local bundle or update config/plugin reference | restart or reload OpenCode | the supplied docs do not document a dedicated hot-reload plugin command |

## Host Detection Contract

Pluxx owns reusable install-host detection for the core four. Downstream repos should not reimplement Claude Code, Cursor, Codex, or OpenCode detection just to decide which install command or generated installer affordance to show.

The first detection surface is install planning:

```bash
pluxx install --dry-run --json
```

The JSON includes:

- `hostDetection`: a deterministic core-four map with one result per host
- `hostDetection.detectedHosts`: detected host families in stable core-four order
- `hostDetection.hosts[].evidence`: concrete evidence items
- `targetSelection`: the selected install targets plus whether they came from explicit `--target` flags or `pluxx.config` targets

Detection evidence is intentionally conservative and read-only. It can include:

- `cli`: host command found on `PATH`
- `app`: known app bundle where that host has a practical local app signal
- `user-config`: user-level host config
- `project-config`: project-level host config
- `installed-plugin`: existing host plugin output path or Pluxx-managed local plugin catalog path

`project-config` evidence is reported for explainability, but it does not mark a host as detected by itself. A workspace may contain `.codex/`, `.cursor/`, or `.mcp.json` files even when the corresponding host is not installed on the user's machine. `hostDetection.detectedHosts` and install suggestions require machine-level evidence such as a CLI, app bundle, user config, or existing installed plugin path.

Detection does not prove the host is currently running, authenticated, healthy, trusted, or ready to load a specific plugin. It also does not mutate host config.

Explicit target selection remains authoritative. If a user runs:

```bash
pluxx install --target codex --dry-run --json
```

then `targetSelection.selectedTargets` stays `["codex"]` even if Pluxx also detects Cursor or OpenCode locally. Detection can suggest install targets for planning and generated installer UX, but it does not override `--target` or rewrite host configs just because a host exists.

## Legacy Pre-Ownership Upgrade Rule

Generated release installers are conservative when upgrading installs that predate `pluxx.install-ownership.v1`. They may adopt and replace a legacy install once only when the installed host manifest parses and its plugin/package identity matches the trusted candidate bundle for that same host. The installer still preserves `.pluxx-user.json`, keeps install-scoped locking/staging/rollback behavior, and writes the normal ownership ledger only after a successful commit.

For OpenCode, the same adoption path recognizes Pluxx-generated wrapper files and namespaced skill companions, then migrates them into owned companion ledgers. Unrecognized wrapper or skill collisions still fail closed instead of being overwritten.

Missing, malformed, or mismatched legacy manifests, arbitrary directories, and modified/missing/extra content in already ownership-managed installs remain refusal cases.

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

If the installed Codex bundle also declares plugin-bundled hooks, `doctor --consumer` and `verify-install` now warn when the checked project and user Codex config layers do not enable the canonical `[features].hooks = true` hook flag. These warnings do not mean the bundle is malformed. They mean hook activation is missing a known prerequisite, not that activation is guaranteed once that prerequisite exists. `codex_hooks` is deprecated and should not be treated as the current hook feature key.

Generated `pluxx publish --github-release` Codex curl installers also handle this prerequisite for hook-bearing bundles. The generated `install-codex.sh` detects `.codex-plugin/plugin.json` `hooks` or `hooks/hooks.json`, checks `$CODEX_HOME/config.toml` or `~/.codex/config.toml` by default, prompts interactive users to enable `[features].hooks = true`, supports `PLUXX_CODEX_ENABLE_PLUGIN_HOOKS=1` or `0` for lower-level automation, and prints the exact TOML plus restart/refresh guidance when the user skips the edit. The generated top-level `install.sh -y` front door sets that Pluxx automation approval for Codex while keeping downstream plugin docs free of Codex-specific env flags.

Those consumer checks now also warn when the checked project is not trusted in the user Codex config, because Codex can keep project-local hooks disabled until that trust entry exists. `verify-install` now carries those `doctor --consumer` issue details through directly, so operators see the specific warning code, explanation, and fix instead of only a warning count.

Generated command-hook wrappers are now Node launchers at `hooks/pluxx-hook-command-*.mjs`, not shell-invoked wrapper scripts. They quote plugin-root paths, preserve LF line endings, and discover Bash before running Bash-style hook bodies. On Windows, Git Bash or another `bash` on `PATH` is still required for Bash command hooks; when it is missing, the wrapper prints an explicit Pluxx diagnostic that names the missing Bash requirement and the hook command.

If the installed Codex bundle also includes `.codex/config.generated.toml`, `doctor --consumer` and `verify-install` now inspect the checked project and user `config.toml` layers for matching per-tool `approval_mode = "approve"` stanzas. When those generated approvals have not been merged yet, Pluxx warns explicitly instead of assuming the companion file was actually applied. This is still an external merge step, not plugin-bundled enforcement.

Use `pluxx codex apply --consumer <installed-codex-bundle> --project-root <project>` to make the external companion state explicit. The command registers bundled custom agents under the active `CODEX_HOME/agents/<plugin>/`, applies the canonical `[features].hooks = true` prerequisite for hook-bearing bundles, and merges generated MCP approval stanzas from `.codex/config.generated.toml` into the selected active Codex config. Use `--agents-only` to repair only custom-agent registration. Use `--dry-run` first to preview changes, then reload Codex and rerun `pluxx verify-install --target codex`.

### Codex Companion Lifecycle

Treat Codex as a bundled-plus-external lifecycle, not a single auto-applied plugin surface:

1. Generate/build:
   The bundle can contain `hooks/hooks.json`, `.codex/hooks.generated.json`, `.codex/readiness.generated.json`, `.codex/permissions.generated.json`, and sometimes `.codex/config.generated.toml`.
2. Install/update:
   `pluxx install --target codex` puts the bundle under `~/.codex/plugins/<plugin>`, registers generated custom agents under the active `CODEX_HOME/agents/<plugin>/`, and records their hashes for safe verification and uninstall. Codex may continue reading a separate active cache until refresh or restart.
3. Apply:
   `pluxx codex apply` does not mutate the bundle. It synchronizes custom-agent companion files into the active Codex agent root and merges active-config prerequisites into project or user `config.toml`, mainly `[features].hooks = true` and generated per-tool MCP approval stanzas.
4. Refresh/restart:
   Use `Plugins > Refresh` when available, otherwise restart Codex so the running app picks up the current bundle and active config.
5. Verify:
   `pluxx verify-install --target codex` checks the installed bundle, custom-agent registration hashes and collisions, stale-cache drift, trust/config prerequisites, and companion-merge gaps. It is the operational source of truth after install or apply.

The manual-review boundary still matters:

- `.codex/permissions.generated.json` is advisory, not auto-enforced runtime state.
- `[features].hooks = true` is a prerequisite, not proof that hooks executed.
- Verified bundle shape and merged approvals do not erase current runtime caveats around trust, hook review, and Codex runtime support.

The newest live Codex proof on 2026-05-13 narrowed the remaining gap further:

- Pluxx now emits the official nested Codex hook shape at `hooks/hooks.json`
- the maintained `bun scripts/probe-codex-hooks-runtime.ts --json` probe now runs isolated authenticated headless `codex exec` checks against project-local hooks
- that probe currently reports `headless-response-no-hook` for `hooks-no-trust`, `hooks-trusted`, and `codex-hooks-trusted`: each scenario returns `OK`, each emits `turn.completed`, and none executes the hook side effect
- the maintained `bun scripts/probe-codex-hooks-interactive-runtime.ts --json` probe now checks trusted `UserPromptSubmit` and `SessionStart` scenarios against project-local `.codex/hooks.json`
- on May 13, 2026, that maintained interactive probe timed out with no hook side effect and no `/hooks` review gate for:
  - `user-prompt-submit-codex-hooks-trusted`
  - `user-prompt-submit-hooks-trusted`
  - `session-start-codex-hooks-trusted-unreviewed`
  - `session-start-hooks-trusted-unreviewed`
- the `codex_hooks` prompt scenario emitted `"[features].codex_hooks is deprecated. Use [features].hooks instead."`
- the optional `--include-enable-hooks-cli` probe scenarios sharpen that further: headless `enable-hooks-trusted` still returned `OK` with no hook side effect, and trusted interactive `user-prompt-submit-enable-hooks-trusted` plus `session-start-enable-hooks-trusted` still timed out with no hook side effect and no `/hooks` review gate

Treat that as a runtime activation caveat plus a current runtime/docs drift, not a bundle-shape defect. The remaining live-proof gap is trusted-and-reviewed interactive hook execution, plus whether reviewed hooks can ever fire headlessly under `codex exec`.

If a Codex plugin-owned MCP needs an API key, install-time `userConfig` is the expected Pluxx path. Codex may not provide a global MCP settings form for that plugin-owned secret, so use the generated installer with the real env var exported or rerun it interactively on first setup. Generated `pluxx publish` installer scripts prompt consumers for required secrets, materialize them into the installed bundle, reject obvious placeholder values, and let `doctor --consumer` fail older installs when plaintext prompted secrets or maintained test-secret sentinels still appear in installed bundle files.

For release-installer updates, generated Claude Code, Cursor, Codex, and OpenCode scripts preserve the previous installed `.pluxx-user.json` before replacing the bundle. When a saved value is present, nonempty, and not placeholder-looking, the installer reuses it and prints a short non-secret reuse message. Explicit env vars still win over saved values, and `PLUXX_RECONFIGURE=1` forces the installer to ignore saved config so the user can provide fresh values.

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
- generated release installers use that split to prepare one content-addressed native Node runtime under `~/.pluxx/runtimes/` when the explicit contract declares deterministic inputs including a lockfile, then link each compatible staged host bundle to the same immutable runtime output
- the shared runtime key comes from the compiler-emitted `.pluxx-runtime.json`, every declared input, bootstrap content, plugin namespace, OS, architecture, Node ABI, and the Pluxx runtime-store contract version
- cache generations are read-only, stale locks recover by owner PID, corruption repair switches a stable `current` symlink atomically, and post-commit references drive grace-period cleanup
- if safe shared-runtime reuse is unavailable, including when dependency metadata has no supported lockfile, generated installers log the fallback and run `bootstrap-runtime.sh` in the staged host bundle as before
- Codex local installs now rewrite plugin-owned stdio MCP command/arg paths to absolute installed plugin paths so installed MCP launch does not depend on the active workspace cwd
- source-project runtime payload checks now treat bundled `scripts/`, `assets/`, and `passthrough` payload as one runtime surface when validating local stdio MCP startup paths
- `doctor --consumer` now also reports which known runtime script-role files are actually present in an installed bundle
- `install`, `doctor --consumer`, and `verify-install` now fail installed bundles whose real stdio entry scripts still chain runtime startup back through installer-owned `scripts/check-env.sh`
- `doctor --consumer` and `verify-install` now also smoke-launch installed stdio MCP commands, so an installed bundle fails if its runtime exits immediately instead of only checking file presence

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

When verification passes with warnings, `pluxx verify-install` should still print the concrete issue code, explanation, and fix for those warnings instead of hiding them behind a count.
