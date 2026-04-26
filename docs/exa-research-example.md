# Exa Research Example

Last updated: 2026-04-26

## Doc Links

- Role: clean-room Exa-style public example and proof note
- Related:
  - [README.md](../README.md)
  - [docs/proof-and-install.md](./proof-and-install.md)
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)
  - [docs/roadmap.md](./roadmap.md)
  - [docs/core-four-provider-docs-audit.md](./core-four-provider-docs-audit.md)
  - [docs/how-it-works.md](./how-it-works.md)
  - [example/exa-plugin/README.md](../example/exa-plugin/README.md)
  - [example/exa-plugin/pluxx.config.ts](../example/exa-plugin/pluxx.config.ts)
- Update together:
  - [README.md](../README.md)
  - [docs/proof-and-install.md](./proof-and-install.md)
  - [docs/start-here.md](./start-here.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)
  - [docs/roadmap.md](./roadmap.md)

Use this doc when you want the shortest honest explanation of the Exa example:

- what it is
- why it matters
- what is already proven
- what it forced Pluxx to improve

## What It Is

The source project is:

- [example/exa-plugin](../example/exa-plugin)

It is a clean-room Pluxx example that takes:

- Exa's public MCP
- Exa's public MCP docs
- the workflow shape of Exa's official Claude plugin

and turns that into one maintained source project that ships native outputs for:

- Claude Code
- Cursor
- Codex
- OpenCode

This is intentionally not an official Exa release and not a verbatim copy of Exa's marketplace plugin internals.

## Why It Matters

This example proves something different from `docs-ops`.

`docs-ops` proves a rich hosted-docs workflow.

The Exa example proves that Pluxx can take a Claude-first, subagent-heavy research product shape and carry that intent across the core four without flattening it into a generic search skill.

The important surfaces it exercises are:

- specialist agents and subagents
- explicit research commands
- one intentionally richer Claude-style orchestrator skill with `arguments`, `agent`, and `allowed-tools`
- shared auth and setup guidance
- native brand and listing metadata
- code-first OpenCode runtime output
- project-owned headless behavioral smoke prompts

## Source Shape

The example models these workflow entrypoints:

- `exa-deep-research`
- `exa-company-research`
- `exa-people-research`
- `exa-code-research`
- `exa-source-review`
- `exa-news-brief`

And these specialist agents:

- `people-scout`
- `company-scout`
- `code-scout`
- `news-scout`
- `source-auditor`
- `synthesis-reviewer`

It also intentionally exercises the richer shared brand layer through:

- icon
- screenshots
- color
- category
- default prompts
- website URL
- privacy policy URL
- terms of service URL

## Runtime Under Test

Hosted MCP:

- `https://mcp.exa.ai/mcp?client=pluxx-exa-example&tools=web_search_exa,web_fetch_exa,web_search_advanced_exa`

Optional auth:

- `EXA_API_KEY`

## Direct Install

If you want the fastest external share path, use the host-specific one-command installers below. These fetch the public Pluxx repo source, build the Exa example, and install the resulting native bundle into the selected host.

Important:

- this example includes a local `sessionStart` hook: `scripts/check-exa-setup.sh`
- the hook only reports whether `EXA_API_KEY` is set and prints setup guidance
- using these installers means explicitly trusting that local hook
- the equivalent source-path install command is `pluxx install --target <host> --trust`

### Claude Code

```bash
curl -fsSL https://raw.githubusercontent.com/orchidautomation/pluxx/main/example/exa-plugin/release/install-claude-code.sh | bash
```

### Cursor

```bash
curl -fsSL https://raw.githubusercontent.com/orchidautomation/pluxx/main/example/exa-plugin/release/install-cursor.sh | bash
```

### Codex

```bash
curl -fsSL https://raw.githubusercontent.com/orchidautomation/pluxx/main/example/exa-plugin/release/install-codex.sh | bash
```

### OpenCode

```bash
curl -fsSL https://raw.githubusercontent.com/orchidautomation/pluxx/main/example/exa-plugin/release/install-opencode.sh | bash
```

Optional for higher limits:

```bash
export EXA_API_KEY="your_exa_api_key"
```

Setup hook:

- `scripts/check-exa-setup.sh`

## What Was Automatic Vs Shaped

The current Exa example should not be read as “Pluxx could only do this because we already knew the answer.”

