# MCP-First Command Lifecycle

## Doc Links

- Role: exact CLI order when starting from a raw MCP
- Related:
  - [docs/getting-started.md](./getting-started.md)
  - [docs/create-a-pluxx-plugin.md](./create-a-pluxx-plugin.md)
  - [docs/practical-handbook.md](./practical-handbook.md)
  - [docs/use-pluxx-in-host-agents.md](./use-pluxx-in-host-agents.md)
- Update together:
  - [docs/getting-started.md](./getting-started.md)
  - [docs/create-a-pluxx-plugin.md](./create-a-pluxx-plugin.md)

Use this doc when the starting point is:

- one raw MCP server
- no existing Pluxx repo yet
- no existing host-native plugin you are trying to migrate

This is the blunt answer to:

> what commands do I run, in what order, and what does each one do?

The important framing is that this is not just an import flow. It is the full maintenance loop for turning one raw MCP into one maintained Pluxx source project, then compiling, installing, verifying, and later syncing truthful host-native outputs.

## Running Example

This doc uses one fake company all the way through so the lifecycle is obvious:

- company: `Northstar Support`
- what they have today: a raw MCP
- public MCP URL: `https://mcp.northstar-support.example/mcp`
- private staging MCP URL: `https://staging-mcp.northstar-support.example/mcp`
- local stdio package: `@northstar-support/mcp`
- plugin they want to ship: `northstar-support`

Think about the commands below as:

> “Northstar Support already has an MCP. Now they want one maintained Pluxx source project that can ship native plugins to Claude Code, Cursor, Codex, and OpenCode.”

## First Rule

If you are starting from a raw MCP, the first command is usually:

```bash
pluxx init --from-mcp ...
```

Not:

```bash
pluxx migrate ...
```

`migrate` is for an existing host-native plugin that you want to pull into Pluxx.

If all you have is an MCP, use `init --from-mcp`.

## Command Style

If Pluxx is installed globally:

```bash
pluxx <command>
```

If you want to use the published package without installing globally:

```bash
npx @orchid-labs/pluxx <command>
```

Both forms are equivalent for normal users.

This doc uses the shorter `pluxx` form.

## The Real Order

```text
have a raw MCP
    ->
init --from-mcp
    ->
validate
    ->
doctor
    ->
lint
    ->
build
    ->
install one host
    ->
verify-install
    ->
use it in the host
    ->
test
    ->
sync later when the MCP changes
    ->
publish when the plugin is actually ready
```

That order is the product story in miniature:

- `init --from-mcp` creates the maintained source project
- `doctor` and `lint` tell you whether the source project is healthy and honest across hosts
- `build` compiles host-native outputs
- `install` and `verify-install` prove the output is real in an actual host
- `sync` keeps the source project current later without resetting curated work

## Step 0: Create A Project Folder

```bash
mkdir northstar-support-plugin
cd northstar-support-plugin
```

You want an empty working directory before running the import.

In this example, this folder becomes the long-term source of truth for the Northstar Support plugin.

## Step 1: Export Auth If The MCP Needs It

Bearer example:

```bash
export NORTHSTAR_API_KEY='your_real_key'
```

Custom header example:

```bash
export NORTHSTAR_API_KEY='your_real_key'
```

If the MCP is public, skip this.

For Northstar Support:

- use no auth for the public production MCP
- use `NORTHSTAR_API_KEY` when importing the private staging MCP

## Step 2: Import The MCP Into A Pluxx Source Project

Public remote HTTP MCP:

```bash
pluxx init --from-mcp https://mcp.northstar-support.example/mcp --yes
```

Remote MCP with explicit naming and targets:

```bash
pluxx init \
  --from-mcp https://mcp.northstar-support.example/mcp \
  --yes \
  --name northstar-support \
  --display-name "Northstar Support" \
  --author "Northstar Support" \
  --targets claude-code,cursor,codex,opencode \
  --grouping workflow \
  --hooks safe
```

Remote bearer auth:

```bash
pluxx init \
  --from-mcp https://staging-mcp.northstar-support.example/mcp \
  --yes \
  --auth-env NORTHSTAR_API_KEY \
  --auth-type bearer
```

Remote custom-header auth:

```bash
pluxx init \
  --from-mcp https://staging-mcp.northstar-support.example/mcp \
  --yes \
  --auth-env NORTHSTAR_API_KEY \
  --auth-type header \
  --auth-header X-API-Key \
  --auth-template '${value}'
```

Local stdio MCP:

```bash
pluxx init \
  --from-mcp "npx -y -p @northstar-support/mcp northstar-support-mcp" \
  --yes
```

What `init --from-mcp` does:

- introspects the MCP
- creates `pluxx.config.ts`
- creates `INSTRUCTIONS.md`
- generates initial `skills/`
- writes `.pluxx/mcp.json` so the source project can sync later

This is the key step where a raw MCP stops being just a backend endpoint and becomes a maintained plugin source project.

For Northstar Support, this is the command that turns “we have an MCP” into “we now have a real plugin source project.”

If you only want to preview what would happen:

```bash
pluxx init --from-mcp https://mcp.northstar-support.example/mcp --yes --dry-run --json
```

## Step 3: Validate The Basic Shape

```bash
pluxx validate
```

What `validate` does:

- fast config sanity check
- confirms the project parses
- confirms the expected top-level structure is recognized

