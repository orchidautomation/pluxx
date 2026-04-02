# Positioning

## One-Liner
Build AI agent plugins once. Ship them everywhere.

## Elevator Pitch
Every SaaS company needs their product inside AI coding tools — Claude Code, Cursor, Codex, OpenCode. But each platform has different plugin formats, different MCP auth, different hooks, different manifests. plugahh lets you define your plugin once and generates native packages for all of them.

## Category
Developer Infrastructure — Cross-Platform AI Agent Plugin SDK

## Positioning Statement
For **developer tool companies and SaaS teams** who need their product to work inside AI coding agents, plugahh is a **cross-platform plugin build tool** that generates native plugin packages from a single config. Unlike `npx skills` which installs skill files, plugahh generates the **full plugin** — manifests, MCP configs with auth translation, hooks, rules, brand metadata, and install scripts.

## Taglines (test these)
- "Build AI agent plugins once. Ship them everywhere."
- "One config. Four platforms. Zero duplication."
- "The SDK for AI agent plugins."
- "Stop maintaining 4 copies of the same plugin."

## Key Differentiator
**plugahh builds plugins. The others install skills.**

Skills are one component of a plugin. A plugin also needs manifests, MCP server configs (with different auth formats per platform), hooks, rules/instructions, brand metadata, agent configs, and install scripts. Nobody else generates all of that.

## Competitive Positioning

```
                    Skills Only ──────────────── Full Plugins
                         │                           │
  npx skills ●           │                           │
  SkillKit   ●           │                           │
  build-skill ●          │                           │
                         │                      ● plugahh
                         │                           │
                    Install ────────────────── Generate
```

## ICP (Ideal Customer Profile)

### Primary: SaaS/Dev Tool Companies
- Building MCP servers for their product
- Need presence in Claude Code, Cursor, Codex marketplaces
- Don't want to maintain 4 plugin variants
- Examples: Sentry, Linear, Vercel, Supabase, any company with an MCP server

### Secondary: Developer Agencies / Consultancies
- Building AI integrations for clients
- Need to ship to whatever tool the client uses
- Value speed and consistency

### Tertiary: Open Source Maintainers
- Want their tool discoverable in AI coding agents
- Need the simplest path to multi-platform plugins
- Price-sensitive (free tier users, convert on publish/analytics)

## Buyer Persona
**Name**: "Alex the Platform Engineer"
**Role**: Senior engineer / DX lead at a dev tool company
**Pain**: "We built an MCP server. Now product wants us in the Cursor marketplace AND Claude Code AND Codex. That's 3 different manifest formats, 3 different MCP auth configs, 3 sets of hooks. I don't want to maintain all of that."
**Trigger**: Company decides to go multi-platform with their AI agent integration
**Decision**: Evaluates in < 30 minutes. `npx plugahh init` → edits config → `npx plugahh build` → sees 4 correct outputs → adopts.
