# Pluxx Plugin Operating Model

This is the concrete operating spec for the Pluxx plugin itself.

It answers three questions:

1. what exact skills should the plugin expose?
2. what explicit commands should exist per host?
3. how should the plugin resolve and invoke the CLI underneath?

## The short answer

Yes: the Pluxx plugin should be built from skills.

Yes: it should orchestrate the CLI.

No: it should not become a second compiler or a hidden runtime fork.

## The product split

There are three distinct things here:

### 1. Pluxx engine

This is the deterministic system of record:

- `init`
- `migrate`
- `doctor`
- `lint`
- `eval`
- `build`
- `test`
- `install`
- `sync`
- `autopilot`

Today that engine is the `@orchid-labs/pluxx` CLI.

### 2. Pluxx plugin

This is the host-native operator surface.

Its job is to:

- expose the right workflows as skills
- expose explicit commands where the host supports them
- give users polished prompts, metadata, and entrypoints
- route into the deterministic CLI underneath

### 3. Pluxx plugin source project

This is the canonical cross-host source for the plugin itself.

Today that should be:

- `example/pluxx`

## Recommended skill set

The Pluxx plugin should expose twelve core operator skills.

### 1. `pluxx-import-mcp`

Job:

- bring a remote or stdio MCP into a first-pass Pluxx project

CLI it orchestrates:

- `pluxx init --from-mcp ...`
- `pluxx doctor`
- `pluxx lint`
- `pluxx test`

### 2. `pluxx-migrate-plugin`

Job:

- bring an existing Claude Code, Cursor, Codex, or OpenCode plugin into Pluxx

CLI it orchestrates:

- `pluxx migrate <path>`
- `pluxx doctor`
- `pluxx lint`
- `pluxx eval`
- `pluxx test`

### 3. `pluxx-validate-scaffold`

Job:

- run the deterministic health and quality pass before deeper edits or shipping

CLI it orchestrates:

- `pluxx doctor`
- `pluxx lint`
- `pluxx eval`
- `pluxx test`

### 4. `pluxx-prepare-context`

Job:

- ingest website docs, product docs, and local context before semantic refinement

CLI it orchestrates:

- `pluxx agent prepare`

### 5. `pluxx-refine-taxonomy`

Job:

- improve skill grouping and workflow shape without breaking managed boundaries

CLI it orchestrates:

- `pluxx agent prepare`
- `pluxx agent prompt taxonomy`
- `pluxx agent run taxonomy --runner ...`
- `pluxx lint`
- `pluxx test`

### 6. `pluxx-rewrite-instructions`

Job:

- improve the generated `INSTRUCTIONS.md` block

CLI it orchestrates:

- `pluxx agent prepare`
- `pluxx agent prompt instructions`
- `pluxx agent run instructions --runner ...`
- `pluxx lint`
- `pluxx test`

### 7. `pluxx-review-scaffold`

Job:

- run a findings-first review before ship

CLI it orchestrates:

- `pluxx agent prepare`
- `pluxx agent prompt review`
- `pluxx agent run review --runner ...`
- optional deterministic checks when they materially improve the review

### 8. `pluxx-bootstrap-runtime`

Job:

- install, upgrade, or validate the local Pluxx CLI runtime before deeper workflows

CLI it orchestrates:

- `pluxx --version`
- `pluxx upgrade`
- `pluxx upgrade --version ...`
- `npm install -g @orchid-labs/pluxx@latest`
- `npx @orchid-labs/pluxx --version` as the fallback check

### 9. `pluxx-build-install`

Job:

- build native outputs and optionally install them locally

CLI it orchestrates:

- `pluxx build`
- `pluxx build --target ...`
- `pluxx install --target ...`
- `pluxx install --trust --target ...` when explicitly needed

### 10. `pluxx-verify-install`

Job:

- prove that an installed host bundle is actually visible and healthy

CLI it orchestrates:

- `pluxx verify-install --target ...`
- `pluxx doctor --consumer` when the installed state still looks wrong

### 11. `pluxx-troubleshoot-install`

Job:

- diagnose why a local install still looks wrong after build or install

CLI it orchestrates:

- `pluxx verify-install --target ...`
- `pluxx doctor --consumer ...`

### 12. `pluxx-sync-mcp`

Job:

- refresh an MCP-derived scaffold safely

CLI it orchestrates:

- `pluxx sync`
- `pluxx sync --dry-run --json`
- `pluxx doctor`
- `pluxx lint`
- `pluxx test`

### 13. `pluxx-refine-plugin`

Job:

- take a valid scaffold and make it read and translate like a serious product

CLI it orchestrates:

- `pluxx agent prepare ...` when context is weak
- `pluxx lint`
- `pluxx eval`
- `pluxx test`
- selectively the lower-level refinement workflows when they materially sharpen the pass

### 14. `pluxx-autopilot`

Job:

- run the one-shot import, refinement, and verification path

CLI it orchestrates:

- `pluxx autopilot --from-mcp ...`

### 15. `pluxx-prove-plugin`