Pluxx already gets a meaningful amount for free today:

- `init --from-mcp` can scaffold the MCP wiring, auth shape, canonical paths, shared instructions, base skills, and safe hook structure from a raw Exa MCP
- `autopilot` can then push that first pass toward:
  - product-shaped skills
  - explicit commands
  - argument-bearing command UX
  - specialist agents and subagents when the workflow wants isolation or delegation
- `migrate` can import a strong host-native plugin into a canonical Pluxx source project instead of forcing a rewrite from scratch

What still took explicit product shaping in this Exa example was:

- deciding the final workflow taxonomy
- deciding which workflows deserved dedicated specialist agents
- tightening the orchestrator prompts so they delegate instead of collapsing into one flat search flow
- adding the richer shared brand layer:
  - icon
  - screenshots
  - default prompts
  - website / privacy / terms links
- polishing the host-specific install and proof surfaces

So the honest answer is:

- a raw `init --from-mcp` or `autopilot` run would have produced a credible Exa starting point
- `migrate` from a mature Claude-first plugin would likely have produced a stronger starting point than raw MCP alone
- neither path should yet be described as “this exact polished Exa example would fall out automatically without refinement”

The product gap now is narrower and clearer:

- keep making `autopilot` smarter about recovering product-shaped workflow architecture from raw MCPs
- keep making `migrate` better at preserving the intent of a mature Claude-first plugin shape so the first canonical Pluxx source project needs less manual tightening

## Public Command Sequence

If a normal user wanted to rerun the mechanical proof with the published CLI, the shape would be:

```bash
pluxx doctor
pluxx lint
pluxx build

pluxx install --target claude-code --trust
pluxx install --target cursor --trust
pluxx install --target codex --trust
pluxx install --target opencode --trust

pluxx verify-install --target claude-code
pluxx verify-install --target cursor
pluxx verify-install --target codex
pluxx verify-install --target opencode
```

For the behavioral smoke rerun that actually asks the installed hosts a real example query, use:

```bash
pluxx test --install --trust --behavioral --target claude-code cursor codex opencode
```

Current package note:

- the published npm package now includes the Claude plugin install schema fix and the Claude behavioral smoke coverage
- the public `pluxx test --install --trust --behavioral` path now matches the repo-local Exa proof state

```bash
pluxx test --install --trust --behavioral --target claude-code cursor codex opencode
```

The Exa example defines that query set in:

- [example/exa-plugin/.pluxx/behavioral-smoke.json](../example/exa-plugin/.pluxx/behavioral-smoke.json)

The first case intentionally targets the deep-research path and forbids Claude's earlier `context too long` fallback text.

## Maintainer Commands Actually Run In This Repo

This example was validated from the Pluxx monorepo with:

```bash
node ../../bin/pluxx.js doctor
node ../../bin/pluxx.js lint
node ../../bin/pluxx.js build

node ../../bin/pluxx.js install --target claude-code --trust
node ../../bin/pluxx.js install --target cursor --trust
node ../../bin/pluxx.js install --target codex --trust
node ../../bin/pluxx.js install --target opencode --trust

node ../../bin/pluxx.js verify-install --target claude-code
node ../../bin/pluxx.js verify-install --target cursor
node ../../bin/pluxx.js verify-install --target codex
node ../../bin/pluxx.js verify-install --target opencode
```

## Result

`doctor` passed.

`lint` passed with `0` errors and `16` honest cross-host translation warnings:

- Codex commands still degrade to routing guidance
- Codex hook behavior still lives outside the installed plugin bundle
- Codex permission modeling still routes through external config
- OpenCode MCP permission rules still simplify through tool-name matching
- the example now intentionally concentrates richer Claude-only skill fields in the top-level `exa-deep-research` orchestrator skill instead of spraying them across every workflow
- Cursor, Codex, and OpenCode then warn exactly where the current matrix says those richer Claude-only fields must weaken or translate

`build` succeeded for:

- Claude Code
- Cursor
- Codex
- OpenCode

All four `verify-install` checks passed after install.

The example also now has a project-owned headless behavioral smoke lane, so we can rerun a real installed-host query instead of relying only on screenshots and manual interactive checks.

## Host Result Matrix

