# pluxx — Strategy & Positioning

## The Core Insight

An MCP server is just plumbing. It's the API layer. The **agent experience** is everything that wraps it — and that's the hard part nobody is solving.

The difference between "here's a tool the agent *can* call" and "here's an agent that *knows how* to do the job" is:

- **Skills** that teach the agent *how* to use the tools effectively
- **Hooks** that set up context at the right moments
- **Rules & instructions** that shape agent behavior
- **Default prompts** that show users what's possible
- **Subagents** for complex multi-step workflows
- **Brand metadata** for marketplace discoverability

A raw MCP server is like shipping an API with no docs, no SDK, no examples. pluxx ships the full experience.

## Positioning Statement

> **Ship the best possible agent experience on every platform, from a single source of truth.**

Not just "build once, ship everywhere" — the emphasis is on **quality of experience**. Without pluxx, most plugin authors optimize for one platform and ship a half-baked port to the others. pluxx ensures users on Cursor get a Cursor-native experience, users on Claude Code get a Claude-native experience, and users on Codex get a Codex-native experience — all from one config.

## Target Audience

**Anyone shipping an MCP server or agent-native experience.**

This includes:
- **SaaS companies** adding AI agent integrations (the next "build a Slack bot" wave)
- **MCP server authors** who want their server to actually be usable across platforms
- **Plugin developers** building for multiple AI coding tools
- **Dev tool companies** shipping agent-native experiences alongside their CLI/API
- **Open-source maintainers** who want their project to "just work" in any AI agent

The market is everyone who builds for AI agents — and that market is growing exponentially.

## The Agent Experience Gap

There's a growing gap between "MCP server exists" and "this actually works great in my agent."

| Layer | What it is | Who solves it |
|-------|-----------|---------------|
| **MCP server** | Tool endpoints, API access | Manufact, raw SDKs, hand-rolled |
| **Agent experience** | Skills, hooks, rules, prompts, brand, manifests | **pluxx** (nobody else) |
| **Distribution** | Marketplace listings, installs, updates | Platform-specific (fragmented) |

pluxx owns the middle layer — the one that turns infrastructure into a product.

## Competitive Landscape

### Manufact (mcp-use)
- **What they do**: Build and deploy MCP servers. Open-source SDK + cloud hosting.
- **Traction**: 5M+ downloads, 9K GitHub stars, YC S25, $6.3M raised, 20% of US 500.
- **Relationship to pluxx**: **Complementary, not competitive.** They build/host the MCP server. pluxx packages the full plugin experience around it for 11+ platforms.
- **Key gap they don't fill**: No multi-platform plugin packaging. No skills, hooks, rules, or manifest generation. No cross-platform validation.

### npx skills (Agent Skills)
- **What they do**: Install SKILL.md files into a project.
- **Limitation**: Doesn't handle manifests, MCP configs, hooks, rules, or any platform-specific output.

### SkillKit
- **What they do**: Translate rules between platforms.
- **Limitation**: Rules only. No manifest generation, no MCP auth normalization, no hooks, no brand metadata.

### Hand-rolling it
- **What most people do today**: Maintain separate configs per platform manually.
- **Pain**: Duplicate work, platform-specific bugs, missed quirks (47 lint checks worth of gotchas).

**pluxx is the only tool that ships the complete agent experience across platforms.**

## Why pluxx Wins Long-Term

### 1. The fragmentation tailwind
Every new AI coding agent that launches widens our moat. 11 platforms today, 20+ by year-end. The manual approach doesn't scale. pluxx does.

### 2. Deep platform knowledge as a moat
47 cross-platform lint checks. Max description lengths, naming conventions, auth format quirks, hook event mappings, manifest schema differences. This is hard-won, scraped-and-codified knowledge that compounds over time.

### 3. The experience layer is platform-specific
The MCP server is the same everywhere. But the experience around it is completely different per platform:
- Claude Code needs `CLAUDE.md` + `hooks.json` + PascalCase events
- Cursor needs `.cursorrules` + `.mdc` files + camelCase events
- Codex needs `AGENTS.md` + rich interface metadata + `bearer_token_env_var`

This translation layer is inherently multi-platform. You can't solve it from one platform's perspective.

### 4. Network effects via registry
Once `pluxx publish` and pluxx.dev exist, we become the cross-platform plugin directory. One plugin page with install buttons for all 11 agents. That's the npmjs.com moment for AI agent plugins.

## Acquisition Angle

### Why Manufact should acquire pluxx
- They have **build + deploy**. pluxx completes the picture with **package + distribute + validate**.
- Full lifecycle: build → deploy → package → distribute → lint → update.
- Building cross-platform plugin packaging in-house would take months and distract from their core SDK/cloud business.
- 47 lint rules worth of platform quirks already codified — this is months of deep research they'd skip.

### pluxx leverage
- First mover in multi-platform agent plugin packaging
- Deep platform knowledge that's expensive to replicate
- Complementary positioning (no overlap, pure value-add)
- Growing market need as MCP adoption accelerates

### Alternative acquirers
- **Cursor / Anysphere** — Owns one platform, could use pluxx to attract plugin developers by making their ecosystem easier to build for
- **OpenAI (Codex)** — Same logic; attract plugin supply by lowering friction
- **Vercel / Netlify** — Developer tools play; pluxx fits the "deploy everything" narrative

