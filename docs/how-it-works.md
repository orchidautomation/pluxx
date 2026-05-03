# How pluxx Works

## The Problem

Every AI coding tool has its own plugin format. If you want your tool inside Claude Code, Cursor, Codex, OpenCode, and GitHub Copilot, you need to maintain separate manifests, MCP configs, hooks, and rules for each one.

```
Claude Code wants: optional .claude-plugin/plugin.json + .mcp.json or inline MCP config + CLAUDE.md + hooks/hooks.json or inline/settings hooks
Cursor wants:      .cursor-plugin/plugin.json + mcp.json + AGENTS.md + rules/ + hooks/hooks.json (+ host-level .cursor/* config)
Codex wants:       .codex-plugin/plugin.json + skills/ + optional .mcp.json / .app.json + AGENTS.md / AGENTS.override.md + bundled hooks/hooks.json (with .codex/hooks.json still relevant as a documented config path and feature-gate caveat)
OpenCode wants:    opencode.json + a code-first JS/TS plugin module + .opencode/plugins/ or ~/.config/opencode/plugins/ + AGENTS.md / CLAUDE.md fallback + config-driven MCP/permissions
```

Each platform also has its own validation and lifecycle behavior. Some of that is official-doc-backed, some of it is conservative Pluxx compatibility policy, and all of it is easy to get wrong by hand. Claude has `/reload-plugins`, Cursor has reload-window behavior, Codex separates plugin bundle updates from skill discovery, and OpenCode is much more config/runtime-driven than a manifest-only host.

## The Solution

pluxx is the source-of-truth compiler and maintenance layer for host-native agent plugins.

The core job is not just "generate bundles once." The core job is:

- import an MCP or migrate an existing plugin into one maintained source project
- turn a raw MCP into a workflow-driven native plugin surface instead of a bare tool dump
- compile truthful native outputs for Claude Code, Cursor, Codex, and OpenCode
- verify the installed host-visible state, not just `dist/`
- sync later when the MCP or plugin surface changes without throwing away curated edits

You can start from a hand-authored plugin source project or import an MCP and let Pluxx scaffold the source project for you. MCP-backed plugins are the sharpest wedge, not a hard requirement.

If you want the shortest path from MCP to usable plugin, `pluxx autopilot` wraps that flow into one command: import the MCP, shape it into workflow-oriented plugin surfaces, and produce native outputs you can test locally.

The product now has two intentional layers:

- `Core`: deterministic import, scaffolding, validation, build, install, verify, and sync
- `Agent`: prompt packs and context packs for Claude Code / Codex to semantically refine the scaffold

Pluxx is intentionally the authoring and maintenance layer, not the MCP hosting layer. You still deploy and operate your MCP backend service. The later trust and distribution layer matters strategically, but it is not the current build center.

## What Is Already Proven

The most important shift in the repo is that Pluxx is no longer just describing how this should work.

It now has real proof surfaces:

- [Self-hosted core-four proof](./pluxx-self-hosted-core-four-proof.md)
  - the canonical `example/pluxx` source project rebuilt, installed, and `verify-install` checked across Claude Code, Cursor, Codex, and OpenCode
- [Docs Ops core-four proof](./docs-ops-core-four-proof.md)
  - the flagship `example/docs-ops` source project rebuilt, installed, and `verify-install` checked across Claude Code, Cursor, Codex, and OpenCode
- [Orchid Docs Ops Codex walkthrough](./orchid-docs-ops-codex-walkthrough.md)
  - one maintained `docs-ops` source project compiled into a real Codex plugin and used against Orchid's live Docsalot MCP
- [Orchid Accordion before/after rewrite](../example/docs-ops/demo-rewrites/orchid-components-accordion.after.md)
  - a concrete rewrite artifact from the flagship docs workflow example
- [Exa Research Example](./exa-research-example.md)
  - a clean-room Exa-style research operator pack with specialist agents, richer brand metadata, and real build/install/verify proof across Claude Code, Cursor, Codex, and OpenCode
- [Core-four provider docs audit](./core-four-provider-docs-audit.md)
  - first-party docs normalized into one capability and lifecycle truth set
