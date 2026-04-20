# Pluxx Plugin Distribution Strategy

This is the working strategy note for the Pluxx plugin itself.

The core question is:

Should the Pluxx plugin bundle the CLI, or should the plugin stay thin and use the CLI as the execution engine?

## Recommendation

Keep the CLI as the engine.

Keep the Pluxx plugin thin and native to each host.

That means:

- `@orchid-labs/pluxx` remains the system of record
- the host plugins provide discoverability, prompts, commands, skills, and specialist guidance
- the host plugin routes into the local CLI instead of re-implementing Pluxx or embedding a second runtime contract

## Why this is the better design

### 1. One execution truth

The deterministic authoring engine should live in one place.

If the plugin bundles the CLI separately for each host, we create:

- duplicate release surfaces
- duplicate runtime contracts
- more drift risk
- harder debugging

### 2. Smaller, clearer host bundles

Official plugin surfaces reward clarity:

- clear manifest metadata
- a specific value proposition
- obvious entrypoints
- versioned, installable plugin bundles

They do not obviously reward shipping a large embedded toolchain inside the plugin itself.

### 3. Better parity across the core four

If the CLI is the engine, every host can ride the same deterministic workflow:

- import
- doctor
- lint
- eval
- build
- test
- install
- sync

The host plugin becomes the native wrapper for invoking that workflow well.

### 4. Easier review and marketplace posture

A thin plugin is easier to reason about for:

- security review
- metadata quality
- screenshots and positioning
- installability
- official listing conversations

## What the Pluxx plugin should actually do

The plugin should provide the best in-host entrypoint for the same core workflows:

- import an MCP
- refine taxonomy
- rewrite instructions
- review a scaffold
- sync an MCP-derived scaffold

It should also help users discover the broader deterministic commands:

- `doctor`
- `lint`
- `eval`
- `build`
- `test`
- `install`

The plugin is not the compiler. It is the operator surface for the compiler.

## Current in-repo state

Today the repo already points in the right direction:

- `example/pluxx`
  - canonical Pluxx source project for the self-hosted plugin
- `plugins/pluxx`
  - repo-local Codex plugin surface for dogfooding

That means we already have the seed of the right product architecture.

The next step is not inventing a new architecture.

The next step is polishing and standardizing the one we already have.

## What “build the Pluxx plugin across all target outputs” should mean

It should mean:

1. maintain `example/pluxx` as the canonical source project
2. compile it cleanly to:
   - Claude Code
   - Cursor
   - Codex
   - OpenCode
3. make those outputs polished enough to stand on their own as a real install surface
4. keep the workflow honest about the CLI being the engine underneath

It should **not** mean:

- hide the CLI entirely
- fork the runtime into four host-specific plugin implementations
- pretend the plugin itself is the full execution engine

## How the plugin should invoke the engine

The clean operator model is:

- if local `pluxx` exists, use it
- otherwise use `npx @orchid-labs/pluxx`
- if Bun is required, surface that clearly

The plugin should be explicit about the runtime requirement rather than trying to smuggle a hidden execution environment into every host bundle.

## Official surface implications

### Claude Code

Claude’s official docs currently support:

- local testing with `--plugin-dir`
- custom plugin marketplaces
- official marketplace submission

Sources:

- [Create plugins](https://code.claude.com/docs/en/plugins)
- [Create and distribute a plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces)

That means the Pluxx plugin should aim to be:

- clearly versioned
- narrowly described
- easy to install from a marketplace
- polished enough for official submission

### Codex

Codex’s public plugin docs stress:

- a strong `.codex-plugin/plugin.json`
- optional skills, MCP config, apps, and assets
- richer metadata for published plugins

Sources:

- [Build plugins](https://developers.openai.com/codex/plugins/build)

The public Codex use-case pages also reward focused, legible workflows with a clear starter prompt.

Source:

- [Build for macOS](https://developers.openai.com/codex/use-cases/native-macos-apps)

That suggests Pluxx should eventually present itself there as a focused use case, not a vague meta-tool.

## The positioning that fits official surfaces

The best listing story is probably not:

- "generic cross-host plugin compiler"

It is more likely:

- "Turn an MCP into a maintainable multi-host plugin from inside your coding agent"

That is legible, specific, and demonstrable.

## What the plugin should include

Good candidates:

- polished skills
- explicit commands where the host supports them
- strong starter prompts
- example flows
- brand metadata
- screenshots or short demos
- clear docs links

Optional later:

- a tiny runtime check that verifies whether local `pluxx` or `npx @orchid-labs/pluxx` is available
- install guidance when the CLI is missing

## What the plugin should not try to be

- a hidden copy of the full CLI
- a replacement for `npx @orchid-labs/pluxx`
- a second compiler implementation
- a host-specific fork of the Pluxx authoring model

## Repo strategy

Short term:

- keep the canonical source project in the main Pluxx repo
- keep dogfooding from the main repo
- improve metadata, screenshots, starter prompts, and install guidance there

Later, if distribution needs diverge:

- split a dedicated plugin/marketplace repo for cleaner discovery and release management

That split should happen for distribution reasons, not because the architecture requires it.

## Recommended next build sequence

1. treat `example/pluxx` as the canonical product plugin source
2. harden its metadata and screenshots for all core-four targets
3. add CLI detection and friendly install guidance in the plugin docs
4. keep the plugin thin
5. test the full self-hosting flow across the core four in CI
6. decide whether to publish from the main repo or a dedicated plugin marketplace repo

## Current conclusion

The Pluxx plugin should be:

- native
- thin
- polished
- workflow-specific

The CLI should remain:

- shared
- deterministic
- versioned
- the system of record

That is the cleanest path to a plugin that is both useful in practice and credible on official listing surfaces.
