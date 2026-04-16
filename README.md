# pluxx

**Build AI agent plugins once. Ship them everywhere.**

pluxx generates native plugin packages for Claude Code, Cursor, Codex, and OpenCode from a single config file. One source of truth &mdash; platform-specific outputs with the right manifests, rules, install scripts, hook handling, and MCP config when your plugin needs it.

The product scope is intentionally tight:

- Pluxx owns the common cross-host plugin-authoring primitives
- Pluxx does not try to model every host-specific extension feature yet

pluxx is now published on npm as `@orchid-labs/pluxx`. The public invocation path is `npx @orchid-labs/pluxx ...`, and the package also works with `npm install -g @orchid-labs/pluxx`. The current launcher still requires Bun at runtime, so keep Bun installed even when using the npm package.

```bash
npx @orchid-labs/pluxx build
```

```
dist/
  claude-code/   .claude-plugin/plugin.json, .mcp.json, CLAUDE.md, hooks/hooks.json, skills
  cursor/        .cursor-plugin/plugin.json, mcp.json, hooks/hooks.json, AGENTS.md, rules/
  codex/         .codex-plugin/plugin.json, .mcp.json, AGENTS.md, interface metadata
```

## Platform Support

| Platform | Status | Validated |
|----------|--------|-----------|
| **Claude Code** | Primary | `claude plugin validate` PASSED |
| **Cursor** | Primary | Docs-audited, hooks + rules covered in lint |
| **Codex** | Primary | Docs-audited, plugin packaging aligned; hooks remain external Codex config |
| **OpenCode** | Primary | Generates JS/TS wrapper, active docs-parity work |
| GitHub Copilot | Beta | Reuses Claude Code format (confirmed compatible) |
| OpenHands | Beta | Generates .plugin/ manifest, needs live testing |
| Warp | Beta | Generates skills + AGENTS.md |
| Gemini CLI | Beta | Generates gemini-extension.json |
| Roo Code | Beta | Generates .roorules + skills |
| Cline | Beta | Generates .clinerules + skills |
| AMP | Beta | Generates AGENT.md + skills |

**Primary** = first-class launch target, actively maintained.
**Beta** = generated, but less validated against live tool behavior.

The mechanically generated source of truth for support and verification is [docs/compatibility.md](./docs/compatibility.md).

If you want the operational version of the docs, start with the [Practical handbook](./docs/practical-handbook.md).
If you want the explicit authoring walkthrough, use [Create a Pluxx plugin](./docs/create-a-pluxx-plugin.md).
If you want the meta guide for using Pluxx *inside* Claude/Codex/Cursor/OpenCode, use [Use Pluxx in host agents](./docs/use-pluxx-in-host-agents.md).
If you want the tightened product scope for what Pluxx should model first, use [Core primitives](./docs/core-primitives.md).
If you want the canonical permissions shape and current host mapping behavior, use [Canonical permissions model](./docs/permissions-canonical-model.md).
If you want the current execution queue with milestones, dependencies, and delegated subtasks, use [Roadmap](./docs/roadmap.md).
If you want the implementation target for release orchestration, use [publish v1 contract](./docs/publish-v1-contract.md).
If you are planning marketplace-aware release flows, use [Marketplace submission prep](./docs/marketplace-submission-prep.md).
If you maintain Pluxx itself and want the npm/GitHub release flow, use [Releasing Pluxx](./docs/releasing-pluxx.md).

## Why?

Tools like `npx skills` install SKILL.md files across agents. That covers **skills**.

But a plugin is more than skills. A plugin bundles:

| Component | What pluxx handles |
|-----------|---------------------|
| **Manifests** | `.claude-plugin/plugin.json` vs `.cursor-plugin/plugin.json` vs `.codex-plugin/plugin.json` |
| **MCP auth** | Claude Code uses `headers`, Codex uses `bearer_token_env_var` plus `env_http_headers` / `http_headers`, Cursor uses Claude Desktop format |
| **Hooks** | Different event names, different JSON schemas, and in Codex's case a separate runtime config path |
| **Rules** | `CLAUDE.md` vs `rules/*.mdc` vs `AGENTS.md` |
| **Brand metadata** | Codex has icons, colors, screenshots, default prompts. Others don't. |
| **Subagents** | Different formats per platform |

Without pluxx you maintain separate copies for each platform. With pluxx you maintain one.

That value exists even if your plugin has no MCP at all. If you are hand-authoring skills, instructions, hooks, commands, or brand metadata, Pluxx still gives you one maintainable cross-host plugin project.

