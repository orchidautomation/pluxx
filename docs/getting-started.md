# Getting Started With Pluxx

Pluxx is for one specific job: maintain one plugin source project and generate native bundles for Claude Code, Cursor, Codex, and OpenCode.

The strongest path today is MCP-first: bring an existing MCP server, scaffold the plugin from it, then keep shipping from one source of truth. But MCP is not a hard requirement. You can also start from an empty plugin and author the skills, instructions, hooks, and metadata yourself.

This walkthrough covers:

- choose an MCP-first or hand-authored starting point
- scaffold a plugin
- lint, build, install, and test it
- sync later when the MCP changes
- run the same checks in CI

Related docs:

- [Create a Pluxx plugin](./create-a-pluxx-plugin.md)
- [Use Pluxx in host agents](./use-pluxx-in-host-agents.md)
- [Practical handbook](./practical-handbook.md)
- [How it works](./how-it-works.md)
- [Architecture](./architecture.md)
- [Customer journey](./customer-journey.md)
- [One-shot autopilot spec](./autopilot-spec.md)
- [Homepage messaging](./homepage-messaging.md)
- [PlayKit case study](./playkit-case-study.md)
- [Orchid Docs Ops Codex walkthrough](./orchid-docs-ops-codex-walkthrough.md)

## Product Boundary

Pluxx is the plugin authoring and maintenance layer for cross-host plugins.

The best fit today is an MCP-backed plugin, because that is where import, auth translation, and sync save the most work. But Pluxx also works for plugins with no MCP.

Pluxx owns:

- source-plugin scaffolding
- scaffold generation from local or remote MCPs when you have one
- plugin validation, build, local install, and sync
- keeping generated plugin repos maintainable as MCPs evolve

Pluxx does not own:

- deploying or hosting the MCP backend service itself
- operating production MCP infrastructure

## Lifecycle At A Glance

1. Start from a local stdio/remote MCP or initialize an empty plugin.
2. Generate and refine one plugin source repo.
3. Validate/build/install locally.
4. If your plugin is MCP-backed, repoint sync to the remote endpoint when the backend is deployed.
5. Keep the plugin repo as your long-term source of truth.

## 1. Choose Your Starting Point

### Path A: Bring An MCP Server

Pluxx accepts three MCP source shapes today:

- remote HTTP: `npx @orchid-labs/pluxx init --from-mcp https://example.com/mcp`
- legacy SSE: `npx @orchid-labs/pluxx init --from-mcp https://example.com/sse --transport sse`
- local stdio: `npx @orchid-labs/pluxx init --from-mcp "npx -y -p @acme/mcp acme-mcp"`

For local stdio imports, pass the real executable command. Do not assume the npm package name is also the runnable bin name.

Examples:

- installed locally: `npx @orchid-labs/pluxx init --from-mcp "./node_modules/.bin/acme-mcp" --yes`
- one-shot via npm: `npx @orchid-labs/pluxx init --from-mcp "npx -y -p @acme/mcp acme-mcp" --yes`

If the remote server requires auth and responds with `401`, `402`, or `403`, Pluxx can scaffold it with either bearer auth or a custom header. Use the auth flags up front for non-interactive imports:

```bash
npx @orchid-labs/pluxx init \
  --from-mcp https://mcp.playkit.sh/mcp \
  --yes \
  --auth-env PLAYKIT_API_KEY \
  --auth-type header \
  --auth-header X-API-Key \
  --auth-template '${value}'
```

For OAuth-first MCPs, complete the provider OAuth flow first, then export the resulting access token/API key and reuse the same auth flags:

```bash
npx @orchid-labs/pluxx init \
  --from-mcp https://example.com/mcp \
  --yes \
  --auth-env OAUTH_ACCESS_TOKEN \
  --auth-type bearer
```

### Path B: Start Without MCP

If your plugin does not wrap an MCP server, initialize a source project and author the plugin directly:

```bash
npx @orchid-labs/pluxx init my-plugin
cd my-plugin
```

Then fill in:

- `pluxx.config.ts`
- `INSTRUCTIONS.md`
- `skills/<skill-name>/SKILL.md`
- optional `commands/`, `agents/`, `scripts/`, and `assets/`

## 2. Scaffold A Plugin

Interactive:

```bash
npx @orchid-labs/pluxx init --from-mcp https://example.com/mcp
```

Without MCP:

```bash
npx @orchid-labs/pluxx init my-plugin
```

Headless:

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

One-shot autopilot:

```bash
npx @orchid-labs/pluxx autopilot \
  --from-mcp https://example.com/mcp \
  --runner codex \
  --yes \
  --name acme \
  --display-name "Acme" \
  --author "Acme" \
  --targets claude-code,cursor,codex,opencode \
  --grouping workflow \
  --hooks safe
```

By default, autopilot summarizes runner outcomes without streaming raw runner logs. Add `--verbose-runner` to stream full headless runner output.

Headless import with custom header auth:

```bash
npx @orchid-labs/pluxx init \
  --from-mcp https://mcp.playkit.sh/mcp \
  --yes \
  --name playkit \
  --display-name "PlayKit" \
  --author "PlayKit" \
  --targets claude-code,cursor,codex,opencode \
  --grouping workflow \
  --hooks safe \
  --auth-env PLAYKIT_API_KEY \
  --auth-type header \
  --auth-header X-API-Key \
  --auth-template '${value}'
```

Preview without writing files:

```bash
npx @orchid-labs/pluxx init --from-mcp https://example.com/mcp --yes --dry-run --json
```

## 3. What Gets Generated

Pluxx writes:

- `pluxx.config.ts`
- `INSTRUCTIONS.md`
- `skills/<skill-name>/SKILL.md`
- optional `scripts/` for safe generated hooks
- `.pluxx/mcp.json` ownership metadata for future syncs when the project was scaffolded from MCP

Generated `INSTRUCTIONS.md` and `SKILL.md` files use mixed ownership:

- a Pluxx-managed generated block
- a preserved custom block for manual edits

That lets `pluxx sync --from-mcp` refresh discovered MCP content later without throwing away curated notes.

If you want to steer Agent Mode without editing generated prompt packs, add a project-owned `pluxx.agent.md` file. Pluxx will read it during `agent prepare`, `agent prompt`, `agent run`, and `autopilot`.

## 4. Check Project Health

Before building, run:

```bash
npx @orchid-labs/pluxx doctor
```

`pluxx doctor` is read-only. It checks:

- Node runtime availability for the published CLI
- config loadability
- configured paths like `skills/`, `instructions`, `agents`, `commands`, `scripts`, and `assets`
- MCP transport and auth shape
- scaffold metadata validity
- trust advisories for hook commands
- beta-target caveats

For CI or automation:

```bash
npx @orchid-labs/pluxx doctor --json
```

## 5. Lint, Build, Install, Test

```bash
npx @orchid-labs/pluxx lint
npx @orchid-labs/pluxx build
npx @orchid-labs/pluxx install --target claude-code
npx @orchid-labs/pluxx test
```

Useful previews:

```bash
npx @orchid-labs/pluxx build --dry-run
npx @orchid-labs/pluxx install --dry-run
```

`pluxx test` runs the default verification contract:

- config load / validate
- lint
- build
- generated output smoke checks

## 6. Sync Later

For MCP-derived projects, when the server changes:

```bash
npx @orchid-labs/pluxx sync
```

If your MCP moved from local stdio development to a deployed endpoint, repoint sync explicitly:

```bash
npx @orchid-labs/pluxx sync --from-mcp https://mcp.example.com/mcp
```

Preview sync changes first:

```bash
npx @orchid-labs/pluxx sync --dry-run --json
```

If the project is hand-authored with no MCP, `sync` is not part of the normal loop. The source repo itself is the maintained artifact.

Pluxx preserves custom mixed-ownership Markdown sections and reports:

- added files
- updated files
- removed files
- preserved files
- renamed skill directories

## 7. Publish And Distribute

After build/install validation, ship the generated plugin repo and bundles:

1. Commit and version the plugin source repo (`pluxx.config.ts`, `skills/`, `INSTRUCTIONS.md`, `.pluxx/mcp.json`).
2. Build release bundles with `npx @orchid-labs/pluxx build`.
3. Publish/share through your target channels (team repo, release artifacts, or platform-specific publish flows).

This keeps Pluxx as the distribution and maintenance layer while your MCP backend deployment stays separate.

## 8. Run In CI

Use the reusable workflow shipped in this repo:

```yaml
name: Plugin Check

on:
  pull_request:
  push:
    branches: [main]

jobs:
  verify:
    uses: orchidautomation/pluxx/.github/workflows/pluxx-plugin-check.yml@main
    with:
      working-directory: .
      pluxx-version: latest
```

If you want to run the CLI directly in a script:

```bash
npx @orchid-labs/pluxx doctor --json
npx @orchid-labs/pluxx test --json
```

## Prime-Time Path

The prime-time Pluxx path is:

- Claude Code
- Cursor
- Codex
- OpenCode

Other generators still exist, but they are less validated and should be treated as beta targets until they have stronger live coverage.