| Host | Installed bundle path | Result | What landed visibly |
| --- | --- | --- | --- |
| Claude Code | `~/.claude/plugins/data/pluxx-local-exa-research-example/plugins/exa-research-example` | PASS | native skills, commands, hooks, MCP wiring, and translated Claude agent files |
| Cursor | `~/.cursor/plugins/local/exa-research-example` | PASS | native plugin bundle plus homepage/logo listing metadata |
| Codex | `~/.codex/plugins/exa-research-example` | PASS | native plugin bundle plus rich `interface` metadata, screenshots, prompts, legal links, and capabilities |
| OpenCode | `~/.config/opencode/plugins/exa-research-example` | PASS | native code-first plugin bundle plus permission-first agent/runtime output, explicit `@subagent` cues in generated skills, and native command-level `agent`/`subtask` bindings for specialist workflows |

## Official CLI Workflow Attempt

After the final branded build and install rerun, the same small Exa workflow was attempted through the official host CLIs.

Prompt under test:

```text
Use Exa Research Example to map Exa.ai and one nearby competitor. Return:
1. 3 key findings
2. 3 high-signal source URLs.
```

Because `EXA_API_KEY` is currently sourced from the interactive shell on this machine, the commands were run through `zsh -ic ...`.

### Commands actually run

```bash
zsh -ic 'claude -p --permission-mode bypassPermissions --output-format text "Use Exa Research Example to map Exa.ai and one nearby competitor. Return: 1. 3 key findings 2. 3 high-signal source URLs."'

zsh -ic 'cursor agent --print --trust --approve-mcps --force --workspace "/Users/brandonguerrero/Documents/Orchid Automation/Orchid Labs/pluxx/example/exa-plugin" "Use Exa Research Example to map Exa.ai and one nearby competitor. Return: 1. 3 key findings 2. 3 high-signal source URLs."'

zsh -ic 'codex exec -C "/Users/brandonguerrero/Documents/Orchid Automation/Orchid Labs/pluxx" --dangerously-bypass-approvals-and-sandbox "Use Exa Research Example to map Exa.ai and one nearby competitor. Return: 1. 3 key findings 2. 3 high-signal source URLs."'

zsh -ic 'opencode run --dir "/Users/brandonguerrero/Documents/Orchid Automation/Orchid Labs/pluxx/example/exa-plugin" --dangerously-skip-permissions "Use Exa Research Example to map Exa.ai and one nearby competitor. Return: 1. 3 key findings 2. 3 high-signal source URLs."'
```

### Headless workflow result matrix

| Host | Result | Notes |
| --- | --- | --- |
| Claude Code CLI | FAIL | local Claude runtime returned `API Error: Unable to connect to API (ConnectionRefused)` before a plugin-level result was returned |
| Cursor CLI | PASS | returned a clean Exa-vs-Tavily comparison with three findings and three sources |
| Codex CLI | FAIL | local Codex runtime is blocked by ambient environment issues rather than the Exa plugin bundle itself: current CLI/model mismatch plus an unrelated invalid local skill under `~/.agents/skills/one` |
| OpenCode CLI | PASS | returned a substantive Exa-vs-Tavily comparison and clearly exercised Exa MCP tools; local environment still emits unrelated `megamind/scripts/confirm-mutation.sh` noise before the result |

This does **not** count as full official CLI proof across the core four yet.

It does prove two useful things already:

## OpenCode Specific Note

OpenCode was the host that most clearly punished a “prompt-wrapper only” command translation.

The current truthful OpenCode shape is now:

- skills keep explicit `@subagent` cues like `@company-scout`
- specialist slash commands also bind native OpenCode command metadata:
  - `agent`
  - `subtask`

That matters because the skill text alone is only advisory. The OpenCode command docs explicitly support agent-bound commands, and subagent invocation becomes much more deterministic once the command itself declares the specialist agent to launch.

For the Exa example, that now means:

- `company-research` binds `company-scout`
- `people-research` binds `people-scout`
- `code-research` binds `code-scout`
- `news-brief` binds `news-scout`
- `source-review` binds `source-auditor`

`deep-research` remains the intentionally richer orchestration workflow rather than a single-specialist command.

One UI inconsistency is worth calling out explicitly:

- Cursor makes plugin ownership fairly obvious through the plugin surface and namespaced skill labels.
- OpenCode makes ownership obvious in the plugin detail page, MCP panel, and subagent list.
- OpenCode's slash-command palette is the weaker surface: commands stay short (`/company-research`, `/people-research`, etc.) and rely on the description column for `Exa:` branding instead of repeating the full plugin name.

