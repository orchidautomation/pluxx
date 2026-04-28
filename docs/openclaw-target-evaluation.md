# OpenClaw Target Evaluation

Last updated: 2026-04-28

## Doc Links

- Role: evaluate OpenClaw as a candidate fifth Pluxx target
- Related:
  - [docs/core-four-primitive-matrix.md](./core-four-primitive-matrix.md)
  - [docs/core-four-primitive-implementation-plan.md](./core-four-primitive-implementation-plan.md)
  - [docs/core-four-provider-docs-audit.md](./core-four-provider-docs-audit.md)
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/roadmap.md](./roadmap.md)
- Update together:
  - [docs/todo/queue.md](./todo/queue.md)
  - [docs/todo/master-backlog.md](./todo/master-backlog.md)
  - [docs/roadmap.md](./roadmap.md)

This note evaluates whether OpenClaw should become a Pluxx target, a beta target, or stay out of scope for now.

## Recommendation

Recommendation: `track as beta target`.

Do not promote OpenClaw to the prime-time target set yet.

Why:

- OpenClaw has a real native plugin system, a real skills system, real slash commands, real hooks, real MCP surfaces, and real install/update flows.
- OpenClaw is not just an OpenCode downstream skin. It has its own gateway-first runtime, its own native plugin manifest, its own config model, and its own security/sandbox model.
- OpenClaw also imports Codex, Claude, and Cursor bundles selectively. That makes it a useful downstream compatibility surface, but not a substitute for a native OpenClaw compiler target.
- The missing gap is not “does OpenClaw expose enough primitives?” The gap is “does Pluxx have a proven native OpenClaw generator, validator, doctor story, and behavioral smoke path?”
- Promoting it now would expand the product story from “one source to the core four coding hosts” into “core four plus a gateway-native assistant platform” before Pluxx has proof that the install/runtime contract is stable and repeatable.

As of 2026-04-28, OpenClaw looks credible enough to keep in scope, but not yet credible enough to market as the fifth first-class target.

## Source Notes

Official docs and product sources used:

- OpenClaw docs home: https://docs.openclaw.ai/
- Skills: https://docs.openclaw.ai/tools/skills
- Plugins: https://docs.openclaw.ai/tools/plugin
- Plugin bundles: https://docs.openclaw.ai/plugins/bundles
- Plugin manifest: https://docs.openclaw.ai/plugins/manifest
- Plugin hooks: https://docs.openclaw.ai/plugins/hooks
- Slash commands: https://docs.openclaw.ai/tools/slash-commands
- Configuration: https://docs.openclaw.ai/gateway/configuration
- Security: https://docs.openclaw.ai/gateway/security
- MCP CLI/reference: https://docs.openclaw.ai/cli/mcp
- npm package: https://www.npmjs.com/package/openclaw
- upstream repo: https://github.com/openclaw/openclaw

Additional corroboration:

- external plugin artifact example: https://www.npmjs.com/package/@tencent-weixin/openclaw-weixin

## Questions Answered

### Installable package boundary

For native OpenClaw plugins, the package boundary is an npm package with:

- `package.json` `openclaw.extensions`
- `openclaw.runtimeExtensions` when runtime files differ from source files
- `openclaw.plugin.json` in the plugin root

OpenClaw can also install compatible Codex, Claude, and Cursor bundles, but those are import-compatible content packs, not the full native plugin contract.

This matters for Pluxx because OpenClaw's bundle-compatibility docs explicitly split "detected" from "executed" behavior. Some Claude, Cursor, and Codex surfaces can be recognized for diagnostics or content import without becoming runnable native OpenClaw behavior. A Pluxx OpenClaw target should therefore emit native OpenClaw files first, and treat imported host bundles as a secondary compatibility lane.

### Are OpenClaw “skills” instruction playbooks, MCP tools, templates, or mixed?

Mixed, but centered on instruction playbooks.

- Skills are `SKILL.md` folders loaded from workspace, personal, managed, bundled, extra-dir, or plugin-provided roots.
- Skills are prompt-time guidance plus optional slash-command exposure.
- Skills can gate on bins, env vars, config, OS, and installer metadata.
- Skills can dispatch directly to tools for deterministic slash-command behavior.
- Skills are not just MCP wrappers.