The sharpest launch wedge is still MCP-first authoring: start from an existing MCP server, generate a maintainable plugin scaffold, then keep shipping from one config.

## Core Primitives

Pluxx treats these as the canonical authoring model:

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

These are the primitives that show up repeatedly in real plugins and real host integrations.

## What Pluxx Does Not Model Yet

These features exist in one or more hosts, but they are not the current product center:

- `outputStyles`
- `lspServers`
- `bin/` executables
- `monitors`
- `channels`
- `apps` abstraction
- plugin data-dir abstraction
- statuslines
- themes / keybindings
- sandbox or other user/admin runtime policy

Pluxx should document these and revisit them later, but it should not expand the core mental model around them yet.

When you scaffold from an MCP server, pluxx now drafts workflow-oriented skills from the discovered tools so the first pass is closer to a usable plugin.

The next layer is `Agent` mode: Pluxx prepares the scaffold, context pack, and prompt pack; Claude Code or Codex does the semantic refinement. The product direction is documented in [docs/agent-mode.md](./docs/agent-mode.md).

## Quick Start

```bash
# Preferred public path: run via npx

# Start a plugin by hand
npx @orchid-labs/pluxx init my-plugin
cd my-plugin
# Edit pluxx.config.ts, add skills in ./skills/, then build

# Or scaffold directly from an MCP server
npx @orchid-labs/pluxx init --from-mcp https://example.com/mcp

# Legacy SSE MCP import
npx @orchid-labs/pluxx init --from-mcp https://example.com/sse --transport sse

# Local stdio MCP import
npx @orchid-labs/pluxx init --from-mcp "npx -y @acme/mcp"

# pluxx will introspect the server and draft grouped skills like
# account-research, contact-discovery, hiring-signals, or technographics

# Headless / CI-friendly import
npx @orchid-labs/pluxx init --from-mcp https://example.com/mcp --yes --name acme --display-name "Acme" --author "Acme" --targets claude-code,codex --grouping workflow --hooks safe --json

# Remote MCPs that use custom header auth
npx @orchid-labs/pluxx init --from-mcp https://mcp.playkit.sh/mcp --yes --auth-env PLAYKIT_API_KEY --auth-type header --auth-header X-API-Key --auth-template '${value}'

# OAuth-first MCPs: complete provider OAuth first, then pass the resulting token env var
npx @orchid-labs/pluxx init --from-mcp https://example.com/mcp --yes --auth-env OAUTH_ACCESS_TOKEN --auth-type bearer

# Inspect the generated project without mutating files
npx @orchid-labs/pluxx doctor
npx @orchid-labs/pluxx init --from-mcp https://example.com/mcp --yes --dry-run

# Refresh MCP-derived files later while preserving the custom sections
npx @orchid-labs/pluxx sync --json

# Prepare an agent-facing context pack and prompt pack
npx @orchid-labs/pluxx agent prepare
npx @orchid-labs/pluxx agent prompt taxonomy

# Or run the full import -> refine -> verify path in one shot
npx @orchid-labs/pluxx autopilot --from-mcp https://example.com/mcp --runner codex --mode quick --yes
npx @orchid-labs/pluxx autopilot --from-mcp https://example.com/mcp --runner codex --mode standard --yes --name acme --display-name "Acme" --author "Acme"
npx @orchid-labs/pluxx autopilot --from-mcp https://example.com/mcp --runner codex --mode thorough --yes --verbose-runner

# Or let Claude/Cursor/OpenCode/Codex consume the pack headlessly
npx @orchid-labs/pluxx agent run taxonomy --runner claude
npx @orchid-labs/pluxx agent run taxonomy --runner cursor
npx @orchid-labs/pluxx agent run taxonomy --runner codex
npx @orchid-labs/pluxx agent run review --runner opencode --attach http://localhost:4096 --no-verify

# Validate, build, and smoke-test the generated plugin
npx @orchid-labs/pluxx lint
npx @orchid-labs/pluxx build
npx @orchid-labs/pluxx test
```

`--attach` is only supported for the `opencode` runner.

Autopilot modes:

- `quick`: deterministic scaffold first, and only a taxonomy pass when MCP metadata warnings make it necessary
- `standard`: balanced default; only runs the expensive passes when quality signals or extra docs/context justify them
- `thorough`: always runs taxonomy, instructions, and review before verification

## Product Boundary And Lifecycle

Pluxx is for teams that want one maintained plugin source of truth across hosts.

