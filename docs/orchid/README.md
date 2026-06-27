# Agent Artifact Map

This repo is prepared for the Orchid Agent Stack.

- `brainstorms/` stores early thinking, PRDs, and problem framing.
- `requirements/` stores scoped source summaries and requirements.
- `plans/` stores implementation plans and CE plans.
- `todos/` stores durable handoffs and task breakdowns that do not belong in Linear yet.
- `decisions/` stores ADRs and durable product/architecture decisions.
- `solutions/` stores reusable solved-problem writeups and compound learning.
- `reviews/` stores document/code review summaries.
- `history/` stores curated Entire-backed work history, provenance summaries, and "what happened" writeups.
- `pulse-reports/` stores product pulse reports.
- `visual-plans/` stores BuilderIO/Agent-Native visual plan MDX artifacts.
- `visual-recaps/` stores BuilderIO/Agent-Native visual recap MDX artifacts.
- `qa/` stores QA notes, screenshots, and release/deploy evidence.

Keep raw, private, temporary, or bulky agent outputs in `.agent-artifacts/`, which should be gitignored.

Codex automatic Entire capture is not wired through repo-local `.codex/hooks.json`.
The maintained Pluxx Codex hook probes currently show project-local Codex hooks can
complete without executing side effects, even with `[features].hooks = true`,
project trust, and `--enable hooks`. Use a proven host hook surface or an
explicit Entire command until Codex hook activation is validated for this repo.
