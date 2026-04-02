# Agent Support Matrix — 40 AI Coding Agents Analyzed

## Tier 1: Full Plugin Systems (have manifests — plugahh targets)

### Currently supported (4)

| Agent | Manifest | Skills | MCP | Hooks | Rules |
|-------|----------|:------:|:---:|:-----:|:-----:|
| **Claude Code** | `.claude-plugin/plugin.json` | Yes | Yes | Yes | CLAUDE.md |
| **Cursor** | `.cursor-plugin/plugin.json` | Yes | Yes | Yes | .mdc + AGENTS.md |
| **Codex** | `.codex-plugin/plugin.json` | Yes | Yes | Yes | AGENTS.md |
| **OpenCode** | JS/TS module (`@opencode-ai/plugin`) | Yes | Yes | Yes | AGENTS.md |

### High-priority new targets (7)

| Agent | Manifest | Effort | Notes |
|-------|----------|--------|-------|
| **GitHub Copilot CLI** | `plugin.json` (Claude-compatible!) | LOW | Same format as Claude Code. Huge user base. |
| **Gemini CLI** | `gemini-extension.json` | MEDIUM | Unique manifest with MCP + hooks + skills bundled |
| **OpenHands** | `.plugin/plugin.json` (Claude-compatible) | LOW | Same format as Claude Code |
| **Qwen Code** | `qwen-extension.json` | MEDIUM | Similar to Gemini CLI. Big in Asia. |
| **OpenClaw** | `openclaw.plugin.json` | MEDIUM | 13K+ skills ecosystem. Unique manifest. |
| **Kimi CLI** | `plugin.json` with `tools` array | MEDIUM | Tools are executables, not instructions |
| **Warp** | Skills + MCP + AGENTS.md | LOW | Reads .agents/skills/ dirs |

### Manifest format families

| Format | Agents |
|--------|--------|
| `.claude-plugin/plugin.json` | Claude Code, GitHub Copilot CLI, OpenHands |
| `.cursor-plugin/plugin.json` | Cursor |
| `.codex-plugin/plugin.json` | Codex |
| JS/TS module | OpenCode |
| `gemini-extension.json` | Gemini CLI |
| `qwen-extension.json` | Qwen Code |
| `openclaw.plugin.json` | OpenClaw |
| `plugin.json` (Kimi tools) | Kimi CLI |

**Key insight**: Claude Code's manifest format is used by 3 agents (Claude Code, GitHub Copilot CLI, OpenHands). Our Claude Code generator already covers them with minimal changes.

## Tier 2: Skills + MCP + Rules (no manifest, but strong extension points)

| Agent | Skills | MCP | Hooks | Rules | Notes |
|-------|:------:|:---:|:-----:|:-----:|-------|
| **Roo Code** | Yes (+modes) | `.roo/mcp.json` | No | `.roorules` | Large VS Code base, Cline fork |
| **Kilo Code** | Yes | Yes | No | Yes | Active marketplace |
| **Cline** | Yes (ACP) | Yes (marketplace) | `.clinerules/hooks/` | `.clinerules` | Huge VS Code installs |
| **AMP (Sourcegraph)** | Yes | Yes | `.amp/settings.json` | `AGENT.md` | Toolboxes system |
| **Junie (JetBrains)** | Yes | Yes | No | Guidelines | One-click Claude/Codex migration |
| **Goose (Block)** | Yes (hot-reload) | Yes (3K+ servers) | No | No | MCP-first, "toolkits" |
| **Replit Agent** | Yes | Yes | No | No | Skills Search for browsing |
| **Mistral Vibe** | Yes (slash cmds) | Yes | No | No | `.toml` agent configs |
| **Continue** | No | Yes (agent mode) | No | `.continuerules` | Hub for sharing configs |

## Tier 3: MCP Only

| Agent | MCP | Notes |
|-------|:---:|-------|
| Amazon Q CLI | Yes | `~/.aws/amazonq/mcp.json` |
| Augment Code | Yes | `~/.augment/settings.json` |
| Devin | Yes | Closed system, has own MCP server |
| Lovable | Yes | Remote HTTP/SSE only |
| Firebase Studio | Yes | Inherits from Gemini CLI |
| Firebender | Yes | JetBrains plugin |
| Qoder | Yes | JetBrains plugin |
| Snowflake Cortex | Yes | Managed MCP server |
| Vercel Agent | Yes | Uses skills.sh ecosystem |
| Zencoder | Yes | 100+ pre-built servers |

## Tier 4: Minimal/No Extensibility

Aider, Crush, Deepagents, Droid, Jules, MCPJam, Mux, Ona, AdaL

## Generator Roadmap (Priority Order)

### Phase 1 (current): 4 generators
Claude Code, Cursor, Codex, OpenCode

### Phase 2 (next): +3 low-effort generators
GitHub Copilot CLI (reuse Claude Code generator), OpenHands (reuse Claude Code generator), Warp (skills + AGENTS.md)

### Phase 3: +4 medium-effort generators
Gemini CLI, Qwen Code, OpenClaw, Kimi CLI

### Phase 4: +4 config-only generators
Roo Code, Cline, Kilo Code, AMP

### Total addressable: 15 agents with full generators

## The Marketing Number

**"plugahh generates plugins for 15+ AI coding agents from a single config."**

That's the number to put on the landing page. With the agent logo grid from all 15.