Use it first because it is cheap.

For Northstar Support, this is the quick “did the import create a valid Pluxx project at all?” check.

## Step 4: Run Doctor

```bash
pluxx doctor
```

What `doctor` does:

- checks config loadability
- checks configured paths
- checks MCP transport/auth shape
- checks scaffold metadata
- reports hook trust warnings
- shows compatibility and setup advisories

If `validate` says "the config loads," `doctor` says "this project is healthy enough to proceed."

For Northstar Support, this is where you catch auth wiring mistakes, missing paths, or bad scaffold assumptions before refining anything.

## Step 5: Lint The Cross-Host Surface

```bash
pluxx lint
```

What `lint` does:

- validates frontmatter and metadata
- checks host-specific rule violations
- calls out preserve/translate/degrade issues
- surfaces problems before `build`

This is where you find out if the source project is asking for features one host does not support cleanly.

For Northstar Support, this is the first real answer to:

> “Can this one source project ship cleanly across the core four, or is it still too host-specific?”

## Step 6: Build The Native Outputs

```bash
pluxx build
```

What `build` does:

- compiles the one maintained source project into target-specific outputs under `dist/`

If your `pluxx.config.ts` targets are:

- `claude-code`
- `cursor`
- `codex`
- `opencode`

then `pluxx build` builds all four.

If you only want one target while iterating:

```bash
pluxx build --target codex
```

Or a subset:

```bash
pluxx build --target claude-code cursor
```

Preview only:

```bash
pluxx build --dry-run
```

For Northstar Support, this is the exact moment where one source project becomes four native output bundles.

## Step 7: Install One Host First

Do not try to validate every host at once first.

Install one host, make it feel real, then fan out.

Codex example:

```bash
pluxx install --target codex
```

If hooks are present and trust is required:

```bash
pluxx install --target codex --trust
```

Claude Code example:

```bash
pluxx install --target claude-code --trust
```

Preview only:

```bash
pluxx install --target codex --dry-run
```

What `install` does:

- installs or symlinks the built bundle into the host’s local plugin path
- updates marketplace/local catalog state where the host needs it

For Northstar Support, this is where the plugin stops being “just generated files” and becomes something a real Codex user can install.

## Step 8: Verify The Installed Host State

```bash
pluxx verify-install --target codex
```

What `verify-install` does:

- checks the installed host-visible bundle
- confirms the installed state matches what Pluxx expects
- catches install-path and host-surface problems that `build` alone cannot catch

This is different from `build`.

`build` says the output exists.

`verify-install` says the host can actually see the installed shape you intended.

For Northstar Support, this is the difference between:

- “we produced a Codex bundle”
- “Codex can actually consume the installed Northstar Support plugin”

## Step 9: Use The Plugin In The Host

Restart or reload the host if needed, then actually use the installed plugin.

This is where you find out:

- whether it looks native
- whether the prompts feel right
- whether the workflow is shaped correctly
- whether the install is only technically valid or actually usable

This step is not optional if you care about product quality.

In the Northstar Support example, this is where you would open Codex and try a prompt like:

```text
Use Northstar Support to inspect our support docs and tell me which workflow a support engineer should use first.
```

That is the real product moment. If the plugin does not feel native here, the rest of the lifecycle is not enough.

## Step 10: Run The Broader Verification Contract

```bash
pluxx test
```

Or a subset:

```bash
pluxx test --target claude-code cursor codex opencode
```

What `test` does:

- runs the meaningful verification contract
- typically covers config load, lint, build, and smoke checks

This is what should end up in CI.

For Northstar Support, this is the command that moves the project from “works locally” to “safe enough to keep shipping.”

## Step 11: Sync Later When The MCP Changes

If the plugin came from an MCP, this is the long-term maintenance move:

```bash
pluxx sync
```

Or repoint explicitly:

```bash
pluxx sync --from-mcp https://mcp.northstar-support.example/mcp
```

Preview first:

```bash
pluxx sync --dry-run --json
```

What `sync` does:

- refreshes MCP-derived scaffold content
- preserves custom blocks
- keeps one maintained source project aligned with the evolving MCP

For Northstar Support, this is what you run after the MCP team ships new tools, updated descriptions, or cleaner schemas.

## Step 12: Publish When The Plugin Is Actually Ready

```bash
pluxx publish
```

What `publish` does:

- packages release artifacts
- generates install scripts
- checks release readiness
- prepares npm and GitHub release surfaces

For Northstar Support, this is where the plugin becomes something teammates or customers can install from a release instead of only from a local checkout.

Do this after:

- the source project is healthy
- `build` works
- at least one host install is proven
- the plugin is actually worth distributing

## The Short Version

If you want the shortest correct MCP-first path:

```bash
pluxx init --from-mcp https://mcp.northstar-support.example/mcp --yes
pluxx validate
pluxx doctor
pluxx lint
pluxx build
pluxx install --target codex --trust
pluxx verify-install --target codex
pluxx test
```

Then:

- use it in the host
- `sync` later
- `publish` when ready

## Where Autopilot Fits

`autopilot` is the shortcut when you want import + refinement + verification in one command:

```bash
pluxx autopilot --from-mcp https://mcp.northstar-support.example/mcp --runner codex --yes
```

It is useful.

But if you are learning Pluxx or debugging a real import, the manual lifecycle above is the clearer mental model.
