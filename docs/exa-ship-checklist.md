# Exa Ship Checklist

Last updated: 2026-04-26

## Doc Links

- Role: concrete ship checklist for the Exa proof, npm release, docs/site refresh, and blog launch
- Related:
  - [docs/exa-research-example.md](./exa-research-example.md)
  - [docs/proof-and-install.md](./proof-and-install.md)
  - [README.md](../README.md)
  - [site/examples/exa-research-example.mdx](../site/examples/exa-research-example.mdx)
  - [docs/first-proof-demo-asset-pack.md](./first-proof-demo-asset-pack.md)
- Update together:
  - [docs/exa-research-example.md](./exa-research-example.md)
  - [docs/proof-and-install.md](./proof-and-install.md)
  - [README.md](../README.md)
  - [site/examples/exa-research-example.mdx](../site/examples/exa-research-example.mdx)

Use this file when the question is not “does the Exa example work?” but “what exactly do we have to do next to ship the current state cleanly?”

## What Is Already Good Enough

- The Exa example exists as a maintained source project:
  - [example/exa-plugin](../example/exa-plugin)
- It builds, installs, and passes `verify-install` across Claude Code, Cursor, Codex, and OpenCode.
- It now has live workflow proof across real host surfaces:
  - Claude Code app
  - Cursor interactive flow
  - Codex Desktop app
  - OpenCode CLI
- The example already pressures and improves the compiler, so it is not just demo content.
- The example now has a project-owned headless behavioral smoke case at:
  - [example/exa-plugin/.pluxx/behavioral-smoke.json](../example/exa-plugin/.pluxx/behavioral-smoke.json)

## Nuanced Acceptance Pass

Before we send this to Exa, we should verify not only that each host returns an answer, but that each host obeys the intended workflow shape.

### Fastest repeatable rerun

From [example/exa-plugin](../example/exa-plugin):

```bash
pluxx test --install --trust --behavioral --target claude-code cursor codex opencode
```

Until the next npm release lands, the published `pluxx` package still lags the latest Claude manifest fix. The repo-local equivalent is:

```bash
node ../../bin/pluxx.js test --install --trust --behavioral --target claude-code cursor codex opencode
```

That reruns:

- config / lint / eval / build
- local install into the selected hosts
- `verify-install`
- the project-owned headless example query in `.pluxx/behavioral-smoke.json`

### Core workflow prompts

Run these against the current installed Exa example:

- `news-brief GPT-5.5 last 7 days`
- `people-research GTM engineers`
- `company-research Clay.com`
- `deep-research OpenAI Codex plugins MCP behavior`
- `source-review <a result set or candidate source list>`

The current headless behavioral smoke case intentionally targets the deep-research path because that was the highest-signal Claude failure mode.

### What must be true

1. The prompt uses Exa MCP tools for the live search path, not only local file reading or generic host web search.
2. Argument-bearing entrypoints preserve the intended input shape instead of forcing the model to guess.
3. Specialist workflows delegate when the host has a native subagent surface, and degrade honestly when the host does not.
4. Source-review behavior actually improves ranking, filtering, or evidence quality instead of only restating search results.
5. Permissions remain sane:
   - Exa MCP access should run without spurious approval churn
   - edit/bash prompts should still ask when the workflow crosses those boundaries
6. The host-specific UI cues should match the native translation story.
7. Every public install surface makes the trusted local hook explicit:
   - `scripts/check-exa-setup.sh`
   - what it does
   - why `pluxx install --trust` is the equivalent source-path action

### Host-specific checks

- Claude Code
  - command argument hint is visible on slash commands like `news-brief`
  - delegated agent calls visibly execute Exa MCP tools
  - deep research should not fall back to `The skill bailed (context too long)`
- Cursor
  - skills are discoverable in chat
  - delegated specialist passes show up as actual workflow steps, not just silent prompt paraphrase
- Codex
  - plugin mention or direct skill invoke results in a real `used Exa` path
  - plugin-scoped MCP works even though it does not appear in the global MCP settings page