### Is there a stable plugin manifest?

Yes.

`openclaw.plugin.json` is a documented native manifest with config schema, plugin identity, activation hints, channels/providers ownership, skill directories, UI hints, and other control-plane metadata that OpenClaw validates before runtime code loads.

### Where do agents and subagents live?

They are real, but not packaged exactly like the core four.

- User-facing agent instructions live in per-agent workspaces through files like `AGENTS.md`, `SOUL.md`, and `TOOLS.md`.
- Multi-agent routing and sandboxing live in gateway config.
- Subagents are a first-class runtime capability through `sessions_spawn` and `/subagents`.
- Plugins can register hooks, tools, services, and harnesses, but “specialist agent packaging” is more runtime/config-shaped than Claude/Cursor/Codex/OpenCode plugin-agent directories.

### How are permissions and dangerous actions controlled?

Through config-first policy, not a single per-skill permission manifest.

- tool profiles
- `tools.allow` / `tools.deny`
- per-agent tool policy
- sandbox mode/scope/backend
- elevated-tool policy
- plugin hook approvals
- channel and DM access policy

### How does MCP install/auth/config work?

OpenClaw supports both directions:

- OpenClaw can run as an MCP server through `openclaw mcp serve`.
- OpenClaw can store outbound MCP definitions under `mcp.servers`.
- Compatible bundles can contribute `.mcp.json` that OpenClaw merges into its embedded runtime.
- Supported transports include `stdio`, `sse`, and `streamable-http`.
- Auth supports env-backed headers and centralized secret/config handling.

The MCP row is credible, but should be proven with both local and remote fixtures before promotion. The compatibility-bundle path can expose supported stdio MCP servers, while native OpenClaw config is the stronger target for auth, secret references, setup diagnostics, and restart guidance.

### Is there a release or marketplace artifact model?

Yes.

- native plugins install through `openclaw plugins install`
- native plugins can come from ClawHub, npm, local paths, archives, or marketplaces
- skills have a separate public registry and install flow through ClawHub

### Can a generated Pluxx artifact be installed and smoke-tested headlessly?

Probably yes, but Pluxx has not proved it yet.

The obvious proof path is:

- `openclaw plugins install <artifact>`
- `openclaw plugins inspect <id>`
- `openclaw gateway restart`
- `openclaw plugins list --enabled`
- `openclaw skills list` or command/runtime checks for the generated surfaces

What is missing today is a Pluxx-owned fixture plus behavioral smoke that proves those steps for a native OpenClaw output.

### Is OpenClaw really just an OpenCode downstream profile?

No.

OpenClaw has some downstream compatibility behavior for Codex, Claude, and Cursor bundles, and it ships an OpenCode provider plugin, but the product itself is a distinct gateway-native assistant platform with its own plugin SDK, manifest, config, security, and runtime model.

Treat it as a standalone future target, not as an OpenCode alias.

The compiler implication is important: OpenClaw should not be modeled as "OpenCode plus a different install command." Its native target needs a separate capability registry row because plugin identity, runtime loading, setup metadata, bundle compatibility, security policy, and gateway restart semantics are all OpenClaw-specific.

## Primitive Bucket Draft

| Bucket | Status | Native OpenClaw surface | Notes |
| --- | --- | --- | --- |
| `instructions` | `translate` | workspace bootstrap files such as `AGENTS.md`, `SOUL.md`, `TOOLS.md`; skill bodies | Instruction intent is real, but it lands in workspace/bootstrap guidance rather than one plugin-bundled instruction manifest. |
| `skills` | `preserve` | `skills/<name>/SKILL.md`; plugin `skills` roots; ClawHub and managed skill dirs | This is one of OpenClaw’s strongest native surfaces. |
| `commands` | `preserve` | gateway slash commands, plugin `registerCommand(...)`, skill `user-invocable` and `command-dispatch` | Commands are first-class, even though some are skill-backed. |
| `agents` | `translate` | multi-agent config, per-agent workspaces, `sessions_spawn`, `/subagents`, plugin harnesses/hooks | Specialist-agent intent exists, but not in the same package-native layout as the current core four. |
| `hooks` | `preserve` | internal hooks (`HOOK.md` + `handler.ts`) and native plugin hooks (`api.on(...)`) | Both operator-installed hooks and plugin-runtime hooks are real. |
| `permissions` | `translate` | tool profiles, allow/deny lists, per-agent tool policy, sandboxing, elevated policy, approval hooks | Strong surface, but the authoring model is config/policy-first rather than frontmatter-first. |
| `runtime` | `preserve` | native plugin runtime, `openclaw.plugin.json`, `openclaw.extensions`, `mcp.servers`, `openclaw mcp serve`, secret refs | Runtime and MCP are real and broad. |
| `distribution` | `preserve` | npm packages, ClawHub, `openclaw plugins install`, marketplace installs, versioned plugin artifacts | Distribution/install is real enough to support a future target. |

