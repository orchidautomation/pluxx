# Create A Pluxx Plugin

This is the step-by-step guide for turning a raw MCP into one maintained Pluxx source project that can compile native plugins for Claude Code, Cursor, Codex, and OpenCode.

If you are not starting from MCP, initialize a source project with `npx @orchid-labs/pluxx init my-plugin`, fill in `pluxx.config.ts`, `INSTRUCTIONS.md`, and `skills/`, then continue from the validation/build steps in this guide.

Use this doc when you want the exact sequence for:

- starting from a raw MCP
- generating the editable source scaffold
- refining the scaffold with Claude, Codex, Cursor, or OpenCode
- validating the result
- building target bundles
- installing and verifying the plugin in a host app
- syncing later when the MCP changes

## The Mental Model

Pluxx is not just an installer. It is the source-of-truth compiler and maintenance loop for host-native plugins.

That matters most for MCP-backed plugins: Pluxx can take a raw MCP and turn it into a workflow-driven native plugin surface instead of leaving users with a thin tool dump.

It works in two layers:

1. `Core` generates the deterministic scaffold.
2. `Agent` optionally refines that scaffold semantically.

That means the normal flow is:

```text
raw MCP
  -> pluxx init
  -> optional agent refinement
  -> pluxx validate / doctor / lint
  -> pluxx build
  -> pluxx install
  -> pluxx verify-install
  -> pluxx test
  -> pluxx sync later
```

`pluxx autopilot` wraps that whole flow into one command, which makes it the fastest way for an MCP owner to get to a workflow-driven cross-platform native plugin. The manual path is still often easier to understand and debug.

## Path A: Manual And Controlled

This is the best default authoring path today.

### 1. Create a real project folder

```bash
mkdir -p ~/Desktop/acme-pluxx
cd ~/Desktop/acme-pluxx
```

### 2. Export auth if the MCP needs it

Bearer auth:

```bash
export ACME_API_KEY='your_real_key'
```

Custom header auth:

```bash
export ACME_API_KEY='your_real_key'
```

### 3. Generate the deterministic scaffold

Remote HTTP MCP:

```bash
npx @orchid-labs/pluxx init \
  --from-mcp https://example.com/mcp \
  --yes \
  --name acme \
  --display-name "Acme" \
  --author "Acme" \
  --targets claude-code,cursor,codex,opencode \
  --grouping workflow \
  --hooks safe
```

Remote bearer auth:

```bash
npx @orchid-labs/pluxx init \
  --from-mcp https://example.com/mcp \
  --yes \
  --name acme \
  --display-name "Acme" \
  --author "Acme" \
  --targets claude-code,cursor,codex,opencode \
  --grouping workflow \
  --hooks safe \
  --auth-env ACME_API_KEY \
  --auth-type bearer
```

Remote custom header auth:

```bash
npx @orchid-labs/pluxx init \
  --from-mcp https://example.com/mcp \
  --yes \
  --name acme \
  --display-name "Acme" \
  --author "Acme" \
  --targets claude-code,cursor,codex,opencode \
  --grouping workflow \
  --hooks safe \
  --auth-env ACME_API_KEY \
  --auth-type header \
  --auth-header X-API-Key \
  --auth-template '${value}'
```

Local stdio MCP:

```bash
npx @orchid-labs/pluxx init \
  --from-mcp "npx -y -p @acme/mcp acme-mcp" \
  --yes \
  --name acme \
  --display-name "Acme" \
  --author "Acme" \
  --targets claude-code,cursor,codex,opencode \
  --grouping workflow \
  --hooks safe
```

If the stdio command points at a project-relative runtime such as `./build/index.js`, Pluxx now infers the parent runtime directory into `passthrough` automatically. That matters because installed host bundles need both the MCP config and the executable payload, not just the config.

### 4. Inspect the scaffold

You should now have a source repo that looks roughly like:

```text
.
├── .pluxx/
│   ├── mcp.json
│   └── agent/
├── INSTRUCTIONS.md
├── pluxx.config.ts
├── scripts/
└── skills/
```

Key files:

- `pluxx.config.ts` — source of truth for targets, MCP wiring, hooks, rules, and assets
- `INSTRUCTIONS.md` — shared instruction source that compiles into host-native surfaces like `CLAUDE.md`, `AGENTS.md`, rules files, or OpenCode runtime instruction injection
- `skills/*/SKILL.md` — workflow surfaces over raw MCP tools
- `.pluxx/mcp.json` — scaffold ownership metadata for future syncs

The important rule is: edit the source project, not `dist/`.

### 5. Prepare the agent context pack

If you want semantic refinement, give Pluxx the product context first:

```bash
npx @orchid-labs/pluxx agent prepare \
  --website https://example.com \
  --docs https://docs.example.com/mcp
```

If you want to inspect the generated prompts:

```bash
npx @orchid-labs/pluxx agent prompt taxonomy
npx @orchid-labs/pluxx agent prompt instructions
```

This creates:

- `.pluxx/agent/context.md`
- `.pluxx/agent/plan.json`
- `.pluxx/agent/taxonomy-prompt.md`
- `.pluxx/agent/instructions-prompt.md`

### 6. Refine the scaffold with an agent

Run only the pass you need:

```bash
npx @orchid-labs/pluxx agent run taxonomy --runner claude
npx @orchid-labs/pluxx agent run instructions --runner claude
```

Or use the prompt packs manually inside Claude/Codex/Cursor/OpenCode if you want more control.

Rule of thumb:

- taxonomy pass: rename, merge, or split skills
- instructions pass: rewrite the shared generated section in `INSTRUCTIONS.md`
- review pass: ask for findings before shipping

### 7. Validate the project

```bash
npx @orchid-labs/pluxx doctor
npx @orchid-labs/pluxx lint
npx @orchid-labs/pluxx test --target claude-code cursor codex opencode
```

What each command means:

- `doctor` checks runtime health, auth shape, paths, metadata, and trust advisories
- `lint` checks frontmatter, platform rules, hook compatibility, and size limits
- `test` runs the build + smoke contract across the selected targets

### 8. Build the platform bundles

```bash
npx @orchid-labs/pluxx build
```

This renders the source scaffold into `dist/`:

```text
dist/
├── claude-code/
├── cursor/
├── codex/
└── opencode/
```

Important:

- the editable source of truth is the root project
- `dist/` is generated output
- do not hand-edit `dist/` unless you are debugging a generator

### 9. Install and test one host first

Claude Code:

```bash
npx @orchid-labs/pluxx install --trust --target claude-code
```

Cursor:

```bash
npx @orchid-labs/pluxx install --trust --target cursor
```

Codex:

```bash
npx @orchid-labs/pluxx install --trust --target codex
```

Then verify the host-visible install state before you move on:

```bash
npx @orchid-labs/pluxx verify-install --target codex
```

Then pick up the installed bundle in the host app and test real requests:

- Claude Code: run `/reload-plugins`
- Cursor: reload the window or restart Cursor
- Codex: use `Plugins > Refresh` if available, otherwise restart Codex
- OpenCode: reload or restart OpenCode

If verification fails, use the fix line printed by `verify-install` first. It distinguishes missing builds, missing installs, stale host-visible bundles, stale Codex cache, and lower-level `doctor --consumer` failures.

For the cleanest repo-native install/demo walkthroughs, use:

- [Proof and install](./proof-and-install.md)
- [Core-four install and update lifecycle](./core-four-install-update-lifecycle.md)

## Path B: One-Shot Autopilot

Use this when you want Pluxx to do the whole flow for you.

Quick mode:

```bash
npx @orchid-labs/pluxx autopilot \
  --from-mcp https://example.com/mcp \
  --runner codex \
  --mode quick \
  --yes
```

Standard mode:

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

10-minute local proof:

```bash
npx @orchid-labs/pluxx autopilot \
  --from-mcp https://example.com/mcp \
  --runner codex \
  --mode standard \
  --install \
  --install-target codex \
  --trust
```

Authenticated 10-minute local proof:

```bash
export ACME_API_KEY='real_key'

npx @orchid-labs/pluxx autopilot \
  --from-mcp https://example.com/mcp \
  --runner codex \
  --mode standard \
  --auth-env ACME_API_KEY \
  --auth-type bearer \
  --install \
  --install-target codex \
  --trust
```

Autopilot should finish with installed path, `verify-install` status, and the host reload instruction. If the MCP needs a key, export the real env var first; placeholder secrets are rejected before install because the installer has to materialize plugin-owned MCP credentials for hosts that do not expose them in a global MCP settings UI. On Claude Code, installed hook commands also rehydrate that saved `userConfig` env from `.pluxx-user.json`, so `SessionStart` hook scripts and their child processes see the same installed secret material as the plugin-owned MCP runtime.

The generated command surface is intentionally smaller than the raw MCP tool list. Workflow grouping keeps singleton tool wrappers as skills unless they have a strong user-facing command shape, and `pluxx eval` warns when a scaffold still looks like command-per-tool output.

Thorough mode:

```bash
npx @orchid-labs/pluxx autopilot \
  --from-mcp https://example.com/mcp \
  --runner codex \
  --mode thorough \
  --yes \
  --verbose-runner
```

Mode guidance:

- `quick` — fastest first pass
- `standard` — best default when the MCP metadata is mixed
- `thorough` — use before publishing or when you want review built in

## OAuth-First MCPs

Some MCPs are one auth shape during import and another at runtime.

Example:

- import may work with bearer or custom-header auth
- Claude Code or Cursor runtime may need platform-managed OAuth

That means:

- `init` / `sync` can still use `--auth-env`, `--auth-type`, and related flags
- the generated Claude/Cursor plugin can be configured to defer runtime auth to the host platform instead of injecting headers directly
- in interactive mode, Pluxx can open the provider auth URL, let you paste a hidden token/API key for the current session, and retry the import immediately
- for browser-interactive remote MCPs that work better through a local proxy, use `--oauth-wrapper` to introspect through `npx -y mcp-remote <url>` while keeping the remote URL as the scaffold source

This is the `import auth != runtime auth` split.

## Recommended Auth Smoke Targets

When you want a quick real-world check of Pluxx auth import behavior, these MCPs cover the three main paths:

- **Sumble** — bearer auth smoke
  - run `pluxx init --from-mcp https://mcp.sumble.com --yes --auth-env SUMBLE_API_KEY --auth-type bearer --dry-run --json`
  - expected result: scaffold preview succeeds
- **PlayKit** — custom-header auth smoke
  - run `pluxx init --from-mcp https://mcp.playkit.sh/mcp --yes --auth-env PLAYKIT_API_KEY --auth-type header --auth-header X-API-Key --auth-template '${value}' --dry-run --json`
  - expected result: scaffold preview succeeds
- **Linear** — OAuth-first/platform-auth guidance smoke
  - run `pluxx init --from-mcp https://mcp.linear.app/mcp --yes --dry-run`
  - expected result: import stops with explicit OAuth-first guidance and suggests `--auth-type platform --runtime-auth platform` or a local wrapper/proxy when browser-interactive auth is required
  - wrapper path: `pluxx init --from-mcp https://mcp.linear.app/mcp --yes --oauth-wrapper --runtime-auth platform`

Keep the automated local OAuth stub in tests for deterministic coverage, and use these servers as manual sanity checks against real MCP behavior.

## What Pluxx Owns

Pluxx owns:

- scaffold generation
- managed sections in generated markdown
- validation
- build
- install
- sync

You own:

- custom note blocks
- `pluxx.agent.md`
- any extra docs, assets, or tests you add

## Recommended First-Run Defaults

If you are new to Pluxx:

1. use `init`, not `autopilot`
2. inspect the scaffold
3. run `agent prepare --website ... --docs ...`
4. run a taxonomy pass
5. validate with `doctor`, `lint`, and `test`
6. build and install one target

That path is usually more understandable than jumping straight to full autopilot.

## Related Docs

- [Proof and install](./proof-and-install.md)
- [Getting started](./getting-started.md)
- [Practical handbook](./practical-handbook.md)
- [Agent Mode](./agent-mode.md)
- [How it works](./how-it-works.md)