The best fit today is MCP developers and teams shipping MCP-backed plugins, because MCP import, auth translation, and sync create the most cross-host pain. But hand-authored plugins are still a valid use case.

Pluxx owns:

- plugin authoring scaffold, whether imported from MCP or authored manually
- validation (`lint`, `doctor`, `test`)
- platform bundle generation (`build`)
- local installation for testing (`install`)
- ongoing MCP-to-plugin maintenance (`sync`) for MCP-derived projects

Pluxx does not own:

- deploying or hosting your MCP backend service
- running your production MCP infrastructure

The normal lifecycle is:

1. Start from an MCP import or a hand-authored plugin source repo.
2. Refine the source project.
3. Validate/build/install locally.
4. If the plugin is MCP-backed, repoint sync to the deployed HTTP/SSE MCP when production is ready.
5. Keep the same plugin repo as the long-term source of truth.

Example local-to-production transition:

```bash
# Local development MCP
npx @orchid-labs/pluxx init --from-mcp "npx -y @acme/mcp"

# Later, after your MCP backend is deployed
npx @orchid-labs/pluxx sync --from-mcp https://mcp.acme.com/mcp
```

Publish/distribution today is repo-first:

1. Commit the generated plugin source repo (`pluxx.config.ts`, `skills/`, `INSTRUCTIONS.md`, `.pluxx/mcp.json`).
2. Build platform bundles with `npx @orchid-labs/pluxx build`.
3. Distribute those bundles through your target channels (internal repo, releases, or platform-specific publish paths).

Pluxx is the distribution and maintenance layer for plugin artifacts; MCP service deployment remains your responsibility.

Generated MCP skill files include deterministic example requests derived from tool names and required inputs, so the first scaffold is useful before any AI refinement.

Agent Mode stays file-first: Pluxx writes `.pluxx/agent/context.md`, `.pluxx/agent/plan.json`, and the prompt packs, then optional runner adapters can hand those files to `claude`, `opencode`, or `codex` in headless mode. Durable project-level prompt and context customization now lives in `pluxx.agent.md`, so users do not need to edit generated `.pluxx/agent/*.md` files directly.
Runner output is summarized by default for `pluxx agent run` and `pluxx autopilot`; use `--verbose-runner` when you want full headless runner streaming.

The dogfood coverage matrix across messy metadata, local stdio, OAuth-first servers, and production auth patterns is documented in [docs/mcp-dogfood-matrix.md](./docs/mcp-dogfood-matrix.md).

For dogfooding inside Codex, this repo also ships a local plugin/skill pack at [plugins/pluxx](/Users/brandonguerrero/Documents/Orchid Automation/Orchid Labs/pluxx/plugins/pluxx) with focused skills for import, taxonomy refinement, instructions, review, and sync.
There is now also a first-class self-hosting source project at [example/pluxx](/Users/brandonguerrero/Documents/Orchid Automation/Orchid Labs/pluxx/example/pluxx) that uses one Pluxx config to generate Claude Code, Cursor, Codex, and OpenCode outputs for the Pluxx plugin itself.

```bash
# Optional: global install still shells out to Bun
npm install -g @orchid-labs/pluxx
pluxx init my-plugin

# Scaffold a new plugin
cd my-plugin

# Edit pluxx.config.ts, create skills in ./skills/

# Build for all platforms
npx @orchid-labs/pluxx build

# Lint against all platform rules (47 checks)
npx @orchid-labs/pluxx lint

# Diagnose local runtime + config health
npx @orchid-labs/pluxx doctor

# Run config, lint, build, and smoke checks together
npx @orchid-labs/pluxx test

# Build for specific platforms
npx @orchid-labs/pluxx build --target claude-code cursor codex opencode

# Validate your config
npx @orchid-labs/pluxx validate
```

## Config

```typescript
// pluxx.config.ts
import { definePlugin } from '@orchid-labs/pluxx'

export default definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  description: 'What your plugin does',
  author: { name: 'Your Name' },

  // Skills (Agent Skills standard — shared across all platforms)
  skills: './skills/',

  // MCP servers (auth format auto-translated per platform)
  mcp: {
    'my-server': {
      url: 'https://my-server.com/mcp',
      auth: {
        type: 'bearer',
        envVar: 'MY_API_KEY',
      },
    },
  },

  // Hooks (generated where the platform supports plugin-packaged hooks;
  // Codex currently keeps hook config in .codex/hooks.json outside plugin bundles)
  hooks: {
    sessionStart: [{
      command: '${PLUGIN_ROOT}/scripts/setup.sh',
    }],
  },

  // Instructions (generates CLAUDE.md, AGENTS.md, or .mdc rules)
  instructions: './INSTRUCTIONS.md',

  // Brand (used by platforms that support rich metadata)
  brand: {
    displayName: 'My Plugin',
    color: '#3B82F6',
    icon: './assets/icon.svg',
    defaultPrompts: ['Try my plugin with this prompt'],
  },

  // Target platforms
  targets: ['claude-code', 'cursor', 'codex', 'opencode'],
})
```

