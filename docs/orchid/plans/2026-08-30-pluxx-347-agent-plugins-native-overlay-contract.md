# PLUXX-347 — Agent Plugins native-overlay contract

## Objective

Define and enforce the evidence boundary between the Agent Plugins v1 portable
core and Pluxx host-native outputs before PLUXX-346 adds the portable emitter.
The result must prevent Pluxx from inventing reverse-domain client-extension
contracts while preserving the current Claude Code, Cursor, Codex, and
OpenCode bundles.

## Pinned source

- Repository: `orchidautomation/pluxx`
- Base branch: `main`
- Source ref: `codex/pluxx-347-overlay-contract-plan`
- Source commit at planning start: `df8aede57c5810c95a3b8f3c61fa656770412d71`
- Linear issue: `PLUXX-347`
- Parent: `PLUXX-346`
- Risk: Elevated — a false portability claim can silently remove hooks or
  validation from downstream consumers.

The implementation must start from the committed plan ref and must stop before
merge, package publication, release, or installation.

## Evidence baseline

Use first-party documentation as authority. Firecrawl developer-index evidence
collected on 2026-08-30 established the following starting facts:

1. Agent Plugins v1 defines exactly two portable component types: skills and
   MCP servers. It assigns no portable semantics to extension data or files.
   Source: `https://github.com/vercel-labs/open-plugin-spec/blob/098fee497fa5b046e8bc6d7da1b64e6f70ed270e/spec/1.0.0.md`.
2. Cursor documents two distinct formats: Agent Plugins for skills/MCP and
   Cursor Plugins for skills, MCP, rules, agents, commands, and hooks. Its
   native hook discovery path is `hooks/hooks.json`; that is not evidence for a
   reverse-domain Agent Plugins extension. Source:
   `https://cursor.com/docs/reference/plugins`.
3. Codex loads native plugin hooks from `hooks/hooks.json` and uses its native
   plugin bundle contract. This is not evidence that `com.openai/hooks` is an
   Agent Plugins extension contract. Source:
   `https://learn.chatgpt.com/docs/hooks` and the current OpenAI Codex plugin
   documentation linked from the repository's provider audit.
4. Claude Code and OpenCode retain richer native plugin/runtime surfaces; they
   must not be reclassified as portable without a client-owned extension
   schema and installed-client proof.

Refresh every cited page during implementation. If a current first-party page
contradicts this baseline, record the delta instead of preserving the plan's
assumption.

## Required change set

### 1. Authoritative contract and matrix

Add a maintained document, expected at
`docs/agent-plugins-native-overlay-contract.md`, containing one row per relevant
client and capability:

- client and namespace owner;
- portable Agent Plugins support;
- documented extension namespace, if any;
- documented extension directory/schema, if any;
- hooks, agents/subagents, commands, metadata, permissions, and installation;
- disposition: `portable`, `native`, `extension-proven`, `degraded`, or
  `unsupported`;
- first-party source URL and retrieval date;
- installed fixture required before an `extension-proven` claim.

The initial policy is fail-closed: an absent client-owned namespace/schema or
an absent installed behavioral fixture means native output, explicit
degradation, or omission — never an inferred extension.

Update the existing provider/matrix surfaces that own the same truth, including
`docs/core-four-primitive-matrix.md` and the smallest relevant provider-audit or
translation document. Follow every edited document's `Doc Links` contract and
avoid a broad documentation rewrite.

### 2. Machine-enforced extension policy

Add the smallest reusable policy surface needed by PLUXX-346. It must:

- maintain an explicit allowlist of client-extension contracts;
- require namespace owner, first-party schema citation, supported paths or
  fields, and installed-fixture identity for every allowlisted entry;
- reject an unknown namespace, undocumented path/field, missing citation, or
  missing installed fixture;
- permit an empty allowlist;
- expose deterministic diagnostics that PLUXX-346 can surface as degradation
  rather than silently emitting files.

Keep this independent of the not-yet-implemented `agent-plugins` generator.
Do not add a placeholder emitter, speculative host mapping, new dependency, or
private Pluxx extension.

Expected surfaces are a focused module under `src/`, its unit test under
`tests/`, and only the exports needed for later PLUXX-346 consumption. The
implementer may choose exact filenames consistent with current repository
conventions.

### 3. Cursor and Codex decisions

Record explicit decisions that:

- `com.cursor/hooks` is not emitted absent a Cursor-owned Agent Plugins
  extension contract plus installed proof;
- `com.openai/hooks` is not emitted absent an OpenAI-owned Agent Plugins
  extension contract plus installed proof;
- existing Cursor and Codex native bundles remain the enhancement path;
- `hooks/hooks.json` in a native plugin does not by itself prove a portable or
  reverse-domain extension contract.

## Forbidden changes

- No `agent-plugins` target or portable emitter; PLUXX-346 owns it.
- No MDP repository changes; MDP-221 owns consumer adoption.
- No release/version bump, tag, publish, install, or deployment.
- No invented `com.<client>` schema or Pluxx-private namespace presented as
  portable.
- No removal or weakening of current native Claude Code, Cursor, Codex, or
  OpenCode behavior.
- No Compound Engineering or Claude Code worker path.

## Validation

Run at minimum:

```bash
npm ci
npm run build
npm run typecheck
npm test
npm run release:check
```

Add focused tests proving:

- the empty allowlist is valid;
- an unknown namespace fails closed;
- an entry without a first-party citation fails;
- an entry without installed-fixture identity fails;
- an undocumented path/field fails;
- a fully evidenced synthetic fixture passes without granting any real client
  an extension claim.

Review the final diff for the forbidden strings `com.cursor/hooks` and
`com.openai/hooks`: they may appear only in explicit negative decisions/tests,
never as emitted output.

## Acceptance mapping

- Every emitted extension requires a client-owned citation: enforced by the
  policy module and documented matrix.
- Every implemented extension requires installed proof: enforced as mandatory
  allowlist evidence.
- Undocumented extensions fail or degrade explicitly: deterministic policy
  diagnostics.
- Portable core remains useful without extensions: empty allowlist is valid.
- Matrix distinguishes all five dispositions: documented contract table.
- Cursor/Codex hooks are not assumed: explicit negative decisions and tests.

## Handoff and stop condition

Produce one focused PR linked to PLUXX-347 with `ai:autofix-enabled`. The PR
must include source citations, focused validation, exact residual risks, and
the PLUXX-346 integration point. Stop for Brandon's merge. Do not claim release
or installed proof; this issue defines and tests the contract, while PLUXX-346
must later consume it and provide portable-emitter fixtures.
