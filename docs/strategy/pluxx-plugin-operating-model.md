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

The Pluxx plugin should expose eight core operator skills.

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

### 4. `pluxx-refine-taxonomy`

Job:

- improve skill grouping and workflow shape without breaking managed boundaries

CLI it orchestrates:

- `pluxx agent prepare`
- `pluxx agent prompt taxonomy`
- `pluxx agent run taxonomy --runner ...`
- `pluxx lint`
- `pluxx test`

### 5. `pluxx-rewrite-instructions`

Job:

- improve the generated `INSTRUCTIONS.md` block

CLI it orchestrates:

- `pluxx agent prepare`
- `pluxx agent prompt instructions`
- `pluxx agent run instructions --runner ...`
- `pluxx lint`
- `pluxx test`

### 6. `pluxx-review-scaffold`

Job:

- run a findings-first review before ship

CLI it orchestrates:

- `pluxx agent prepare`
- `pluxx agent prompt review`
- `pluxx agent run review --runner ...`
- optional deterministic checks when they materially improve the review

### 7. `pluxx-build-install`

Job:

- build native outputs and optionally install them locally

CLI it orchestrates:

- `pluxx build`
- `pluxx build --target ...`
- `pluxx install --target ...`
- `pluxx install --trust --target ...` when explicitly needed

### 8. `pluxx-sync-mcp`

Job:

- refresh an MCP-derived scaffold safely

CLI it orchestrates:

- `pluxx sync`
- `pluxx sync --dry-run --json`
- `pluxx doctor`
- `pluxx lint`
- `pluxx test`

## Command surface by host

### Claude Code

Expose namespaced explicit commands:

- `/pluxx:import-mcp`
- `/pluxx:migrate-plugin`
- `/pluxx:validate-scaffold`
- `/pluxx:refine-taxonomy`
- `/pluxx:rewrite-instructions`
- `/pluxx:review-scaffold`
- `/pluxx:build-install`
- `/pluxx:sync-mcp`

### Cursor

Expose the same explicit command set where plugin commands are supported:

- `/pluxx:import-mcp`
- `/pluxx:migrate-plugin`
- `/pluxx:validate-scaffold`
- `/pluxx:refine-taxonomy`
- `/pluxx:rewrite-instructions`
- `/pluxx:review-scaffold`
- `/pluxx:build-install`
- `/pluxx:sync-mcp`

### OpenCode

Expose the same workflow command set in OpenCode’s native command surface:

- `/pluxx:import-mcp`
- `/pluxx:migrate-plugin`
- `/pluxx:validate-scaffold`
- `/pluxx:refine-taxonomy`
- `/pluxx:rewrite-instructions`
- `/pluxx:review-scaffold`
- `/pluxx:build-install`
- `/pluxx:sync-mcp`

### Codex

Do **not** pretend plugin slash-command parity exists.

Use:

- the skill pack
- strong starter prompts
- interface metadata
- AGENTS guidance

Equivalent operator surface:

- `pluxx-import-mcp`
- `pluxx-migrate-plugin`
- `pluxx-validate-scaffold`
- `pluxx-refine-taxonomy`
- `pluxx-rewrite-instructions`
- `pluxx-review-scaffold`
- `pluxx-build-install`
- `pluxx-sync-mcp`

## CLI resolution model

When the plugin instructions say `pluxx ...`, that is the logical command, not a hardcoded binary assumption.

Resolve it in this order:

1. `pluxx` on `PATH`
2. `npx @orchid-labs/pluxx`

If the npm path fails because Bun is missing:

- say so directly
- ask the user to install Bun
- do not silently invent a second runtime path inside the plugin

Development-only path:

- `bun ./bin/pluxx.js ...`

That path is for repo development, not the end-user plugin contract.

## Why this model is right

This gives us:

- one deterministic engine
- one canonical cross-host plugin source
- one native operator surface per host
- no duplicate compiler implementations

That is the architecture we should optimize from here.

## Current gaps vs target

The current dogfood/plugin surface started narrower than this spec.

The target surface above is the one Pluxx should converge on:

- full operator skill pack
- explicit command parity where hosts support it
- Codex skill-first orchestration
- one CLI resolution contract across all hosts

This is the right model for a real Pluxx plugin, not just a dogfood artifact.