## What Gets Generated

### MCP Config Translation

You write one auth config. pluxx generates the correct format for each platform:

```typescript
// You write:
mcp: {
  server: {
    url: 'https://api.example.com/mcp',
    auth: { type: 'bearer', envVar: 'API_KEY' },
  },
}
```

```jsonc
// Claude Code gets:
{ "headers": { "Authorization": "Bearer ${API_KEY}" } }

// Codex gets:
{
  "env_http_headers": {
    "X-API-Key": "API_KEY"
  }
}

// Cursor gets:
{ "headers": { "Authorization": "Bearer ${API_KEY}" } }
```

### Plugin Manifests

Each platform gets its native manifest format:

- **Claude Code**: `.claude-plugin/plugin.json` with skills, commands paths
- **Cursor**: `.cursor-plugin/plugin.json` with explicit `rules/`, `hooks/hooks.json`, and `mcp.json` component paths
- **Codex**: `.codex-plugin/plugin.json` with full `interface` block (brand color, icons, screenshots, default prompts, capabilities) plus external hooks via `.codex/hooks.json`
- **OpenCode**: npm package + JS/TS plugin wrapper

### Instructions to Platform-Native Rules

Your single `INSTRUCTIONS.md` becomes:
- `CLAUDE.md` for Claude Code
- `AGENTS.md` for Codex and Cursor
- `.mdc` rule files in `rules/` for Cursor (with frontmatter) when you specify rules in platform overrides

### 47 Lint Checks

`pluxx lint` catches platform-specific gotchas before you ship:

- Codex rejects SKILL.md descriptions over 1024 characters
- Claude Code silently truncates descriptions at 250 characters
- Cursor and Cline require skill names to match their directory names
- Codex allows max 3 default prompts, 128 chars each
- Claude Code hook events must be PascalCase (26 valid events)
- Manifest paths must start with `./` and cannot contain `../`
- Plugin directories must be at root, not inside `.claude-plugin/`
- Version must follow semver format
- And 39 more checks across all platforms

### Read-Only Diagnostics And Verification

- `pluxx doctor` checks Bun/runtime health, config loadability, configured paths, MCP auth/transport shape, scaffold metadata, and install trust advisories.
- `pluxx test` runs the default verification stack for a plugin project: config load, lint, build, and generated-output smoke checks.
- `--json` is available for machine-readable output on `init --from-mcp`, `sync`, `doctor`, `lint`, `build`, `install --dry-run`, and `test`.
- `--dry-run` previews file writes for `init --from-mcp` and `sync`, install paths for `install`, and output targets for `build`.

### Platform Overrides

For the 10% of cases where platforms diverge:

```typescript
platforms: {
  'claude-code': {
    skillDefaults: { effort: 'high' },
  },
  cursor: {
    rules: [{
      description: 'My conventions',
      alwaysApply: false,
    }],
  },
  codex: {
    interface: {
      capabilities: ['Interactive', 'Write'],
      privacyPolicyURL: 'https://example.com/privacy',
    },
  },
}
```

## Real-World Examples

### Megamind (client intelligence plugin)

The [example/megamind](./example/megamind) directory contains a full plugin that was previously hand-maintained as two separate copies. With pluxx, one config generates outputs for all platforms.

```bash
cd example/megamind
npx @orchid-labs/pluxx build
```

### Prospeo (sales intelligence MCP)

The [examples/prospeo-mcp](./examples/prospeo-mcp) directory wraps a real MCP server into a multi-platform plugin with 4 skills:

```bash
cd examples/prospeo-mcp
npx @orchid-labs/pluxx build   # 52 files across 7 platforms
npx @orchid-labs/pluxx lint    # Catches real platform gotchas
```

## Testing Locally

```bash
# Check project health before generating anything
npx @orchid-labs/pluxx doctor

# Build and install to Claude Code
npx @orchid-labs/pluxx build
npx @orchid-labs/pluxx install --target claude-code

# Run the full plugin verification contract
npx @orchid-labs/pluxx test

# Validate with Claude Code's own validator
claude plugin validate ~/.claude/plugins/my-plugin
# ✓ Validation passed
```