- [Firecrawl connector docs-ingestion proof](./strategy/firecrawl-connector-docs-ingestion-proof.md)
  - the first real Firecrawl-backed comparison on the current fixture set
- [Docs-ingestion fixture snapshot](./strategy/docs-ingestion-fixture-eval.md)
  - the keyed local harness rerun with `baseline`, `local`, and `firecrawl` recorded side by side
- [Docs-ingestion scaffold before/after demo](./strategy/docs-ingestion-scaffold-before-after.md)
  - a committed Sumble scaffold delta showing exactly what sourced Firecrawl context changes in generated scaffold files

The main docs-ingestion work still open is improving the weak fixtures and packaging the captured proof into cleaner public-facing demos.

See [Agent Mode](./agent-mode.md) for the semantic-authoring layer.
See [Architecture](./architecture.md) for the system view and [Customer Journey](./customer-journey.md) for the end-to-end user path.
See [Practical handbook](./practical-handbook.md) for the operational command-by-command workflow.
See [Canonical permissions model](./permissions-canonical-model.md) for the current policy shape, generated mappings, and downgrade behavior.
See [Core primitives](./core-primitives.md) for the tightened product scope.
See [Core-Four Install And Update Lifecycle](./core-four-install-update-lifecycle.md) for the user-facing install, update, and reload matrix.
See [Roadmap](./roadmap.md) for the current milestones, dependencies, and execution queue.

## What Pluxx Treats As Core

The canonical authoring model is:

- `skills`
- `instructions`
- `mcp`
- `userConfig`
- `commands`
- `agents`
- `hooks`
- `permissions`
- `brand`
- `assets/scripts`
- `taxonomy`

That is the layer Pluxx should make excellent across Claude Code, Cursor, Codex, and OpenCode.

## What Pluxx Does Not Model Yet

These are real platform features, but they are not the common path Pluxx needs to perfect first:

- `outputStyles`
- `lspServers`
- `bin/`
- `monitors`
- `channels`
- `apps` abstraction
- plugin data-dir abstraction
- statuslines
- themes / keybindings
- sandbox and other user/admin runtime policy

Those should be documented and revisited later, not treated as the core product contract today.

## Runtime Today

Pluxx is published on npm as `@orchid-labs/pluxx`, and both the published CLI and normal maintainer flows now run on Node `>=18`.

The important practical distinction is:

- the CLI is the real execution engine
- the Pluxx plugin is a UX layer on top of that engine
- the npm package exists publicly as `@orchid-labs/pluxx`

So today, the real invocation paths are:

- from npm: `npx @orchid-labs/pluxx ...`
- from this repo after a build: `node ./bin/pluxx.js ...`
- from another workspace with a local dependency/link: `npx pluxx ...`

What is **not** true yet:

- `npx pluxx ...` is not the public install path, because the published package name is scoped as `@orchid-labs/pluxx`
- `node ./bin/pluxx.js ...` from this repo still expects a prior `npm run build`

## How Pluxx Works Today

Pluxx now has three layers:

1. **Deterministic core**
2. **Optional semantic runner layer**
3. **Per-host compilers**

That gives one stable source project and multiple honest host outputs.

### 1. Deterministic core

This is the mechanical layer. It handles:

- source scaffold generation
- MCP import and introspection when present
- migration from existing host-native plugin surfaces
- taxonomy persistence
- install/runtime config modeling
- validation
- build
- install
- install verification
- sync

This layer should always be able to produce a valid plugin project even if no AI runner is used.

### 2. Optional semantic runner layer

This is the refinement layer. It improves:

- skill naming and grouping
- shared instructions
- scaffold review
- command copy where relevant

Runners today include:

- `claude`
- `cursor`
- `codex`
- `opencode`

Pluxx does **not** run its own model stack. It prepares context and prompt packs, then hands the work to the selected host runner.

### 3. Per-host compilers

Pluxx takes one source project and emits host-specific bundles for:

- Claude Code
- Cursor
- Codex
- OpenCode

The compiler layer is explicitly honest about host differences instead of pretending every host has the same plugin surface.