### Compatibility Boundary

OpenClaw's ability to install Claude, Cursor, and Codex bundles is useful, but it should not be used as Pluxx's primary OpenClaw implementation strategy.

Known implications for Pluxx:

- a generated Claude bundle may be installable in OpenClaw without all Claude hooks or agents executing
- a generated Cursor bundle may expose skills while leaving Cursor rules, agents, or hooks as detect-only
- Codex app metadata may be reportable without becoming a native OpenClaw UI/runtime surface
- `.mcp.json` compatibility is useful, but OpenClaw-native `mcp.servers` plus setup/secret metadata is the more honest long-term runtime target
- install verification should inspect native plugin state, visible skills or commands, and at least one runtime behavior rather than treating "bundle installed" as proof

This is why the recommendation is beta-native target, not "ship OpenClaw by reusing generated OpenCode or Claude output."

## Decision Logic

OpenClaw differs from the core four in an important way:

- the core four are primary coding-host plugin surfaces
- OpenClaw is a gateway-native assistant platform that can also import some coding-host bundle formats

That means a future OpenClaw target is not just “add another manifest renderer”.
It is “add a native OpenClaw compiler path with its own install, config, and runtime proof”.

That is worthwhile, but it is beta-target work, not immediate prime-target work.

## If Pluxx Tracks It As Beta

Required implementation plan against the existing primitive workstreams:

### 1. Generator

Build a native OpenClaw generator that emits:

- `openclaw.plugin.json`
- package `openclaw.extensions` and `runtimeExtensions`
- skill roots for portable workflow content
- slash-command mapping for command intent
- hook output for the supported OpenClaw hook path
- install notes for restart-required plugin activation

OpenClaw bundle export can be a secondary path later, but the first-class target should be native OpenClaw output.

### 2. Validator and capability registry

Extend Pluxx capability rules to model:

- native OpenClaw plugin manifest requirements
- workspace/bootstrap instruction translation
- command mapping between slash commands and skill-backed commands
- per-agent and sandbox policy translation
- OpenClaw-native MCP transport/auth shapes
- bundle detect-only surfaces that should not be advertised as native runtime parity

### 3. Migration and doctor

Teach `doctor`, `lint`, and build summaries to explain:

- that instruction intent lands in workspace/bootstrap files
- that agent intent lands in multi-agent/subagent/runtime surfaces
- that permission intent lands in config and sandbox policy
- that compatible Claude/Cursor/Codex bundle import in OpenClaw is not equal to full native plugin parity

### 4. Fixture requirements

Before promotion beyond beta, add at least:

- one native OpenClaw plugin fixture with skills, commands, hooks, MCP, and config schema
- one permission/sandbox-heavy fixture
- one install/update/restart fixture
- one proof fixture that shows a Pluxx-generated OpenClaw artifact from one maintained source project

### 5. Smoke-test requirements

Before promotion to fifth target, require headless proof for:

- install: `openclaw plugins install`
- inspect: `openclaw plugins inspect`
- activation: `openclaw gateway restart`
- visibility: `openclaw plugins list --enabled`
- behavior: at least one generated skill or command and one generated hook or MCP path

### 6. Promotion gate

Promote only after:

- native generator exists
- validator and doctor messaging are honest
- one maintained fixture passes install and behavioral smoke
- the install/restart/runtime contract is stable enough that Pluxx can support it without caveat-heavy docs

## Bottom Line

OpenClaw should stay in scope.

It should not become a checkbox beside Claude Code, Cursor, Codex, and OpenCode yet.

The honest near-term position is:

- standalone target shape: yes
- beta target: yes
- promoted fifth target: not yet