## CI / Automation

Pluxx now ships a reusable GitHub workflow for plugin repos:

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

For headless local automation, prefer:

```bash
npx @orchid-labs/pluxx init --from-mcp https://example.com/mcp --yes --json
npx @orchid-labs/pluxx sync --dry-run --json
npx @orchid-labs/pluxx test --json
```

See [docs/getting-started.md](./docs/getting-started.md) for the full getting-started walkthrough, including the MCP-first path.

## Hook Trust Model

Hook commands are shell commands that execute on your machine when hook events fire. If you install a third-party plugin with hooks, you are trusting that plugin author with local command execution.

`pluxx install` now warns when the plugin config contains command hooks and prints each event/command pair before install proceeds.

Use `--trust` to bypass the confirmation prompt (useful in CI/non-interactive environments):

```bash
npx @orchid-labs/pluxx install --trust
```

## CLI Commands

| Command | What it does |
|---------|-------------|
| `pluxx init` | Interactive scaffold for a new plugin or `--from-mcp` import |
| `pluxx doctor` | Read-only runtime, config, MCP, and trust diagnostics |
| `pluxx build` | Generate plugin packages for all target platforms |
| `pluxx lint` | 47 checks against all platform rules |
| `pluxx test` | Run config, lint, build, and smoke checks together |
| `pluxx sync` | Refresh MCP-derived scaffold files while preserving custom sections |
| `pluxx validate` | Validate your config schema |
| `pluxx install` | Symlink built plugins for local testing (prompts when hook commands exist) |
| `pluxx install --trust` | Bypass hook trust confirmation |
| `pluxx uninstall` | Remove symlinked plugins |
| `pluxx dev` | Watch mode with auto-rebuild on file changes |
| `pluxx migrate <path>` | Import an existing single-platform plugin |

## How It Works

```
pluxx.config.ts          <- You define your plugin once
       |
       v
  +---------+
  |  Parse  |              Zod schema validation
  +----+----+
       |
       v
  +--------+
  |  Lint  |               47 platform-specific checks
  +----+---+
       |
       v
  +----------+
  | Generate |             Platform-specific generators
  +-+--+--+--+
    |  |  |
    v  v  v
  Claude  Cursor  Codex    + 8 beta platforms
  Code
```

## Comparison

| | pluxx | npx skills | SkillKit |
|---|:---:|:---:|:---:|
| Install skills to multiple agents | - | Yes | Yes |
| Generate plugin manifests | Yes | - | - |
| MCP config with auth translation | Yes | - | - |
| Hook generation per platform | Yes | - | - |
| Brand/interface metadata | Yes | - | - |
| Rules/instructions generation | Yes | - | Translate only |
| Cross-platform lint (47 checks) | Yes | - | - |
| Subagent configs | Yes | - | - |

**pluxx builds plugins. The others install skills.** They're complementary — use `npx skills` to distribute your skills, use pluxx to build the full plugin package.

## Built On

- [Agent Skills](https://agentskills.io/) open standard (skills are pass-through, never modified)
- [Zod](https://zod.dev/) for config validation with full TypeScript inference
- [Bun](https://bun.sh/) for fast builds and TypeScript-native execution

## Roadmap

- [x] Core schema with Zod validation
- [x] Generators: Claude Code, Cursor, Codex (fully supported) + 8 beta platforms
- [x] CLI: `build`, `validate`, `init`, `lint`, `install`, `uninstall`, `dev`, `migrate`
- [x] MCP auth normalization across platforms
- [x] 47 lint checks from official docs (Firecrawl-verified)
- [x] Real-world examples (Megamind + Prospeo)
- [ ] `pluxx lint --fix` — auto-apply suggested fixes
- [x] `pluxx init --from-mcp` — auto-scaffold plugins from existing MCP servers
- [x] `pluxx doctor` — project and runtime health checks
- [x] `pluxx test` — verification command for plugin repos
- [x] CI/CD GitHub Action / reusable workflow
- [x] canonical `userConfig` / install-time secret handling
- [x] `pluxx publish` v1 — npm, GitHub Release, dry-run, and tag-based release workflow
- [ ] `pluxx diff` — show what changed per platform
- [ ] Plugin analytics dashboard
- [ ] Promote beta platforms to fully supported

Current focus:

- build-time target cap validation for primary targets
- deeper OAuth/auth discovery and MCP protocol depth
- docs/site polish and product-branding system

## License

MIT