## The Actual Flow

The current end-to-end flow is:

1. start from an MCP import, an existing plugin migration, or a hand-authored source plugin
2. generate or refine the source scaffold
3. optionally refine semantics with a runner
4. validate the result with `validate`, `doctor`, and `lint`
5. build host bundles
6. install one host locally
7. verify the installed host-visible state with `verify-install`
8. if MCP-backed, sync later when the MCP changes

That means Pluxx is both:

- a human-guided CLI workflow
- and a headless automation surface for agents

## Interactive vs Headless

### Interactive

Use interactive mode when a human is driving the workflow and wants a guided path:

```bash
npx @orchid-labs/pluxx init my-plugin
npx @orchid-labs/pluxx init --from-mcp https://example.com/mcp
npx @orchid-labs/pluxx autopilot
```

This path is for:

- guided prompts
- safer first-run authoring
- a more curated UX

### Headless

Use headless mode when an agent or CI job is driving:

```bash
npx @orchid-labs/pluxx init \
  --from-mcp https://example.com/mcp \
  --yes \
  --name acme \
  --display-name "Acme" \
  --author "Acme" \
  --targets claude-code,cursor,codex,opencode
```

```bash
npx @orchid-labs/pluxx autopilot \
  --from-mcp https://example.com/mcp \
  --runner codex \
  --mode standard \
  --yes \
  --name acme \
  --display-name "Acme" \
  --author "Acme"
```

This is what makes Pluxx usable by other agents even if they have **not** installed the Pluxx plugin in their host.

## CLI vs Plugin

The CLI is the system of record.

The Pluxx plugin exists to make Pluxx easier to use from inside host agents, but it is not required for automation.

So:

- agents can call the CLI directly in a shell
- humans can use the CLI directly
- host plugins provide better discoverability and nicer in-agent entrypoints

That means the plugin is an accelerator, not a dependency.

## Import Auth vs Runtime Auth

One of the biggest architectural changes is that Pluxx now treats these separately:

- **import auth**
- **runtime auth**

This matters because some MCPs can be introspected one way but need a different runtime auth model in the host.

Examples:

- API-key/header-based MCPs can use direct runtime config in the generated bundle
- OAuth-first MCPs can still be imported headlessly, while Claude/Cursor runtime auth is delegated to the platform

This is why `userConfig` is now a core primitive and why Pluxx no longer assumes that every MCP should be bundled with a static bearer-token runtime model.

## Source Project vs Output Bundles

Pluxx maintains one editable source project:

- `pluxx.config.ts`
- `INSTRUCTIONS.md`
- `skills/`
- `commands/`
- `agents/`
- `.pluxx/mcp.json`
- `.pluxx/taxonomy.json`
- scripts/assets as needed

Then it compiles that source into host bundles under `dist/`.

This is the key contract:

- edit the source project
- never hand-edit `dist/`
- rebuild when you want fresh bundles

## Skills vs Commands

Pluxx now treats these as related but different:

- `skills` are the universal semantic layer
- `commands` are host-native entrypoints where the host supports them

Current host reality:

- **Claude Code**: skills + plugin commands
- **Cursor**: skills + commands
- **OpenCode**: skills + commands
- **Codex**: `@plugin` + skills, while `/` remains native Codex only

So Pluxx normalizes the shared semantic layer, then compiles commands only where they make sense.

## What The End Result Looks Like

The result of a successful Pluxx run is:

- one maintainable plugin source repo
- validated host bundles
- local installable outputs for Claude Code, Cursor, Codex, and OpenCode
- a project that can be refreshed later with `sync --from-mcp`

This is why the right short description is:

> Pluxx is a deterministic MCP-to-plugin compiler with an optional AI semantic layer.

```
pluxx.config.ts          ← You write one config
       │
       ▼
  ┌─────────┐
  │  Parse   │            Zod schema validation
  └────┬────┘
       │
       ▼
  ┌──────────┐
  │  Lint    │            47 checks across all platforms
  └────┬────┘
       │
       ▼
  ┌────────────┐
  │ Generate  │            11 platform-specific generators
  └─┬──┬──┬──┬┘
    │  │  │  │
    ▼  ▼  ▼  ▼
  Claude  Cursor  Codex  OpenCode  +7 more
  Code
```

