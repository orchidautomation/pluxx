# Pluxx Status

Last updated: 2026-04-14

## Where We Are

Pluxx is now a real `Core + Agent` product:

- `Core` works: import, scaffold, doctor, lint, build, install, sync, test
- `Agent` works: prepare prompt/context packs, run Codex/Claude/OpenCode/Cursor headlessly, or refine manually inside the scaffold
- the one-shot path exists: `pluxx autopilot`
- the controllable path exists: `pluxx init` -> agent refinement -> `lint/test/build/install`

Real dogfood is proven:

- PlayKit works as a strong header-auth MCP example
- Sumble works as an OAuth-first Claude Code example
- Claude Code install flow is real and native
- Cursor headless runner support is shipped

## Recently Shipped

These are effectively done and no longer the main unknowns:

- [PLUXX-83](https://linear.app/orchid-automation/issue/PLUXX-83/create-pluxx-plugin-and-skills-for-claude-code-and-codex-agent-driven)
  - Pluxx plugin + skill pack for host agents
- [PLUXX-84](https://linear.app/orchid-automation/issue/PLUXX-84/add-a-codex-agent-mode-runner-adapter-once-the-official-headless)
  - Codex runner adapter
- [PLUXX-86](https://linear.app/orchid-automation/issue/PLUXX-86)
  - one-shot autopilot flow
- [PLUXX-87](https://linear.app/orchid-automation/issue/PLUXX-87)
  - project-level agent overrides via `pluxx.agent.md`
- [PLUXX-90](https://linear.app/orchid-automation/issue/PLUXX-90/clarify-publish-and-local-to-production-mcp-lifecycle-in-pluxx-docs)
  - publish story, local-to-prod lifecycle docs
- [PLUXX-91](https://linear.app/orchid-automation/issue/PLUXX-91/improve-agent-prompt-packs-so-codex-and-claude-produce-product-shaped)
  - stronger prompt packs
- [PLUXX-92](https://linear.app/orchid-automation/issue/PLUXX-92/harden-auth-required-mcp-onboarding-and-autopilot-runner-ux)
  - better auth-required onboarding and quieter runner UX
- [PLUXX-93](https://linear.app/orchid-automation/issue/PLUXX-93/expand-real-mcp-dogfood-coverage-across-messy-metadata-local-stdio-and)
  - broader dogfood + metadata quality gates
- [PLUXX-94](https://linear.app/orchid-automation/issue/PLUXX-94/add-a-cursor-agent-mode-runner-adapter-and-align-cursor-pluginsubagent)
  - Cursor headless runner + Cursor contract alignment

Recent non-ticketed but important shipped behavior:

- OAuth-first runtime auth split landed on `main`
  - import/sync auth can differ from runtime auth
  - Claude/Cursor can now use platform-managed auth at runtime
  - this is what made Sumble work correctly in Claude Code

## Main Open Work

### 1. Keep the Core + Agent story coherent

- [PLUXX-79](https://linear.app/orchid-automation/issue/PLUXX-79/define-agent-mode-as-the-semantic-authoring-layer-on-top-of-core)
  - umbrella issue
  - still open mostly as the coordination parent for the whole direction

### 2. Go deeper on MCP protocol/auth/discovery

- [PLUXX-62](https://linear.app/orchid-automation/issue/PLUXX-62/competitive-readiness-deepen-mcp-auth-and-discovery-support)
  - richer auth discovery
  - registry/discovery support
  - better remote/local import paths
- [PLUXX-67](https://linear.app/orchid-automation/issue/PLUXX-67/scaffold-skills-and-instructions-from-mcp-resources-and-resource)
  - scaffold from MCP resources/resource templates too, not just tools
- [PLUXX-42](https://linear.app/orchid-automation/issue/PLUXX-42/capture-mcp-resources-in-introspection-and-emit-context-in)
  - introspect MCP resources and emit them into generated context/instructions

### 3. Make commands a first-class surface

- [PLUXX-95](https://linear.app/orchid-automation/issue/PLUXX-95/add-first-class-command-generation-with-argument-hints-for-claude-code)
  - generate slash-command style entrypoints on top of the same taxonomy as skills
  - support Claude `argument-hint`
  - find the correct Cursor equivalent

### 4. Solve the portable subagent/delegation model

- [PLUXX-89](https://linear.app/orchid-automation/issue/PLUXX-89/define-a-portable-agent-and-subagent-delegation-model-for-primary)
  - this is the real unfinished Agent portability problem
  - current support is decent copy-through + runner support, not a full delegation abstraction

### 5. Tighten quality / release confidence

- [PLUXX-66](https://linear.app/orchid-automation/issue/PLUXX-66/competitive-readiness-formalize-quality-and-compatibility-guarantees)
  - compatibility matrix
  - stronger release verification
  - regression prevention around platform claims
- [PLUXX-59](https://linear.app/orchid-automation/issue/PLUXX-59/validate-pluxxmcpjson-schema-with-zod-before-trusting-metadata)
  - harden `.pluxx/mcp.json` trust boundary
- [PLUXX-52](https://linear.app/orchid-automation/issue/PLUXX-52/add-example-github-actions-workflow-for-cicd)
  - ship the CI story
- [PLUXX-55](https://linear.app/orchid-automation/issue/PLUXX-55/make-error-messages-actionable-with-fix-suggestions)
  - continue making CLI failures fixable without reading code

## Lower-Priority Backlog

- [PLUXX-48](https://linear.app/orchid-automation/issue/PLUXX-48/auto-detect-target-platforms-from-existing-agent-config-directories)
  - auto-detect local agent targets
- [PLUXX-53](https://linear.app/orchid-automation/issue/PLUXX-53/add-windsurf-and-devin-target-platform-generators)
  - more target generators
- [PLUXX-75](https://linear.app/orchid-automation/issue/PLUXX-75/evaluate-windsurf-and-devin-as-future-pluxx-targets)
  - target evaluation before expansion

## Validation Rules Research Backlog

Still open and delegated research work:

- [PLUXX-10](https://linear.app/orchid-automation/issue/PLUXX-10/research-and-codify-claude-code-plugin-validation-rules)
- [PLUXX-11](https://linear.app/orchid-automation/issue/PLUXX-11/research-and-codify-cursor-plugin-validation-rules)
- [PLUXX-12](https://linear.app/orchid-automation/issue/PLUXX-12/research-and-codify-codex-plugin-validation-rules)
- [PLUXX-15](https://linear.app/orchid-automation/issue/PLUXX-15/research-and-codify-openhands-warp-gemini-cli-roo-code-cline-amp)
- [PLUXX-18](https://linear.app/orchid-automation/issue/PLUXX-18/research-and-codify-gemini-cli-extension-validation-rules)

## Recommended Next Three

If picking the next highest-leverage sequence:

1. [PLUXX-95](https://linear.app/orchid-automation/issue/PLUXX-95/add-first-class-command-generation-with-argument-hints-for-claude-code)
   - improves host UX immediately
2. [PLUXX-67](https://linear.app/orchid-automation/issue/PLUXX-67/scaffold-skills-and-instructions-from-mcp-resources-and-resource)
   - makes imports smarter from real MCPs
3. [PLUXX-89](https://linear.app/orchid-automation/issue/PLUXX-89/define-a-portable-agent-and-subagent-delegation-model-for-primary)
   - clarifies the long-term Agent model

## Practical Read

Pluxx is past the “does this concept work?” stage.

The remaining work is mostly:

- better command UX
- deeper MCP protocol support
- stronger portability semantics for agents/subagents
- better release confidence and docs polish

The core authoring loop is already real.
