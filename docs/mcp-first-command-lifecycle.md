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

## Step 0: Create A Project Folder

```bash
mkdir my-plugin
cd my-plugin
```

You want an empty working directory before running the import.

## Step 1: Export Auth If The MCP Needs It

Bearer example:

```bash
export ACME_API_KEY='your_real_key'
```

Custom header example:

```bash
export ACME_API_KEY='your_real_key'
```

If the MCP is public, skip this.

## Step 2: Import The MCP Into A Pluxx Source Project

Public remote HTTP MCP:

```bash
pluxx init --from-mcp https://example.com/mcp --yes
```

Remote MCP with explicit naming and targets:

```bash
pluxx init \
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
pluxx init \
  --from-mcp https://example.com/mcp \
  --yes \
  --auth-env ACME_API_KEY \
  --auth-type bearer
```

Remote custom-header auth:

```bash
pluxx init \
  --from-mcp https://example.com/mcp \
  --yes \
  --auth-env ACME_API_KEY \
  --auth-type header \
  --auth-header X-API-Key \
  --auth-template '${value}'
```

Local stdio MCP:

```bash
pluxx init \
  --from-mcp "npx -y -p @acme/mcp acme-mcp" \
  --yes
```

What `init --from-mcp` does:

- introspects the MCP
- creates `pluxx.config.ts`
- creates `INSTRUCTIONS.md`
- generates initial `skills/`
- writes `.pluxx/mcp.json` so the source project can sync later

If you only want to preview what would happen:

```bash
pluxx init --from-mcp https://example.com/mcp --yes --dry-run --json
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

## Step 9: Use The Plugin In The Host

Restart or reload the host if needed, then actually use the installed plugin.

This is where you find out:

- whether it looks native
- whether the prompts feel right
- whether the workflow is shaped correctly
- whether the install is only technically valid or actually usable

This step is not optional if you care about product quality.

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

## Step 11: Sync Later When The MCP Changes

If the plugin came from an MCP, this is the long-term maintenance move:

```bash
pluxx sync
```

Or repoint explicitly:

```bash
pluxx sync --from-mcp https://example.com/mcp
```

Preview first:

```bash
pluxx sync --dry-run --json
```

What `sync` does:

- refreshes MCP-derived scaffold content
- preserves custom blocks
- keeps one maintained source project aligned with the evolving MCP

## Step 12: Publish When The Plugin Is Actually Ready

```bash
pluxx publish
```

What `publish` does:

- packages release artifacts
- generates install scripts
- checks release readiness
- prepares npm and GitHub release surfaces

Do this after:

- the source project is healthy
- `build` works
- at least one host install is proven
- the plugin is actually worth distributing

## The Short Version

If you want the shortest correct MCP-first path:

```bash
pluxx init --from-mcp https://example.com/mcp --yes
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
pluxx autopilot --from-mcp https://example.com/mcp --runner codex --yes
```

It is useful.

But if you are learning Pluxx or debugging a real import, the manual lifecycle above is the clearer mental model.
