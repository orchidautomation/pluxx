# Ultracite Teardown — The Model to Emulate

## What Ultracite Is
A zero-config linting/formatting preset (Biome, ESLint, Oxlint) that generates agent-specific rules, hooks, and configs for 44+ AI coding agents and 9+ editors. Built by Hayden Bleasel (formerly at Vercel).

## Stats
- **2.8K GitHub stars**, 101 forks, 54 contributors, 1,582 commits
- **1,700+ dependents** (projects using it)
- **346 releases** (v7.4.2 as of March 2026)
- **Used by**: Vercel, Adobe, Clerk, Tencent, PostHog, Sentry, Raycast, ElevenLabs, Mintlify, Resend
- **shadcn endorsement**: "I've switched to Ultracite for most of my projects now. Can recommend." (1.1K likes)
- Docs on Mintlify (docs.ultracite.ai)
- Landing page on Next.js/Vercel (ultracite.ai)

## Key Insight: They Tried and Killed a Cloud Product
PR #597 on March 5, 2026: "Close Ultracite Cloud" — they had a paid cloud service and shut it down. This means:
1. The linting space might not support a SaaS layer
2. OR they pivoted strategy and are monetizing differently (sponsorships, consulting)
3. Important lesson for us: the cloud product needs to offer clear value beyond what the CLI does

## What They Generate Per Agent

### Claude Code (`--agents claude`)
- `.claude/CLAUDE.md` — linting rules as markdown instructions
- `.claude/settings.json` — PostToolUse hook that runs `npm run fix` after edits

### Codex (`--agents codex`)
- `AGENTS.md` — same linting rules content, different file path
- No hooks (Codex doesn't support their hook format)

### Cursor (`--agents cursor`)
- `.cursor/rules/ultracite.mdc` — rules in MDC format with frontmatter
- `.cursor/hooks.json` — hooks for post-edit formatting

### Pattern: Same Content, Different Containers
Ultracite's genius is that the **content** (linting rules) is identical across agents. The only thing that changes is:
1. Which file it goes in (CLAUDE.md vs AGENTS.md vs .mdc)
2. Whether hooks are supported (Claude Code yes, Codex no)
3. The hook format (Claude Code settings.json vs Cursor hooks.json)

## Their CLI Flow
```bash
$ bun x ultracite@latest init

◇ Which formatters / linters do you want to use?
│ Biome

◇ Which frameworks are you using?
│ React, Next.js

◇ Which editors do you want to configure?
│ VSCode / Cursor / Windsurf

◇ Which agent files do you want to add?
│ Universal, Claude

◇ Which agent hooks do you want to enable?
│ Cursor, Claude Code

◆ Would you like any of the following Git hooks?
│ ◻ Husky
│ ◻ Lefthook
│ ◻ Lint-staged
```

## Their Landing Page Structure (Emulate This)
1. **Hero**: "A production-grade, zero-configuration preset for [tools]"
2. **Terminal demo**: Interactive init flow
3. **Trust logos**: Vercel, Adobe, Clerk, Tencent, PostHog, Sentry...
4. **Zero-config showcase**: Framework selector → config preview
5. **Agent grid**: 44 agent logos (4 across, each clickable to /agents/<name>)
6. **Editor grid**: 9 editor logos
7. **Social proof**: Embedded tweets (shadcn, goncy, etc.)
8. **CTA**: "Install in seconds. Run in milliseconds."

### Per-Agent Pages (ultracite.ai/agents/<name>)
Each agent gets its own page with:
- Agent logo + "Ultracite for [Agent Name]"
- "Use Ultracite with [Agent] when you want..." positioning
- **Setup details**: Config file path, write mode, header handling, hook support
- **File preview**: Shows exact generated content with tabs
- **"Best for"**: 3 use case cards
- **"Why this setup works"**: 3 differentiator cards
- **"Related agents"**: 3 similar agents as cards
- **FAQ**: 2-3 common questions
- **Trust logos** (repeated)
- **Social proof** (repeated)

## What We Should Steal

### 1. The Agent Grid
44 agents, 4 per row, each with logo + name. Clickable to per-agent detail page. This is the hero visual. We should have the same grid but for "which agents plugahh generates plugins for."

### 2. Per-Agent Pages
`plugahh.dev/agents/claude-code` showing exactly what gets generated (manifest, MCP config, hooks, skills) with file previews. This is the SEO play — each page ranks for "[agent name] plugin."

### 3. Terminal Demo
Show the `npx plugahh init` → `npx plugahh build` flow with the output tree.

### 4. The Init Flow
Interactive prompts like Ultracite. We should have:
```bash
$ npx plugahh init

◇ What's your plugin name?
│ megamind

◇ Does your plugin connect to an MCP server?
│ Yes → URL + auth env var

◇ Which platforms do you want to target?
│ Claude Code, Cursor, Codex, OpenCode

◇ Do you want brand metadata? (icons, colors)
│ Yes → display name, color, icon path
```

### 5. Trust Through Specificity
Each agent page shows EXACTLY what files get written, with code previews. No hand-waving. "Here's the .claude-plugin/plugin.json we generate. Here's the .mcp.json. Here's the hooks.json."

### 6. Sponsorship Model
Ultracite is funded via GitHub Sponsors. They killed their cloud product. We should learn from this — the paid tier needs to offer genuinely different value (publish, analytics, team features) not just "hosted version of the CLI."

## How plugahh Is Different From Ultracite

| | Ultracite | plugahh |
|---|---|---|
| **What it generates** | Linting rules + hooks | Full plugin packages |
| **Core content** | Coding standards (same everywhere) | Skills, MCP, hooks, manifests (different per platform) |
| **MCP handling** | No | Yes — auth translation across platforms |
| **Plugin manifests** | No | Yes — .claude-plugin, .cursor-plugin, .codex-plugin |
| **Brand metadata** | No | Yes — Codex interface block |
| **Skills** | No (generates rules, not skills) | Yes — Agent Skills standard passthrough |
| **Revenue model** | Open source + sponsorship (killed cloud) | Open source CLI + paid cloud (publish, analytics, teams) |

## The Lesson
Ultracite proves the "one CLI, multi-agent output" model works and can get real traction (2.8K stars, shadcn endorsement, major company adoption). But they monetize through **sponsorship** not SaaS. For us, the paid tier needs to solve a problem the CLI genuinely can't — marketplace publishing, cross-platform analytics, and team coordination are that problem.