Job:

- combine structural proof, install proof, and behavioral proof into one operator path

CLI it orchestrates:

- `pluxx doctor`
- `pluxx lint`
- `pluxx eval`
- `pluxx test`
- `pluxx build`
- `pluxx install --target ...`
- `pluxx verify-install --target ...`
- `pluxx doctor --consumer ...`
- `pluxx test --install --trust --behavioral --target ...`

### 16. `pluxx-translate-hosts`

Job:

- explain preserve, translate, degrade, and drop behavior across the core four

CLI it orchestrates:

- `pluxx lint`
- `pluxx build --target claude-code cursor codex opencode`

### 17. `pluxx-publish-plugin`

Job:

- package the current plugin for release distribution

CLI it orchestrates:

- `pluxx publish`

## Command surface by host

### Claude Code

Expose namespaced explicit commands:

- `/pluxx:autopilot`
- `/pluxx:bootstrap-runtime`
- `/pluxx:build-install`
- `/pluxx:import-mcp`
- `/pluxx:migrate-plugin`
- `/pluxx:prepare-context`
- `/pluxx:prove-plugin`
- `/pluxx:publish-plugin`
- `/pluxx:refine-plugin`
- `/pluxx:validate-scaffold`
- `/pluxx:refine-taxonomy`
- `/pluxx:rewrite-instructions`
- `/pluxx:review-scaffold`
- `/pluxx:sync-mcp`
- `/pluxx:troubleshoot-install`
- `/pluxx:translate-hosts`
- `/pluxx:verify-install`

### Cursor

Expose the same explicit command set where plugin commands are supported:

- `/pluxx:autopilot`
- `/pluxx:bootstrap-runtime`
- `/pluxx:build-install`
- `/pluxx:import-mcp`
- `/pluxx:migrate-plugin`
- `/pluxx:prepare-context`
- `/pluxx:prove-plugin`
- `/pluxx:publish-plugin`
- `/pluxx:refine-plugin`
- `/pluxx:validate-scaffold`
- `/pluxx:refine-taxonomy`
- `/pluxx:rewrite-instructions`
- `/pluxx:review-scaffold`
- `/pluxx:sync-mcp`
- `/pluxx:troubleshoot-install`
- `/pluxx:translate-hosts`
- `/pluxx:verify-install`

### OpenCode

Expose the same workflow command set in OpenCode’s native command surface:

- `/pluxx:autopilot`
- `/pluxx:bootstrap-runtime`
- `/pluxx:build-install`
- `/pluxx:import-mcp`
- `/pluxx:migrate-plugin`
- `/pluxx:prepare-context`
- `/pluxx:prove-plugin`
- `/pluxx:publish-plugin`
- `/pluxx:refine-plugin`
- `/pluxx:validate-scaffold`
- `/pluxx:refine-taxonomy`
- `/pluxx:rewrite-instructions`
- `/pluxx:review-scaffold`
- `/pluxx:sync-mcp`
- `/pluxx:troubleshoot-install`
- `/pluxx:translate-hosts`
- `/pluxx:verify-install`

### Codex

Do **not** pretend plugin slash-command parity exists.

Use:

- the skill pack
- strong starter prompts
- interface metadata
- AGENTS guidance

Equivalent operator surface:

- `pluxx-autopilot`
- `pluxx-bootstrap-runtime`
- `pluxx-build-install`
- `pluxx-import-mcp`
- `pluxx-migrate-plugin`
- `pluxx-prepare-context`
- `pluxx-prove-plugin`
- `pluxx-publish-plugin`
- `pluxx-refine-plugin`
- `pluxx-translate-hosts`
- `pluxx-validate-scaffold`
- `pluxx-refine-taxonomy`
- `pluxx-rewrite-instructions`
- `pluxx-review-scaffold`
- `pluxx-sync-mcp`
- `pluxx-troubleshoot-install`
- `pluxx-verify-install`

## CLI resolution model

When the plugin instructions say `pluxx ...`, that is the logical command, not a hardcoded binary assumption.

Resolve it in this order:

1. `pluxx` on `PATH`
2. `npx @orchid-labs/pluxx`

If the npm path fails because Node or package resolution is missing:

- say so directly
- ask the user to install Node 18+ or fix the package install path
- do not silently invent a second runtime path inside the plugin

Development-only path:

- `node ./bin/pluxx.js ...` after `npm run build`

That path is for repo development, not the end-user plugin contract.

## Why this model is right

This gives us:

- one deterministic engine
- one canonical cross-host plugin source
- one native operator surface per host
- no duplicate compiler implementations

That is the architecture we should optimize from here.

## Current state vs target

The maintained source project and repo-local Codex dogfood surface now match this lifecycle more closely:

- full operator skill pack
- explicit command parity where hosts support it
- Codex skill-first orchestration
- one CLI resolution contract across all hosts

The remaining work is no longer workflow coverage.

It is:

- repeated proof across the core four
- keeping the source project and dogfood bundle aligned
- polishing install/update/release UX
