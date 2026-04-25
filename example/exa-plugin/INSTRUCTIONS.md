## Exa Research Example

Use this plugin when the user wants real research work, not a single shallow search.

This example is a clean-room Pluxx source project built against:
- Exa's public MCP
- Exa's public MCP docs
- the workflow shape of Exa's official Claude plugin

It is not an official Exa release. The point is to show how one maintained source project can preserve the same product intent across Claude Code, Cursor, Codex, and OpenCode.

### What This Plugin Is For

The main workflows are:

- `exa-deep-research`
  Multi-angle research, lead generation, literature review, competitive analysis, or any query where one search is not enough.

- `exa-company-research`
  Company mapping, competitors, positioning, funding, product surface, and public proof.

- `exa-people-research`
  Recruiter-style people discovery, public writing, experts, founders, operators, and contact surface.

- `exa-code-research`
  Code examples, docs, APIs, errors, migration notes, and practitioner writeups.

- `exa-source-review`
  Audit source quality, remove low-signal results, and pressure-test the synthesis before returning it.

- `exa-news-brief`
  Recent developments, timelines, reactions, and source-backed briefings.

### Operator Shape

This plugin should not be used like a raw MCP tool dump.

The expected shape is:

1. assess the request depth
2. choose the right workflow
3. fan out specialist agents or subagents when the task is broad enough
4. keep raw search payloads out of the main answer
5. deduplicate, score, and cite sources
6. keep the final answer compact enough to scan
7. write a file under `exa-results/<topic>-<YYYY-MM-DD>.md` if the full result set is too large for one screen

### Agent Map

Use these specialists when the host supports native delegated agents:

- `people-scout`
  recruiter-style people and expert discovery
- `company-scout`
  company, competitor, market, and product mapping
- `code-scout`
  docs, APIs, OSS examples, implementation notes, and error research
- `news-scout`
  recent developments, launches, reactions, and time-bounded scans
- `source-auditor`
  source quality review, filtering, and credibility weighting
- `synthesis-reviewer`
  final convergence check, dedupe review, and output shaping

If the host cannot express the exact same delegation surface, preserve the same separation of concerns in the working plan.

### Exa Runtime Rules

- Prefer Exa MCP tools over generic web search when this plugin is active.
- Use `web_search_exa` for most discovery work.
- Use `web_search_advanced_exa` when you need tighter filters, highlights, or stronger control over the result set.
- Use `web_fetch_exa` when snippets are not enough to validate a result.
- Treat Exa results as candidates, not truth. Validate them before returning them.
- If auth or rate limits fail, tell the user to set `EXA_API_KEY` instead of silently falling back to a different provider.

### Quality Rules

- Do not confuse query variety with angle variety. Synonyms are not enough.
- Prefer high-signal practitioner sources over generic SEO pages.
- Make date calculations explicit before you search when the request is time-bounded.
- Do not return a ranked list without stating the ranking criteria.
- Do not keep raw result dumps in the main context when delegated agents can compress them first.
- If the question is ambiguous between a quick lookup and a full deep dive, ask which depth the user wants.

### What Good Looks Like

A strong result from this plugin should:

- feel like a research operator, not a search box
- use parallel specialist work where justified
- cite sources clearly
- separate evidence from conclusion
- make the user's next action obvious
