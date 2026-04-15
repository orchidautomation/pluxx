# Create A Pluxx Plugin

This is the step-by-step guide for making a real Pluxx plugin from an MCP server.

Use this doc when you want the exact sequence for:

- starting from a raw MCP
- generating the editable source scaffold
- refining the scaffold with Claude, Codex, Cursor, or OpenCode
- validating the result
- building target bundles
- installing and testing the plugin in a host app

## The Mental Model

Pluxx works in two layers:

1. `Core` generates the deterministic scaffold.
2. `Agent` optionally refines that scaffold semantically.

That means the normal flow is:

```text
raw MCP
  -> pluxx init
  -> optional agent refinement
  -> pluxx doctor / lint / test
  -> pluxx build
  -> pluxx install
```

`pluxx autopilot` wraps that whole flow into one command, but the manual path is often easier to understand and debug.

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

Remote bearer auth:

```bash
bunx pluxx init \
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
bunx pluxx init \
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
bunx pluxx init \
  --from-mcp "npx -y @acme/mcp" \
  --yes \
  --name acme \
  --display-name "Acme" \
  --author "Acme" \
  --targets claude-code,cursor,codex,opencode \
  --grouping workflow \
  --hooks safe
```

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
- `INSTRUCTIONS.md` — shared instructions that get translated into host outputs
- `skills/*/SKILL.md` — workflow surfaces over raw MCP tools
- `.pluxx/mcp.json` — scaffold ownership metadata for future syncs

### 5. Prepare the agent context pack

If you want semantic refinement, give Pluxx the product context first:

```bash
bunx pluxx agent prepare \
  --website https://example.com \
  --docs https://docs.example.com/mcp
```

If you want to inspect the generated prompts:

```bash
bunx pluxx agent prompt taxonomy
bunx pluxx agent prompt instructions
```

This creates:

- `.pluxx/agent/context.md`
- `.pluxx/agent/plan.json`
- `.pluxx/agent/taxonomy-prompt.md`
- `.pluxx/agent/instructions-prompt.md`

### 6. Refine the scaffold with an agent

Run only the pass you need:

```bash
bunx pluxx agent run taxonomy --runner claude
bunx pluxx agent run instructions --runner claude
```

Or use the prompt packs manually inside Claude/Codex/Cursor/OpenCode if you want more control.

Rule of thumb:

- taxonomy pass: rename, merge, or split skills
- instructions pass: rewrite the shared generated section in `INSTRUCTIONS.md`
- review pass: ask for findings before shipping

### 7. Validate the project

```bash
bunx pluxx doctor
bunx pluxx lint
bunx pluxx test --target claude-code cursor codex opencode
```

What each command means:

- `doctor` checks runtime health, auth shape, paths, metadata, and trust advisories
- `lint` checks frontmatter, platform rules, hook compatibility, and size limits
- `test` runs the build + smoke contract across the selected targets

### 8. Build the platform bundles

```bash
bunx pluxx build
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
bunx pluxx install --trust --target claude-code
```

Cursor:

```bash
bunx pluxx install --trust --target cursor
```

Codex:

```bash
bunx pluxx install --trust --target codex
```

Then restart the host app and test real requests.

## Path B: One-Shot Autopilot

Use this when you want Pluxx to do the whole flow for you.

Quick mode:

```bash
bunx pluxx autopilot \
  --from-mcp https://example.com/mcp \
  --runner codex \
  --mode quick \
  --yes
```

Standard mode:

```bash
bunx pluxx autopilot \
  --from-mcp https://example.com/mcp \
  --runner codex \
  --mode standard \
  --yes \
  --name acme \
  --display-name "Acme" \
  --author "Acme"
```

Thorough mode:

```bash
bunx pluxx autopilot \
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

This is the `import auth != runtime auth` split.

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

- [Getting started](./getting-started.md)
- [Practical handbook](./practical-handbook.md)
- [Agent Mode](./agent-mode.md)
- [How it works](./how-it-works.md)
