---
name: exa-deep-research
description: Run deep research with Exa using specialist agents, source review, and compact source-backed synthesis. Use for lead generation, literature reviews, competitive analysis, or any query where one search is not enough.
arguments: [topic]
context: fork
agent: Explore
allowed-tools: Read Write Edit MultiEdit
---

# Exa Deep Research

Use this skill when the task needs more than one search pass.

## What To Load

- For orchestration rules, see [references/orchestrator-playbook.md](references/orchestrator-playbook.md).
- For query shape guidance, see [references/query-patterns.md](references/query-patterns.md).

## Workflow

1. Decide whether the request is simple, moderate, advanced, or complex.
2. If the task is ambiguous between a quick lookup and a full deep dive, ask the user which depth they want.
3. Use the strongest matching specialist agents:
   - `people-scout`
   - `company-scout`
   - `code-scout`
   - `news-scout`
   - `source-auditor`
   - `synthesis-reviewer`
4. Keep raw Exa results out of the main answer whenever delegated agents can compress them first.
5. Use `web_search_advanced_exa` when the query needs richer filters, highlights, or tighter control than `web_search_exa`.
6. Use `web_fetch_exa` on the most promising URLs before final synthesis when snippets are not enough.
7. If the answer would exceed one screen, write the full result set to `exa-results/<topic>-<YYYY-MM-DD>.md` and keep the in-chat answer compact.

## Output

Return:

- a compact answer that directly solves the user's request
- citations with URLs
- the main process or ranking note if it materially affects the answer
