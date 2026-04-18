# Practical Handbook

This is the operational handbook for Pluxx.

Use it when you want the practical answer to:

- what Pluxx is for
- which command to run next
- what Pluxx manages versus what you own
- how Agent Mode fits in
- how install, build, sync, and publish actually work

If you want the exact authoring walkthrough, start with [Create a Pluxx plugin](./create-a-pluxx-plugin.md).
If you want the operator guide for using Pluxx inside Claude/Codex/Cursor/OpenCode, use [Use Pluxx in host agents](./use-pluxx-in-host-agents.md).
If you want the tighter product scope for what Pluxx should model versus defer, read [Core primitives](./core-primitives.md).

## What Pluxx Is

Pluxx is the plugin authoring and maintenance layer for cross-host plugins.

The strongest fit today is an MCP-backed plugin, but MCP is not required.

If your plugin wraps an MCP server, bring a raw server:

- remote HTTP
- legacy SSE
- local stdio

Pluxx turns that into a maintainable plugin project that can generate bundles for:

- Claude Code
- Cursor
- Codex
- OpenCode

Pluxx does **not** build or deploy the MCP backend itself.

If you do not have an MCP, initialize a plugin source project and author the skills, instructions, hooks, and metadata directly.

## The Two Product Layers

### Core

Core is deterministic. It owns:

- MCP introspection
- config generation
- baseline skills and instructions
- `doctor`
- `lint`
- `build`
- `install`
- `sync`
- `test`

### Agent

Agent Mode refines the scaffold semantically. It owns:

- context packs
- prompt packs
- headless runner orchestration for Codex, Claude, Cursor, and OpenCode
- safe write boundaries for generated content

Pluxx does not run its own model stack. It uses the coding agent you already work in.

## The Default Paths

### Path A: one-shot

Use this when you want the quickest end-to-end result.

```bash
npx @orchid-labs/pluxx autopilot --from-mcp https://example.com/mcp --runner codex --mode quick --yes
```

This does:

1. import the MCP
2. generate the scaffold
3. optionally prepare agent context/prompt packs if the selected mode needs them
4. run only the agent passes justified by the mode and MCP quality
5. run verification unless you opt out with `--no-verify`

Autopilot modes:

- `quick`: fastest path; usually scaffold + verify, with taxonomy only when metadata warnings make it necessary
- `standard`: balanced default; uses quality signals and docs/context to decide whether taxonomy or instructions are worth running
- `thorough`: always runs taxonomy, instructions, and review before verification

### Path B: manual but controlled

Use this when you want to inspect each stage.

```bash
npx @orchid-labs/pluxx init --from-mcp https://example.com/mcp --yes
npx @orchid-labs/pluxx doctor
npx @orchid-labs/pluxx agent prepare
npx @orchid-labs/pluxx agent run taxonomy --runner codex
npx @orchid-labs/pluxx agent run instructions --runner codex
npx @orchid-labs/pluxx test --target claude-code cursor codex opencode
```

## Which Command To Run

| Command | When to use it | What it does |
|---|---|---|
| `pluxx init --from-mcp ...` | Start a plugin project from a raw MCP | Introspects the MCP and generates the source scaffold |
| `pluxx autopilot ...` | You want import + agent refinement + verification in one shot | Wraps init, Agent Mode, and final test |
| `pluxx doctor` | Before publish, after import, or when setup feels off | Checks config, paths, auth shape, scaffold metadata, and trust warnings |
| `pluxx lint` | Before build or in CI | Validates frontmatter, naming, paths, hooks, and platform-specific constraints |
| `pluxx build` | You want fresh platform bundles in `dist/` | Generates the target platform outputs |
| `pluxx test` | You want the meaningful project verification contract | Runs config load, lint, build, and target smoke checks |
| `pluxx install --target ...` | You want to test a built plugin locally in a host app | Symlinks bundles into the local host plugin location |
| `pluxx sync --from-mcp ...` | The MCP changed and the plugin should catch up | Refreshes generated scaffold content while preserving custom sections |
| `pluxx agent prepare` | You want to inspect or customize Agent Mode before running it | Writes the agent context pack and plan |
| `pluxx agent prompt ...` | You want to read the prompt pack itself | Writes a specific prompt pack without running a headless agent |
| `pluxx agent run ... --runner ...` | You want only one refinement pass | Runs taxonomy, instructions, or review through a host runner |

## The Files You Get

After import, the project should look roughly like:

```text
my-plugin/
├── pluxx.config.ts
├── INSTRUCTIONS.md
├── pluxx.agent.md              # optional, project-owned Agent Mode overrides
├── .pluxx/
│   ├── mcp.json
│   └── agent/
│       ├── context.md
│       ├── plan.json
│       ├── taxonomy-prompt.md
│       ├── instructions-prompt.md
│       └── review-prompt.md
├── skills/
│   └── <skill-name>/SKILL.md
├── scripts/
│   └── check-env.sh
└── dist/
    ├── claude-code/
    ├── cursor/
    ├── codex/
    └── opencode/
```

## What Pluxx Manages Versus What You Own

### Pluxx-managed

- `pluxx.config.ts` generated defaults and MCP wiring
- `.pluxx/mcp.json`
- `.pluxx/agent/*`
- the generated blocks inside:
  - `INSTRUCTIONS.md`
  - `skills/*/SKILL.md`
- `dist/*`

### User-owned

- the custom blocks inside:
  - `INSTRUCTIONS.md`
  - `skills/*/SKILL.md`
- `pluxx.agent.md`
- any other repo docs, tests, assets, or notes you add

### Mixed ownership

Generated markdown files use this pattern:

```md
<!-- pluxx:generated:start -->
...
<!-- pluxx:generated:end -->

<!-- pluxx:custom:start -->
...
<!-- pluxx:custom:end -->
```

Rule:

- edit the `custom` block if you want changes to survive `pluxx sync --from-mcp`
- expect the `generated` block to be rewritten by Pluxx or Agent Mode

## How Agent Prompts Work

Pluxx generates prompt packs under `.pluxx/agent/`.

These are **disposable generated files**, not the durable customization layer.

Use them to:

- inspect what Codex or Claude will be told
- debug a poor refinement pass
- run a single pass manually

If you want durable project-level guidance, create `pluxx.agent.md`.

## How To Update The Prompts

### One-off tweak

Edit a generated prompt file in `.pluxx/agent/` and run the headless pass manually.

This is useful for debugging, but not durable.

### Durable project customization

Create `pluxx.agent.md` at the project root.

Supported sections include:

- `Context Paths`
- `Product Hints`
- `Setup/Auth Notes`
- `Grouping Hints`
- `Taxonomy Guidance`
- `Instructions Guidance`
- `Review Criteria`

That file is read by:

- `pluxx agent prepare`
- `pluxx agent prompt`
- `pluxx agent run`
- `pluxx autopilot`

### Changing the default system prompts

That means editing Pluxx itself, mainly:

- `/Users/brandonguerrero/Documents/Orchid Automation/Orchid Labs/pluxx/src/cli/agent.ts`

## Auth And Setup

### Remote bearer auth

```bash
npx @orchid-labs/pluxx init \
  --from-mcp https://example.com/mcp \
  --yes \
  --auth-env API_TOKEN \
  --auth-type bearer
```

### Remote custom header auth

```bash
npx @orchid-labs/pluxx init \
  --from-mcp https://example.com/mcp \
  --yes \
  --auth-env API_KEY \
  --auth-type header \
  --auth-header X-API-Key \
  --auth-template '${value}'
```

### OAuth-first MCPs

Pluxx can now detect common auth-required and redirect-to-login flows more clearly, but you still need a real credential before introspection can succeed.

The rule is:

- finish the provider auth flow first
- export the resulting token or API key
- rerun Pluxx with the right auth flags

## Build, Install, And What Goes Where

`pluxx build` writes platform bundles under `dist/`.

Important directories:

- `dist/claude-code/`
- `dist/cursor/`
- `dist/codex/`
- `dist/opencode/`

Those are the install/share artifacts for each host platform.

### Local host testing

Use:

```bash
npx @orchid-labs/pluxx install --target claude-code
npx @orchid-labs/pluxx install --target cursor
npx @orchid-labs/pluxx install --target codex
```

Cursor dogfood flow: `pluxx install --target cursor` links `dist/cursor/` into `~/.cursor/plugins/local/<plugin-name>`, which matches Cursor's documented local plugin test path.

Use `--trust` if the plugin includes command hooks and you have already reviewed them.

Use `--dry-run` to preview local install locations and trust implications.

### Manual sharing

If you are not relying on `pluxx install`, the thing you share is the platform bundle inside the matching `dist/<platform>/` directory.

## Local MCP During Development, Remote MCP In Production

This is a normal lifecycle.

Example:

1. import from local stdio while the MCP is under active development
2. refine, build, and test the plugin repo
3. deploy the MCP backend separately
4. sync the plugin repo against the remote endpoint

Example commands:

```bash
npx @orchid-labs/pluxx init --from-mcp "npx -y @acme/mcp" --yes
npx @orchid-labs/pluxx test
npx @orchid-labs/pluxx sync --from-mcp https://mcp.acme.com/mcp
```

Pluxx owns the plugin repo lifecycle. It does not own backend deployment.

## When To Run `doctor`, `lint`, `test`, And `sync`

### Run `doctor`

- right after import
- when auth/setup feels wrong
- before publish

### Run `lint`

- before committing
- in CI
- after editing instructions, skills, hooks, or platform-facing metadata

### Run `test`

- after Agent Mode changes
- before pushing/releasing
- in CI

### Run `sync --from-mcp`

- when the MCP tool list changes
- when auth metadata changes
- when a deployed endpoint replaces a local dev source

## Publishing Checklist

See the publish behavior contract in [publish v1 contract](./publish-v1-contract.md).
If you need submission-specific prep guidance (Claude Code + Cursor), use [Marketplace submission prep](./marketplace-submission-prep.md).

1. Run `pluxx doctor`
2. Run `pluxx test`
3. Review `INSTRUCTIONS.md` and `skills/*/SKILL.md`
4. Review hook trust implications if command hooks exist
5. Commit the source repo:
   - `pluxx.config.ts`
   - `INSTRUCTIONS.md`
   - `skills/`
   - `.pluxx/mcp.json`
   - optional `pluxx.agent.md`
6. Build fresh bundles
7. Share or publish the matching `dist/<platform>/` folders through your normal channel

## What To Do If The Generated Result Feels Weak

If the scaffold is valid but not product-shaped:

1. run `pluxx doctor` and inspect MCP metadata warnings
2. add `--website` and `--docs` to Agent Mode or autopilot
3. create `pluxx.agent.md` with product/setup/grouping hints
4. rerun:
   - `pluxx agent run taxonomy --runner codex`
   - `pluxx agent run instructions --runner codex`

Use `--verbose-runner` if you want full headless runner logs.

## The Practical Mental Model

Pluxx is:

- the deterministic plugin substrate
- the maintenance loop
- the safe wrapper around agent-assisted refinement

The shortest true story is:

- start from an MCP or a hand-authored plugin source repo
- get a working plugin repo
- let Codex or Claude refine it safely
- validate it
- install/share it
- if MCP-backed, sync it later from one source of truth