## How You Use It

### Step 1: Define your plugin

You can either author from scratch or scaffold directly from a live MCP server:

```bash
$ npx @orchid-labs/pluxx init --from-mcp https://example.com/mcp
```

That import flow supports:

- remote HTTP MCP servers
- legacy SSE MCP servers via `--transport sse`
- local stdio MCP commands such as `npx @orchid-labs/pluxx init --from-mcp "npx -y -p @acme/mcp acme-mcp"`

A common production transition is:

1. Start from local stdio MCP during development.
2. Build and validate the generated plugin repo.
3. Repoint sync to the deployed remote MCP endpoint: `npx @orchid-labs/pluxx sync --from-mcp https://mcp.example.com/mcp`.

That flow introspects the server, reads its tool metadata, and drafts workflow-oriented skills instead of mirroring raw tool names one-to-one whenever the tool set supports a clearer grouping.

For automation or CI-style setup, the same flow supports headless flags:

```bash
$ npx @orchid-labs/pluxx init --from-mcp https://example.com/mcp --yes --name acme --display-name "Acme" --author "Acme" --targets claude-code,codex --grouping workflow --hooks safe --json
```

Generated `INSTRUCTIONS.md` and MCP-derived `SKILL.md` files now use a mixed-ownership format: Pluxx owns the generated block, and a separate custom section is preserved across `pluxx sync --from-mcp`.

Those generated skills also include deterministic example requests based on the discovered tool names and required input fields, so the scaffold is immediately usable before any manual or AI-assisted rewriting.

```typescript
// pluxx.config.ts
import { definePlugin } from '@orchid-labs/pluxx'

export default definePlugin({
  name: 'my-plugin',
  description: 'What your plugin does',
  author: { name: 'Your Name' },

  // MCP server (auth format auto-translated per platform)
  mcp: {
    'my-server': {
      url: 'https://api.example.com/mcp',
      auth: { type: 'bearer', envVar: 'API_KEY' },
    },
  },

  // Skills (Agent Skills standard, shared across all platforms)
  skills: './skills/',

  // Hooks (mapped to each platform's event system)
  hooks: {
    sessionStart: [{
      command: '${PLUGIN_ROOT}/scripts/setup.sh',
    }],
  },

  // Brand metadata (used by platforms that support it)
  brand: {
    displayName: 'My Plugin',
    color: '#6366f1',
    icon: './assets/icon.svg',
  },

  // Target platforms
  targets: ['claude-code', 'cursor', 'codex', 'opencode'],
})
```

### Step 2: Build

```bash
$ npx @orchid-labs/pluxx build

Building for: claude-code, cursor, codex, opencode, github-copilot, openhands, warp

  dist/claude-code/    .claude-plugin/plugin.json, .mcp.json, CLAUDE.md, hooks/hooks.json
  dist/cursor/         .cursor-plugin/plugin.json, mcp.json, hooks/hooks.json, rules/
  dist/codex/          .codex-plugin/plugin.json, .mcp.json, AGENTS.md, interface metadata
  dist/opencode/       package.json, runtime plugin module, commands/
  ...

Done! 85 files generated across 11 platforms.
```

### Step 3: Lint

```bash
$ npx @orchid-labs/pluxx lint

  ✓ Plugin name is valid kebab-case
  ✓ Version follows semver format
  ✓ Skills directory found with 3 skills

  ⚠ warning: Description will be truncated in claude-code (display limit: 250)
  ✗ error: Description exceeds codex max of 1024 characters
  ✗ error: Skill name "My-Skill" doesn't match directory "my-skill" (required by cursor, codex, cline)
  ⚠ warning: Hook event "afterFileEdit" (as "AfterFileEdit") is not a recognized Claude Code hook event

  2 errors, 2 warnings
```

### Step 4: Diagnose and test locally

