# Exa Launch Post Draft

Last updated: 2026-04-25

## Working Title

How we turned Exa’s Claude-first plugin shape into native plugins for Claude Code, Cursor, Codex, and OpenCode from one source project

## Subhead

Pluxx took Exa’s public MCP plus the workflow shape of Exa’s official Claude plugin and rebuilt it as a clean-room multi-host plugin with specialist agents, commands, auth, screenshots, and native install surfaces across the core four.

## Draft

Most MCP demos stop too early.

They show that a server can answer requests. They do not show what it takes to turn that server into something that actually feels native inside the coding agents people use every day.

That is the gap Pluxx is trying to close.

To prove that, we built a clean-room Exa example.

We started with:

- Exa’s public MCP
- Exa’s public docs
- the workflow shape of Exa’s official Claude plugin

And we turned that into one maintained Pluxx source project:

- [example/exa-plugin](../example/exa-plugin)

From that one source project, Pluxx now generates native bundles for:

- Claude Code
- Cursor
- Codex
- OpenCode

This is not a copy of Exa’s marketplace plugin internals.

It is a clean-room rebuild of the product shape:

- deep research
- company research
- people research
- code research
- source review
- news briefs

With specialist agents like:

- `people-scout`
- `company-scout`
- `code-scout`
- `news-scout`
- `source-auditor`
- `synthesis-reviewer`

The important thing is that this is not “just skills everywhere.”

The example bundles the Exa MCP connection and layers a real workflow surface on top:

- skills
- commands
- agents / subagents
- permissions
- branding metadata
- screenshots
- auth and setup guidance

That distinction matters.

If all you want is a portable skill pack, Agent Skills already solve a real part of that problem.

Pluxx is solving the harder problem:

how to keep one maintained plugin source project and ship the most native honest version of that experience to each host.

That means:

- preserve where the host supports the same intent
- translate where the host has a different native surface
- degrade only where the host is genuinely weaker

The Exa example ended up being a strong proof surface because it forced the compiler to improve.

While building it, we found and fixed:

- Claude-native agent translation gaps
- Claude command argument-hint UX issues
- permission-hook JSON contract issues
- better behavior around command-wrapped skills vs direct slash discovery
- stronger OpenCode agent/permission modeling

So this was not just “we made a demo.”

It was “a real public example found real compiler gaps and made the product better.”

Today, the Exa example is proven through real host flows:

- Claude Code app
- Cursor interactive flow
- Codex Desktop app
- OpenCode CLI

That is the point of Pluxx in one sentence:

Bring a raw MCP, shape it into a real plugin product, and ship it everywhere that matters from one maintained source project.

If you want the proof and source:

- proof: [docs/exa-research-example.md](./exa-research-example.md)
- source: [example/exa-plugin](../example/exa-plugin)
- install/proof overview: [docs/proof-and-install.md](./proof-and-install.md)

## Short Post Version

We built a clean-room Exa example with Pluxx.

One maintained source project now ships native Exa-powered plugin bundles for Claude Code, Cursor, Codex, and OpenCode.

It is built from:

- Exa’s public MCP
- Exa’s public docs
- the workflow shape of Exa’s official Claude plugin

And it is now live-proven through real host flows in Claude Code, Cursor, Codex Desktop, and OpenCode.

This is the clearest public example we have that raw MCP is not enough.

The product value is the native translation layer.

## Assets To Pair With The Post

- Exa plugin detail page screenshot
- Claude Code Exa workflow screenshot
- Codex Desktop Exa workflow screenshot
- Cursor Exa workflow screenshot
- source project tree image