## Strategic Roadmap

### Now (weeks 1-2)
- Ship `npx pluxx init` publicly (npm publish)
- Launch content: HN, Reddit, Twitter, Discord channels
- Tutorial: "Deploy with Manufact, distribute with pluxx"

### Next (months 1-2)
- `pluxx init --from-mcp` — Auto-scaffold from existing MCP server (zero friction on-ramp)
- `pluxx publish` — Push to platform marketplaces
- CI/CD GitHub Action — Make pluxx sticky in team workflows
- Outreach to Manufact for partnership/integration

### Later (months 3-6)
- **pluxx.dev registry** — Cross-platform plugin directory with per-agent install buttons
- Analytics dashboard (installs per platform per day)
- Team plugin registries (enterprise)
- Additional generators as new agents launch

## Distribution: The Real Product

Building plugins is step one. **Getting them to users** is where the value compounds.

### The Problem Today

Distribution for AI agent plugins is completely fragmented:
1. Find the plugin on Cursor marketplace → install for Cursor
2. Separately find it (if it exists) for Claude Code → install differently
3. Hope someone ported it to Codex → probably not
4. Repeat for every agent you use

Plugin authors have it worse — they need to manually submit to each marketplace, maintain separate listings, and track installs across disconnected dashboards.

### pluxx publish — Automated Marketplace Syndication

`pluxx publish` takes the generated platform-specific outputs and submits them directly:

```
$ pluxx publish

Publishing cool-plugin v1.2.0...

  Cursor marketplace    → submitted (pending review)
  Codex plugin directory → submitted (pending review)
  npm (OpenCode)        → published @cool/cool-plugin@1.2.0
  pluxx.dev registry    → live

Published to 4 platforms.
```

- `pluxx publish --target cursor` → submit to Cursor's marketplace via their API
- `pluxx publish --target codex` → submit to OpenAI's plugin directory
- `pluxx publish --target npm` → publish the OpenCode package to npm
- `pluxx publish` → all platforms at once

### pluxx.dev — The Cross-Platform Plugin Registry

The bigger play. One directory for all AI agent plugins:

- Plugin authors publish once to pluxx.dev
- Users browse one catalog and see install buttons for *their* agent
- "Install in Claude Code" / "Install in Cursor" / "Install in Codex" — one-click per platform
- **Homebrew for AI agent plugins**, or the Chrome Web Store but agent-agnostic

This is a network effects play. Every plugin listed makes the registry more valuable to users. Every user browsing makes the registry more valuable to plugin authors.

### pluxx add — Universal Install Protocol

For end users, one command installs a plugin across every agent on their machine:

```
$ npx pluxx add @company/cool-plugin

Detected agents: Claude Code, Cursor, Codex

  Claude Code → installed (.claude-plugin/, CLAUDE.md, hooks, MCP)
  Cursor      → installed (.cursor-plugin/, .cursorrules, hooks, MCP)
  Codex       → installed (.codex-plugin/, AGENTS.md, hooks, MCP)

Done! cool-plugin is ready in all 3 agents.
```

- Auto-detects which agents are installed locally
- Pulls the right platform-specific package for each
- Sets up manifests, MCP configs, hooks, rules — everything
- One install, every agent gets the full native experience

### The Distribution Multiplier

For plugin authors, the pitch evolves:

| Stage | Value proposition |
|-------|------------------|
| **pluxx build** | "Save time packaging" |
| **pluxx publish** | "Reach every AI agent user from one publish" |
| **pluxx.dev** | "Your plugin, discoverable to the entire agent ecosystem" |
| **pluxx add** | "Users install once, it works everywhere" |

A plugin on pluxx.dev instantly gets 11x the addressable market vs. publishing to a single marketplace.

### Revenue Model (The Vercel Playbook)

| Tier | What | Price |
|------|------|-------|
| **Free** | `pluxx build`, `pluxx lint`, `pluxx validate` — local CLI, forever free | $0 |
| **Pro** | `pluxx publish` to pluxx.dev + marketplace syndication, install analytics (by platform, by day), plugin update notifications | $49/mo |
| **Team** | Private plugin registries, team management, shared configs, priority syndication | $199/mo |
| **Enterprise** | SSO, audit logs, custom registry domains, SLA, dedicated support | $499/mo |

Open source CLI is free. The cloud platform is the business. Same playbook as Vercel (Next.js), Hashicorp (Terraform), and Netlify (static sites).

## The Big Picture

The AI agent ecosystem is going through the same fragmentation phase that mobile (iOS/Android), browsers (Chrome/Firefox/Safari), and package managers (npm/yarn/pnpm) went through. In every case, the abstraction layer that unified the fragmentation became critical infrastructure.

pluxx is that abstraction layer for AI agent plugins.

The trajectory:
1. **Tool** — `pluxx build` solves the packaging problem (today)
2. **Platform** — `pluxx publish` + pluxx.dev solves the distribution problem (next)
3. **Infrastructure** — pluxx becomes how plugins get built, discovered, installed, and updated across the entire agent ecosystem (endgame)