```bash
$ npx @orchid-labs/pluxx doctor

SUCCESS node-version Supported Node runtime detected
SUCCESS config-valid Config parsed successfully
WARNING hooks-trust-required Hook commands require install trust

Doctor summary: 0 error(s), 1 warning(s), 0 info message(s)
```

`pluxx doctor` is read-only. It checks Node runtime health for the published CLI, config validity, configured paths, MCP auth/transport shape, scaffold metadata, and trust advisories.

```bash
$ npx @orchid-labs/pluxx test

Config: my-plugin@0.1.0
Lint: 0 error(s), 0 warning(s)
Build: claude-code, cursor, codex, opencode -> ./dist
PASS claude-code: .claude-plugin/plugin.json
PASS cursor: .cursor-plugin/plugin.json
PASS codex: .codex-plugin/plugin.json
PASS opencode: package.json
pluxx test passed.
```

### Step 5: Install locally

```bash
$ npx @orchid-labs/pluxx install --target claude-code

  claude-code -> claude plugin install my-plugin@pluxx-local-my-plugin

Installed 1 plugin(s). Reload or restart your tools to pick them up.
Claude Code note: if Claude is already open, run /reload-plugins in the session to pick up the new install.
```

### Step 6: Sync later

```bash
$ npx @orchid-labs/pluxx sync --dry-run --json
```

The sync flow refreshes MCP-derived scaffold content while preserving the custom sections in generated Markdown files.

### Step 7: Hand it to the host agent

```bash
$ npx @orchid-labs/pluxx autopilot --from-mcp https://example.com/mcp --runner codex --yes --name acme --display-name "Acme" --author "Acme"
```

Or step through Agent Mode manually:

```bash
$ npx @orchid-labs/pluxx agent prepare
$ npx @orchid-labs/pluxx agent prompt taxonomy
$ npx @orchid-labs/pluxx agent run taxonomy --runner claude
$ npx @orchid-labs/pluxx agent run taxonomy --runner cursor
$ npx @orchid-labs/pluxx agent run taxonomy --runner codex
```

That generates:

- `.pluxx/agent/context.md`
- `.pluxx/agent/plan.json`
- `.pluxx/agent/*-prompt.md`

The intent is simple: Pluxx owns the structure and write boundaries, while the host agent uses those files to refine the generated scaffold without drifting into auth wiring or platform config. `pluxx agent run` is just a thin adapter over that same pack. The current supported runners are `claude`, `cursor`, `opencode`, and `codex`.

If you want durable Agent Mode customization, create `pluxx.agent.md` at the project root. Pluxx will pull extra context paths, product/setup hints, grouping guidance, and prompt additions from that file without requiring edits to generated `.pluxx/agent/*.md` files.

For complex MCPs, steer prompt behavior directly in that file:

- `## Taxonomy Guidance`: avoid misleading/lexical labels and merge tiny singleton/admin-only skills unless justified.
- `## Instructions Guidance`: enforce branded product wording over raw MCP identifiers and clarify setup/admin/account/runtime boundaries.

### Step 8: Ship

Pluxx prepares the correct plugin bundles and manifests, then your team ships them through your own channels.

Typical flow:

1. Commit/version the generated plugin source repo.
2. Build bundles with `npx @orchid-labs/pluxx build`.
3. Publish/share those bundles through release artifacts or platform-specific distribution paths.

Pluxx does not deploy the MCP backend service; it keeps plugin distribution and maintenance consistent as that backend evolves.

## What pluxx Handles

### MCP Auth Translation

You write one auth config. pluxx generates the correct format for each platform:

| Platform | Generated auth format |
|----------|----------------------|
| Claude Code | `"headers": { "Authorization": "Bearer ${API_KEY}" }` |
| Codex | `"bearer_token_env_var": "API_KEY"` or `"env_http_headers": { "X-API-Key": "API_KEY" }"` |
| Cursor | `"headers": { "Authorization": "Bearer ${API_KEY}" }` |
| OpenCode | Env var validation in generated TypeScript wrapper |

### Hook Event Translation

Pluxx maps canonical hook names for plugin-packaged hook targets and validates Codex compatibility for bundled Codex hook config.

