# Getting Started With Pluxx

Pluxx is for one specific job: take an existing MCP server and turn it into maintainable plugin bundles for Claude Code, Cursor, Codex, and OpenCode from one source of truth.

This walkthrough covers:

- bring an MCP server
- scaffold a plugin
- lint, build, install, and test it
- sync later when the MCP changes
- run the same checks in CI

Related docs:

- [How it works](./how-it-works.md)
- [Architecture](./architecture.md)
- [Customer journey](./customer-journey.md)
- [One-shot autopilot spec](./autopilot-spec.md)
- [Homepage messaging](./homepage-messaging.md)
- [PlayKit case study](./playkit-case-study.md)

## 1. Bring An MCP Server

Pluxx accepts three MCP source shapes today:

- remote HTTP: `bunx pluxx init --from-mcp https://example.com/mcp`
- legacy SSE: `bunx pluxx init --from-mcp https://example.com/sse --transport sse`
- local stdio: `bunx pluxx init --from-mcp "npx -y @acme/mcp"`

If the remote server requires auth and responds with `401`, `402`, or `403`, Pluxx can scaffold it with either bearer auth or a custom header. Use the auth flags up front for non-interactive imports:

```bash
bunx pluxx init \
  --from-mcp https://mcp.playkit.sh/mcp \
  --yes \
  --auth-env PLAYKIT_API_KEY \
  --auth-type header \
  --auth-header X-API-Key \
  --auth-template '${value}'
```

## 2. Scaffold A Plugin

Interactive:

```bash
bunx pluxx init --from-mcp https://example.com/mcp
```

Headless:

```bash
bunx pluxx init \
  --from-mcp https://example.com/mcp \
  --yes \
  --name acme \
  --display-name "Acme" \
  --author "Acme" \
  --targets claude-code,cursor,codex,opencode \
  --grouping workflow \
  --hooks safe
```

Headless import with custom header auth:

```bash
bunx pluxx init \
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
bunx pluxx init --from-mcp https://example.com/mcp --yes --dry-run --json
```

## 3. What Gets Generated

Pluxx writes:

- `pluxx.config.ts`
- `INSTRUCTIONS.md`
- `skills/<skill-name>/SKILL.md`
- optional `scripts/` for safe generated hooks
- `.pluxx/mcp.json` ownership metadata for future syncs

Generated `INSTRUCTIONS.md` and `SKILL.md` files use mixed ownership:

- a Pluxx-managed generated block
- a preserved custom block for manual edits

That lets `pluxx sync --from-mcp` refresh discovered MCP content later without throwing away curated notes.

## 4. Check Project Health

Before building, run:

```bash
bunx pluxx doctor
```

`pluxx doctor` is read-only. It checks:

- Bun runtime availability
- config loadability
- configured paths like `skills/`, `instructions`, `agents`, `commands`, `scripts`, and `assets`
- MCP transport and auth shape
- scaffold metadata validity
- trust advisories for hook commands
- beta-target caveats

For CI or automation:

```bash
bunx pluxx doctor --json
```

## 5. Lint, Build, Install, Test

```bash
bunx pluxx lint
bunx pluxx build
bunx pluxx install --target claude-code
bunx pluxx test
```

Useful previews:

```bash
bunx pluxx build --dry-run
bunx pluxx install --dry-run
```

`pluxx test` runs the default verification contract:

- config load / validate
- lint
- build
- generated output smoke checks

## 6. Sync Later

When the MCP server changes:

```bash
bunx pluxx sync
```

Preview sync changes first:

```bash
bunx pluxx sync --dry-run --json
```

Pluxx preserves custom mixed-ownership Markdown sections and reports:

- added files
- updated files
- removed files
- preserved files
- renamed skill directories

## 7. Run In CI

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
bunx pluxx doctor --json
bunx pluxx test --json
```

## Prime-Time Path

The prime-time Pluxx path is:

- Claude Code
- Cursor
- Codex
- OpenCode

Other generators still exist, but they are less validated and should be treated as beta targets until they have stronger live coverage.