- OpenCode
  - generated OpenCode skills use explicit native `@subagent` cues for specialist agents
  - specialist slash commands should bind native OpenCode `agent` + `subtask` metadata where one workflow clearly maps to one subagent
  - command ids remain intentionally short in the OpenCode palette, so the description column must still clearly show `Exa:` branding
  - the workflow should not claim OpenCode lacks subagents when the plugin bundle provides them

## Release Goal

Ship one clean npm update for `@orchid-labs/pluxx` that includes:

- the Exa example
- the Claude command/agent UX fixes
- the current core-four proof state
- the latest docs/install/proof surfaces

Then publish a clear launch story that uses Exa as the strongest non-docs showcase.

## P0 Before npm Publish

- [ ] Confirm the working tree is clean except for intentional release/docs changes.
- [ ] Run the full release gate locally:

```bash
npm run release:check
```

- [ ] Rerun the Exa example mechanical proof on the published CLI path:
- [ ] Cut the next npm release first so the published CLI includes the latest Claude plugin-agent manifest fix and the behavioral smoke runner.

After that, rerun the Exa example mechanical proof on the published CLI path:

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

- [ ] Confirm the Exa example still works in the most important live host paths:
  - Claude Code app
  - Cursor app
  - Codex Desktop app

## P0 npm Release Steps

1. Bump `package.json` version.
2. Commit the version bump.
3. Push `main`.
4. Tag the release:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

5. Let [release.yml](../.github/workflows/release.yml) publish to npm and create the GitHub release.

The release workflow already does the important things:

- `npm ci`
- `npm run release:check`
- `npm pack`
- Node runtime verification
- `npm publish --provenance --access public`
- GitHub release creation

## P0 Public Docs / Site Steps

- [ ] Make sure the Exa example page on the docs site reflects the current live proof state:
  - [site/examples/exa-research-example.mdx](../site/examples/exa-research-example.mdx)
- [ ] Make sure the repo entrypoints still point at the Exa proof:
  - [README.md](../README.md)
  - [docs/proof-and-install.md](./proof-and-install.md)
  - [docs/start-here.md](./start-here.md)
- [ ] Export one clean screenshot set for the launch surface:
  - Claude Code running Exa specialist workflow
  - Codex Desktop showing `used Exa`
  - Cursor interactive Exa workflow
  - plugin detail page with branding/screenshots

## P0 Blog / Launch Post Steps

- [ ] Publish the Exa story as the clearest public example of:
  - one maintained source project
  - native outputs across the core four
  - bundled MCP plus higher-level workflow layer
  - preserve / translate / degrade done honestly
- [ ] Include three concrete visuals:
  - source project tree
  - plugin detail page with metadata/screenshots
  - live host workflow screenshots
- [ ] Include one concrete install block:

```bash
npx @orchid-labs/pluxx init --from-mcp https://mcp.exa.ai/mcp --yes
```

- [ ] Include one concrete proof block:
  - Claude Code app PASS
  - Cursor app PASS
  - Codex Desktop app PASS
  - OpenCode CLI PASS

## Suggested Launch Sequence

1. Cut the npm release.
2. Verify the docs site is updated.
3. Publish the blog post.
4. Post the Exa example publicly with:
   - repo link
   - docs link
   - short proof bullets
5. Then do direct outreach to Exa with the clean-room example and proof links.

## What We Do Not Need Before Shipping

- We do not need perfect identical parity wording across every host.
- We do not need the Exa example in a separate public marketplace.
- We do not need the global Codex MCP settings page to show bundled plugin MCPs.
- We do not need every historical CLI rerun to be green if the current interactive proof and mechanical install proof are already strong and the remaining blockers are host-local noise.

## Done Means

This Exa ship block is done when:

- npm is updated
- the site page reflects the current proof truth
- the blog post is published
- the Exa example is easy to understand in under 60 seconds
- the proof can be shared with Exa without caveats that undercut the product
