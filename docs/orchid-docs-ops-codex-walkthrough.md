# From One Pluxx Source Project To A Native Codex Plugin

This is the first end-to-end walkthrough of the `docs-ops` flagship example running inside Codex against a live Docsalot MCP surface.

It is also the clearest short explanation of what Pluxx is actually trying to do.

## The Problem

Raw MCP access is usually not enough.

A hosted MCP can expose useful tools, but it still leaves a lot of work undone:

- the workflow is not shaped
- instructions are thin
- setup and auth guidance are easy to miss
- the experience differs across Claude Code, Cursor, Codex, and OpenCode
- teams end up maintaining multiple drifting host-native plugin surfaces by hand

For docs workflows, that gap is obvious.

A docs MCP may let an agent search or read pages, but a strong operator experience also needs:

- a clear inspect flow
- focused pull and rewrite flows
- review steps
- validation scripts
- publish and rollback intent

That is what Pluxx is for.

## What Pluxx Is

Pluxx is the authoring, maintenance, and compilation layer for cross-host agent plugins.

The promise is simple:

> maintain one plugin source project, then ship native bundles for Claude Code, Cursor, Codex, and OpenCode

In this walkthrough, the source project is:

- `example/docs-ops`

And the live MCP backend is:

- `https://orchid-docs.docsalot.dev/api/mcp`

## What We Wanted To Prove

We wanted to prove more than "the config builds."

We wanted to prove the full path:

1. one maintained Pluxx source project
2. compiled Codex output
3. local install into Codex
4. native-looking plugin surface in the Codex UI
5. live usage against a real Docsalot MCP
6. useful output from the plugin, not just raw tool noise

## The Source Project

The `docs-ops` example is intentionally richer than a thin MCP wrapper.

It includes:

- `pluxx.config.ts`
- `INSTRUCTIONS.md`
- commands
- skills
- supporting references
- scripts
- assets
- one Docsalot MCP connection

High-level shape:

```text
example/docs-ops/
├── INSTRUCTIONS.md
├── pluxx.config.ts
├── commands/
├── skills/
├── scripts/
├── assets/
└── dist/
    ├── claude-code/
    ├── cursor/
    ├── codex/
    └── opencode/
```

The MCP is configured once in:

- `example/docs-ops/pluxx.config.ts`

With the Orchid public endpoint:

```ts
mcp: {
  docsalot: {
    transport: 'http',
    url: 'https://orchid-docs.docsalot.dev/api/mcp',
    auth: {
      type: 'none',
    },
  },
}
```

## The Commands We Used

All commands below were run from:

- `example/docs-ops`

### 1. Check The Source Project

```bash
node ../../bin/pluxx.js doctor
```

What this told us:

- the config loaded
- the project paths were valid
- the Orchid MCP URL was configured correctly
- the plugin still defines a hook, so trust is required on install

### 2. Lint The Cross-Host Surface

```bash
node ../../bin/pluxx.js lint
```

What this told us:

- there were `0` errors
- richer Claude skill frontmatter degrades in Cursor in expected ways
- Codex hook behavior is translated into external hook guidance rather than a perfect 1:1 host-native hook surface

This is important because Pluxx should be truthful, not magical.

### 3. Build The Native Bundles

```bash
node ../../bin/pluxx.js build
```

What this produced:

- `dist/claude-code/`
- `dist/cursor/`
- `dist/codex/`
- `dist/opencode/`

This is the core one-to-many move:

```text
one source project
    ->
pluxx build
    ->
four native outputs
```

### 4. Install The Codex Bundle

Once the build was good, we used the installed Pluxx CLI:

```bash
pluxx install --target codex --trust
```

Why `--trust` mattered:

- the plugin includes a local hook command
- Pluxx correctly refused a non-interactive hook install without explicit trust

That is good behavior.

### 5. Verify The Installed Bundle

```bash
pluxx verify-install --target codex
```

Verified result:

- install path existed
- built bundle matched the installed bundle
- Codex-visible install state passed

Installed location:

- `~/.codex/plugins/docs-ops`

Marketplace registration:

- `~/.agents/plugins/marketplace.json`

## What Codex Looked Like After Install

After install, the plugin appeared in Codex's Local Plugins UI as:

- `Docs Ops`

And it looked native, not hacked together.

The rendered Codex plugin view showed:

- the plugin name and description
- screenshots
- default prompts
- the included Docsalot MCP server
- the generated skills

That matters more than it sounds.

The win is not just that files were generated.

The win is that one maintained source project compiled into something Codex could present like a real plugin.

## The Exact Prompts We Used In Codex

After adding the plugin to Codex, we used the installed plugin directly in chat.

### Inspect prompt

```text
Use [@docs-ops](plugin://docs-ops@local-plugins) to inspect the Orchid Docsalot surface and summarize the page at components/accordion in 3 bullets.
```

Result:

- the plugin's Docsalot tools pulled the live page
- Codex returned a clean 3-bullet summary
- the output reflected the real Orchid docs content, not cached repo notes

### Rewrite prompt

```text
Use [@docs-ops](plugin://docs-ops@local-plugins) to rewrite the Orchid page at components/accordion so it has better examples and best practices, but keep it read-only. Return the result as: 1. biggest problems with the current page 2. improved page copy 3. why the rewrite is better.
```

Result:

- the plugin pulled `components/accordion`
- it also used `components/accordion-group` for adjacent context
- it returned:
  - the page weaknesses
  - a stronger read-only rewrite
  - a short explanation of why the rewrite was better

## What The Output Proved

The important proof was not "the MCP works."

We already knew the Orchid Docsalot MCP endpoint was live and public.

The new proof was this:

- Pluxx built the Codex plugin bundle
- Pluxx installed it locally
- Codex rendered it as a native plugin
- the plugin could call the live Docsalot MCP
- the workflow produced useful operator output

That is the wedge.

## Why This Matters

This is what Pluxx is really selling:

- not just tool wrapping
- not just `tools/list`
- not just another MCP wrapper

It is selling the ability to maintain one source project that becomes a shaped, installable, native agent experience in multiple hosts.

In this case, the single source project produced:

- a Docsalot MCP integration
- a docs operator workflow
- a native-looking Codex plugin experience

without hand-maintaining a separate Codex plugin by itself.

## What Was Easy

The clean parts of the flow were:

- wiring the live Orchid MCP URL into the source project
- validating the source project
- building core-four outputs
- installing the Codex target
- verifying the Codex install
- using the plugin in the Codex UI once it was added

The plugin also looked right in the product.

That matters, because if the output only works technically but feels foreign in the host, the value is much lower.

## What Was Truthful, Not Magic

The walkthrough also showed where Pluxx is intentionally honest.

- Cursor does not support all Claude skill frontmatter, so Pluxx warns instead of pretending.
- Codex hook behavior is not identical to Claude's plugin-bundled hook model, so Pluxx emits the best available translation and tells you what happened.
- Docsalot's public MCP is read-only, so write/publish proof still needs a separate authenticated path.

That preserve/translate/degrade honesty is part of the product.

## The Remaining Gap

The next proof is not another read-only summary.

The next proof is:

- a true authenticated write or publish flow for Docsalot authoring

Until then, the current flagship proof is:

- public read-side MCP access
- installed Codex plugin usage
- a real inspect flow
- a real rewrite flow
- one maintained source project the whole time

## Bottom Line

Pluxx took a single `docs-ops` source project and turned it into a Codex plugin that:

- looked native
- used a live Orchid Docsalot MCP
- inspected real pages
- produced a better read-only rewrite

That is the story:

one source project in, native plugin out, real workflow intact.
