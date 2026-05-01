# Host Translation Notes

This example is intentionally richer than any one host can preserve 1:1.

## Claude Code

- best native surface for hook richness and skill frontmatter
- strongest place to preserve matcher-based pre-tool and post-tool policy hooks
- prompt hooks still degrade in the current generator

## Cursor

- preserves commands well
- preserves hook `matcher`, `failClosed`, and supported-event `loop_limit`
- narrows skill and agent metadata more than Claude

## Codex

- commands degrade into generated routing guidance and companion files
- hooks degrade into `.codex/hooks.generated.json`
- readiness degrades into `.codex/readiness.generated.json` plus external wiring guidance

## OpenCode

- runtime- and permission-centric target
- hook intent translates into generated runtime handlers
- command and agent semantics survive, but not in the same manifest shape as Claude or Cursor
