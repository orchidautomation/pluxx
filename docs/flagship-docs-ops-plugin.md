# Flagship Docs-Ops Plugin

Last updated: 2026-04-23

## Doc Links

- Role: concrete spec for the flagship depth example
- Related:
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)
  - [docs/roadmap.md](./roadmap.md)
  - [docs/docs-ops-core-four-proof.md](./docs-ops-core-four-proof.md)
  - [docs/strategy/docs-url-ingestion.md](./strategy/docs-url-ingestion.md)
  - [Linear](https://linear.app/orchid-automation)
- Update together:
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)
  - [docs/roadmap.md](./roadmap.md)

This doc turns the generic "maximal reference plugin" priority into one concrete build target.

## Current Status

The scaffold now exists in:

- `example/docs-ops`

And the read-only public Orchid validation lives in:

- `example/docs-ops/ORCHID-READONLY-DEMO.md`

And the core-four build/install/verify proof lives in:

- `docs/docs-ops-core-four-proof.md`

That means the flagship example is no longer only theoretical:

- the source project exists
- the core-four build passes
- the flagship example now installs and passes `verify-install` across Claude Code, Cursor, Codex, and OpenCode
- the Orchid Docsalot MCP endpoint initializes publicly with no API key
- the public MCP surface is proven for read-side workflows
- a real Orchid Accordion before/after rewrite artifact exists in `example/docs-ops/demo-rewrites/`
- the generated plugin has been installed and used in Codex against the live Orchid surface

The next gaps are user-facing cross-host proof and write-side proof:

- repeat obvious inspect / pull / rewrite proof in Claude Code, Cursor, and OpenCode
- document preserve / translate / degrade behavior clearly in this example
- a separate authenticated publish path, if Orchid wants true write/publish demos

## Chosen Example

Build a Docsalot-style docs workflow plugin from one maintained Pluxx source project.

Working name:

- `docs-ops`

Reference shape:

- a real docs-management MCP such as Docsalot
- compiled into native plugin outputs for Claude Code, Cursor, Codex, and OpenCode

## Why This Example

This is the best flagship depth example because it is:

- a real product workflow, not a toy MCP
- broad enough to matter beyond one niche
- naturally rich in multi-step agent behavior
- a strong fit for advanced skill/plugin surfaces
- aligned with Pluxx's docs-ingestion story

It gives Pluxx one example that can prove:

- workflow grouping
- richer instructions
- supporting files
- scripts
- argument handling
- subagent delegation where supported
- hooks / validation behavior where supported
- truthful cross-host translation

## Product Shape

The plugin should feel like a docs operator pack, not just a thin MCP wrapper.

Core story:

- inspect a docs surface
- pull the right page
- rewrite it with better context
- review changes
- validate before publish
- publish safely
- recover if needed

## Skill Map

Initial skill/command set:

- `/inspect-docs-surface`
  - map the docs surface, find relevant pages, summarize what exists
- `/pull-doc-page [page-or-url]`
  - fetch one page or a small focused set of pages
- `/rewrite-doc-page [page-or-url]`
  - rewrite with product, setup, and workflow context
- `/review-doc-changes [page-or-url]`
  - run a stricter reviewer pass before publish
- `/publish-docs [scope]`
  - publish changed docs with preflight checks
- `/rollback-doc-change [page-or-release]`
  - recover from a bad docs change or publish

Optional stretch skills:

- `/plan-doc-update [topic]`
- `/audit-doc-gaps [topic]`
- `/prepare-release-notes [release]`

## Advanced Surfaces To Exercise

The goal is not just more skills. The goal is richer native depth.

### Supporting Files

Bundle real support material with the plugin:

- `voice-and-tone.md`
- `publishing-checklist.md`
- `style-guide.md`
- `examples/`
  - before/after rewrites
  - good publish summaries
  - strong setup docs
- `references/`
  - docs API notes
  - auth notes
  - URL conventions

These should be referenced from the main skill files so the host only loads them when needed.

### Scripts

Bundle scripts that Claude or another host agent can run:

- `scripts/validate-links.sh`
- `scripts/check-frontmatter.sh`
- `scripts/summarize-diff.sh`
- `scripts/find-changed-pages.sh`

The point is to prove that Pluxx can preserve "run this helper script as part of the workflow" where the host allows it.

### Arguments

Use argument-aware skills, not only generic prompts:

- `/pull-doc-page getting-started`
- `/rewrite-doc-page api/authentication`
- `/publish-docs changed-pages`

That makes the example more like a real operator toolbelt and less like free-form chat glue.

### Allowed Tools

Pre-approve the minimum useful tool surface where the host supports it:

- read/search
- diff/status
- docs publish commands
- validation scripts

This is important because a real plugin should reduce interaction friction for repetitive docs workflows.

### Subagent / Forked Context

Where the host supports it, use isolated research/review steps:

- research page context in a forked context
- review a rewrite separately from the main drafting flow
- summarize findings back into the main session

This is a strong proof of richer host-native behavior.

### Hooks

Where the host supports it, add deterministic checks around risky actions:

- pre-publish validation hook
- post-publish status check
- optional block on failed validation

This is one of the clearest examples of "native depth, not just prompt text."

### Dynamic Context Injection

Where the host supports it, inject fresh runtime context such as:

- changed docs files
- current git status
- docs index
- current release/version info

That proves Pluxx can carry richer operator workflows than static `SKILL.md` content alone.

## Truthful Core-Four Mapping

This example should be built richest-first and then translated truthfully.

### Claude Code

This is the deepest target surface for the example.

Planned surfaces:

- supporting files
- scripts
- arguments
- `allowed-tools`
- `context: fork`
- hooks
- dynamic shell-preprocessed context where appropriate

### Codex

Goal:

- preserve the operator workflow shape and supporting references
- map subagent/reviewer patterns into Codex-native agent surfaces where possible
- keep the flow practical even if exact Claude semantics do not carry over 1:1

### Cursor

Goal:

- keep the same workflow taxonomy and packaging intent
- preserve useful command/skill surfaces where supported
- translate richer depth honestly when a Claude-native feature has no direct equivalent

### OpenCode

Goal:

- preserve the same maintained source project
- carry over the docs-ops operator pack in the best native shape OpenCode supports
- use this example to document exactly where behavior is preserved, translated, or degraded

### Observed Today

The example is now strong enough to document the first honest current mapping:

- instructions: preserve in Claude Code, Cursor, and Codex; translate in OpenCode
- commands: preserve in Claude Code, Cursor, and OpenCode; degrade in Codex
- hooks: preserve in Claude Code and Cursor; translate in Codex and OpenCode
- distribution: preserve in Cursor and Codex; translate in Claude Code and OpenCode

See [docs/docs-ops-core-four-proof.md](./docs-ops-core-four-proof.md) for the current proof artifact and the concrete host paths used in the rerun.

## Source Project Shape

The source project should be organized like a real flagship example, not a minimal scaffold.

```text
docs-ops/
├── INSTRUCTIONS.md
├── assets/
│   ├── icon/
│   └── screenshots/
├── commands/
│   ├── inspect-docs-surface.md
│   ├── pull-doc-page.md
│   ├── rewrite-doc-page.md
│   ├── review-doc-changes.md
│   ├── publish-docs.md
│   └── rollback-doc-change.md
├── skills/
│   ├── docs-inspect-surface/
│   │   ├── SKILL.md
│   │   ├── references/
│   │   └── scripts/
│   ├── docs-rewrite-page/
│   ├── docs-review-changes/
│   └── docs-publish/
└── pluxx.config.ts
```

## Acceptance Criteria

This example is successful when it proves all of the following:

- one maintained source project can express a rich docs workflow
- the compiled outputs feel native in each of the core four
- the repo can demonstrate what was preserved vs translated vs degraded
- the example is strong enough to use in:
  - docs
  - demos
  - regression fixtures
  - outbound conversations

## Build Sequence

### Phase 1

Import or hand-shape the Docsalot-style MCP into a first `docs-ops` source project.

### Phase 2

Refine the taxonomy into a real docs operator pack.

### Phase 3

Add the advanced surfaces:

- supporting files
- scripts
- argument-aware skills
- preflight validation behavior
- reviewer/research subagent patterns

### Phase 4

Compile, install, and test across:

- Claude Code
- Cursor
- Codex
- OpenCode

### Phase 5

Use the result as:

- the flagship demo
- a docs anchor
- a regression fixture
- the canonical proof of richer host-native depth

## Non-Goals

This flagship example is not trying to prove:

- marketplace economics
- enterprise governance
- every possible host
- deep commerce or registry flows

It is trying to prove one thing well:

Pluxx can take one serious plugin source project and ship a rich, truthful, native cross-host experience.