That is intentional for now. We keep the OpenCode commands short and native-feeling, then document the palette ambiguity rather than forcing a heavier command prefix that the other hosts do not need.

- the generated Exa plugin is strong enough to execute real headless workflows in Cursor and OpenCode
- the remaining Claude and Codex blockers are currently host-runtime issues on this machine, not the generated Exa plugin shape

## Interactive Host Proof Update

The headless CLI matrix above is still historically accurate, but the live host proof is now stronger than that older block suggests.

Additional observed results on this machine:

| Host | Result | Notes |
| --- | --- | --- |
| Claude Code app | PASS | live plugin workflow now calls `exa - web_search_exa (MCP)` from delegated Exa specialists such as `people-scout` |
| Codex Desktop app | PASS | live plugin workflows now complete end-to-end in chat and explicitly report `used Exa` |

That means the Exa example is now proven through four real host surfaces overall:

- Claude Code app
- Cursor CLI
- Codex Desktop app
- OpenCode CLI

The remaining rerun blockers are narrower than before:

- a fresh Cursor CLI rerun on this machine currently hits a local macOS keychain/auth error (`SecItemCopyMatching failed -50`)
- the older Claude CLI and Codex CLI failures are still ambient host-runtime issues, not plugin-bundle shape issues

## What This Forced Pluxx To Improve

This example exposed a real compiler gap.

The original Claude generator was too raw about agents. It copied canonical Pluxx agent markdown into the Claude bundle instead of translating it into Claude-native agent frontmatter and manifest output.

That is now fixed.

What changed in Pluxx itself:

- canonical agent fields are translated into Claude-native fields instead of being copied blindly
- permission intent now maps into Claude `disallowedTools`
- step/turn intent now maps into Claude-native turn fields
- Claude manifest output now uses explicit file entries for generated agents instead of an invalid directory shorthand

This is exactly the kind of example pressure we want:

- a public example uncovered a real native gap
- the compiler got better
- the example now serves as a regression surface

## Native Translation Value

This example is a good showcase because it is not trying to prove “identical parity.”

It is proving the actual Pluxx contract:

- preserve where the host can express the same thing natively
- translate when the host has a different but honest native surface
- degrade only when there is no equally rich equivalent

Concrete examples here:

- Claude keeps the richest skill frontmatter and native agent surfaces
- Cursor keeps the workflow/operator shape but weakens some Claude-only skill semantics
- Codex keeps the rich interface metadata and plugin packaging, but still degrades commands and externalizes hook behavior
- OpenCode keeps the agent-heavy architecture through its own native agent model and now prefers permission-first output instead of deprecated agent `tools`

Concrete bundle inspection after the final branded build:

- Codex now emits the full rich `interface` block:
  - `displayName`
  - `shortDescription`
  - `longDescription`
  - `category`
  - `brandColor`
  - icon/logo
  - `defaultPrompt`
  - `websiteURL`
  - `privacyPolicyURL`
  - `termsOfServiceURL`
  - `screenshots`
- Cursor emits the narrow truthful subset:
  - `homepage`
  - `logo`
- Claude agent files now emit native agent frontmatter instead of raw canonical frontmatter:
  - `maxTurns`
  - `disallowedTools`
  - translated delegation notes
- OpenCode now emits permission-first agent definitions in the generated runtime plugin instead of leaning on deprecated legacy `tools`

## What Is Still Not Proven

This example is already a strong mechanical proof surface, but it does not yet prove everything:

- it does not yet have the same full official CLI live workflow proof stack that `docs-ops` has
- it does not yet have a polished in-app walkthrough in one host
- it does not prove any special private Exa surface beyond the public MCP plus optional API-key auth

That is fine for now.

The main value of this example is:

- clean-room portability
- subagent-rich workflow shaping
- richer brand/listing surface
- cross-host native translation pressure

## Why This Is A Good Public Example

The Exa example is the clearest public answer to:

> “Can Pluxx take a strong Claude-first plugin shape and turn it into native bundles for Claude Code, Cursor, Codex, and OpenCode from one maintained source project?”

The answer is now:

- yes mechanically
- yes with real brand/listing assets
- yes with real specialist-agent architecture
- and yes in a way that already improved the compiler itself