| Your config | Claude Code | Cursor | Codex bundled hooks |
|-------------|-------------|--------|------------------------|
| `sessionStart` | `SessionStart` | `sessionStart` | `SessionStart` |
| `preToolUse` | `PreToolUse` | `preToolUse` | `PreToolUse` |
| `beforeSubmitPrompt` | `UserPromptSubmit` | `beforeSubmitPrompt` | `UserPromptSubmit` |

### Permissions Compilation

Pluxx compiles canonical `permissions.{allow,ask,deny}` into each primary target with explicit fallback behavior:

| Platform | Output shape | Notes |
|----------|--------------|-------|
| Claude Code | generated `hooks/pluxx-permissions.mjs` + `PreToolUse` hook wiring | Fine-grained rule matching via hook decisions |
| Cursor | generated `hooks/pluxx-permissions.mjs` + `preToolUse`/`beforeShellExecution`/`beforeReadFile`/`beforeMCPExecution` wiring | Fine-grained rule matching via hook decisions |
| Codex | `.codex/permissions.generated.json` | External enforcement only; mirror rules into Codex policy/hooks |
| OpenCode | tool-level `config.permission` map in generated wrapper | Selector-level precision is downgraded to tool-level permissions |

### Instructions Generation

Your single `INSTRUCTIONS.md` becomes the right native instruction surface for each platform:

| Platform | Generated instruction surface |
|----------|-----------------------------|
| Claude Code | `CLAUDE.md` |
| Cursor | `AGENTS.md` + `rules/*.mdc` |
| Codex | `AGENTS.md` |
| OpenCode | runtime instruction injection in the generated plugin wrapper |
| Warp | `AGENTS.md` |
| Gemini CLI | `GEMINI.md` |
| Roo Code | `.roorules` |
| Cline | `.clinerules` |
| AMP | `AGENT.md` |

The important rule is that Pluxx keeps one instruction source of truth and compiles it into the strongest honest native surface per host. It does not pretend there is one universal output filename.

### 47 Lint Checks

pluxx catches platform-specific gotchas before you ship:

- Claude Code silently truncates descriptions at 250 characters
- Cursor and Cline require skill names to match their directory names
- Claude Code hook events must be PascalCase (26 valid events)
- Manifest paths must start with `./` and cannot contain `../`
- Plugin directories must be at root, not inside `.claude-plugin/`
- Pluxx also applies conservative compatibility heuristics for some host-specific metadata where official docs are thinner than the real product surface
- And 40 more checks across all 11 platforms

## The Next Product Delta

The most important remaining gaps from the tightened extension-systems review are:

1. `userConfig`
2. build-time target cap validation
3. publish / marketplace generation
4. deeper MCP protocol support beyond `tools/list`
5. portable agent / subagent delegation

That is the real delta from the current strong engine to the mature cross-host plugin product.

## Supported Platforms

The generated source of truth for support status and verification coverage is [docs/compatibility.md](./compatibility.md).

| Platform | Manifest | Skills | MCP | Hooks | Rules |
|----------|:--------:|:------:|:---:|:-----:|:-----:|
| Claude Code | `.claude-plugin/` | Yes | Yes | Yes | CLAUDE.md |
| Cursor | `.cursor-plugin/` | Yes | Yes | Yes | .mdc + AGENTS.md |
| Codex | `.codex-plugin/` | Yes | Yes | External (`.codex/hooks.json`) | AGENTS.md |
| OpenCode | JS/TS module | Yes | Yes | Yes | AGENTS.md |
| GitHub Copilot | `.claude-plugin/` | Yes | Yes | Yes | AGENTS.md |
| OpenHands | `.plugin/` | Yes | Yes | Yes | AGENTS.md |
| Warp | Skills only | Yes | Yes | No | AGENTS.md |
| Gemini CLI | `gemini-extension.json` | Yes | Yes | Yes | GEMINI.md |
| Roo Code | Config files | Yes | Yes | No | .roorules |
| Cline | Config files | Yes | Yes | Yes | .clinerules |
| AMP | Config files | Yes | Yes | Yes | AGENT.md |
