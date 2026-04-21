# Docs URL Ingestion

This is the working strategy note for treating docs URLs as a real Pluxx input surface instead of an optional afterthought.

## Why it matters

An MCP endpoint tells Pluxx what tools exist.

It does **not** tell Pluxx enough about:

- product language
- setup sequence
- auth nuance
- workflow framing
- examples that sound like the actual product
- what matters most to a real user

That is why raw MCP imports often need refinement. The tool inventory is necessary, but it is not sufficient.

Docs and website ingestion are the missing product context layer.

## What "docs ingestion" should mean

The goal is not a giant crawler that dumps raw HTML into the prompt.

The goal is:

1. accept one or more trusted URLs
2. fetch only the pages most likely to improve the scaffold
3. distill those pages into structured product context
4. feed that context into deterministic scaffolding and agent refinement

The output should help Pluxx answer:

- what is this product actually called?
- how does the team describe the workflows?
- what setup and auth steps matter most?
- what examples should appear in skills and instructions?
- how should the taxonomy sound?

## The input surfaces we should support

### 1. Product docs

Best examples:

- API reference
- MCP setup guide
- auth guide
- quickstart
- core workflow pages

These are usually the highest-signal inputs.

### 2. Product website

Best for:

- positioning
- language
- top-level workflow names
- product-facing framing

This is usually a secondary input, not the source of truth for auth or setup.

### 3. OpenAPI or machine-readable API docs

Best for:

- route names
- payload nouns
- operation grouping
- examples when written well

This is complementary to MCP introspection, not a replacement for it.

### 4. Supplemental context

Examples:

- README
- example repos
- changelog
- launch post

Useful when the core docs are thin or overly reference-shaped.

## Where docs ingestion should plug into Pluxx

### `pluxx init --from-mcp`

Near-term opportunity:

- accept `--website <url>`
- accept one or more `--docs <url>`

Use that context to improve:

- display name
- baseline instructions
- workflow grouping hints
- example prompts

### `pluxx autopilot`

This should become the best one-shot flow for teams with:

- a real MCP
- real docs
- real product positioning

Autopilot should be able to use those URLs before or during semantic refinement.

### `pluxx agent prepare`

This is the best current insertion point and should stay that way.

It is the cleanest place to:

- fetch docs
- fetch website pages
- normalize the findings
- write them into the context pack

## What should stay deterministic

Docs ingestion should not turn `init` into a prompt-only black box.

The deterministic parts should still own:

- URL collection
- fetch limits
- source tracking
- page selection rules
- structured extraction targets
- writing normalized outputs to disk

The agent layer should help with:

- synthesis
- naming judgment
- example generation
- taxonomy shaping

## Proposed artifacts

The likely output shape is:

- `.pluxx/sources.json`
  - source URLs, page titles, and provenance
- `.pluxx/docs-context.json`
  - distilled structured product signals
- `.pluxx/agent/context.md`
  - human-readable synthesis used by headless runners

The important thing is provenance. We should be able to tell which claims came from MCP introspection, docs, website copy, or user-supplied notes.

## Suggested extraction targets

Each ingestion pass should try to extract:

- product name and short description
- auth/setup model
- primary workflows
- user roles or audiences
- vocabulary/glossary
- example tasks or prompts
- warnings/caveats
- source confidence

That makes the output useful to both the deterministic scaffold and the semantic runner layer.

## Evaluation plan

We should evaluate docs ingestion explicitly, not just assume it helps.

Suggested benchmark:

1. choose a set of real MCPs
2. scaffold them from MCP only
3. scaffold them from MCP + docs/website inputs
4. compare:
   - taxonomy quality
   - instruction quality
   - auth/setup clarity
   - example quality
   - number of semantic edits needed afterward

This should become part of the broader `eval` story over time.

## Product risks

- bad docs can make the scaffold worse
- marketing pages can conflict with API reality
- crawl depth can explode quickly
- stale docs can introduce false confidence
- ingestion without provenance becomes hard to trust

So the system should prefer:

- fewer, better pages
- explicit provenance
- deterministic fetch and storage
- optional user review before semantic rewrites

## Current recommendation

The best near-term product stance is:

- keep `agent prepare --website --docs` as the primary context path
- make docs/website ingestion a first-class option for `init` and `autopilot`
- evaluate it on real MCP fixtures before claiming it as a core differentiator

This feels like a meaningful next wedge, not just a nice extra.

## What shipped first

The first implementation slice now lives in `pluxx agent prepare`.

Current behavior:

- Pluxx accepts `--website` and `--docs` as seed URLs for Agent Mode.
- If `--docs` points at a deep page like `https://docs.firecrawl.dev/mcp-server`, Pluxx keeps that exact page and also infers the broader docs root when it can.
- If only `--website` is provided, Pluxx probes a small set of likely docs roots such as `docs.<host>`, `/docs`, `/developers`, `/api`, and `/reference`.
- Pluxx writes provenance to `.pluxx/sources.json`.
- Pluxx writes extracted structured signals to `.pluxx/docs-context.json`.

That means the first step is no longer “stuff some fetched HTML into `context.md` and hope.” There is now a deterministic artifact trail for what was fetched, what was inferred, and what structured product signals were extracted.
