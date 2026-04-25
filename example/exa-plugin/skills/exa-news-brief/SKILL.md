---
name: exa-news-brief
description: Build a source-backed recent-news brief with Exa. Use for timelines, recent launches, reactions, or fast briefings on what changed.
---

# Exa News Brief

## What To Load

- For recent-news query shapes, see [references/news-patterns.md](references/news-patterns.md).

## Workflow

1. Calculate the date window explicitly before searching.
2. Start with `news-scout`.
3. Use `source-auditor` if the story is noisy or the sources disagree.
4. Return a short timeline with the key URLs.
