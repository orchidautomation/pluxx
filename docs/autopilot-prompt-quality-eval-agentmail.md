# Autopilot Prompt Quality Eval (AgentMail Scaffold)

## Scope

This evaluation checks prompt-pack quality for `pluxx autopilot` against a real MCP-derived plugin shape (AgentMail-style CRM/email assistant surface), focusing on taxonomy, instructions, and review prompts.

## Baseline (Before)

- Taxonomy prompt strongly encouraged product-shaped naming, but did not explicitly reject stale scaffold assumptions when discovery context contradicted existing labels.
- Instructions prompt warned against raw doc dumps, but did not explicitly require runnable command examples with strong command UX.
- Review prompt covered raw docs and metadata quality, but did not explicitly call out lexical skill names, stale assumptions, and weak command UX as first-class findings.

## Updated Prompt-Pack Behavior (After)

- Taxonomy prompt now requires rejecting stale scaffold assumptions and grounding grouping decisions in current discovery evidence.
- Taxonomy success criteria now explicitly include command quality (`avoid weak command UX`).
- Instructions prompt now requires replacing stale scaffold claims and producing command examples that are concrete and copy-paste runnable.
- Instructions success criteria now explicitly require strong command UX.
- Review prompt now explicitly checks:
  - lexical skill names
  - stale scaffold assumptions
  - weak command UX
- Review success criteria now require explicit identification of stale assumptions and command-UX weaknesses.

## Observed Delta

- Before: quality checks were implied and partially enforced.
- After: quality checks are explicit, testable, and aligned with real MCP drift patterns seen in AgentMail-style scaffolds.

## Regression Fixtures

- `tests/agent-mode.test.ts` now asserts the new language in generated prompt packs so regressions fail fast when prompt quality drifts.
