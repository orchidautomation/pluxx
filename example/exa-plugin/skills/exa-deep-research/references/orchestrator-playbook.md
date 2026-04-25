# Exa Deep Research Playbook

## Complexity Tiers

- Simple: 1-2 searches, no parallel fanout.
- Moderate: one specialist agent to keep the main context clean.
- Advanced: several complementary search angles plus source review.
- Complex: multi-pass fanout, dedupe, and follow-up searches.

## Fanout Rules

- Split by search angle, not synonyms.
- Use people, company, code, or news specialists when the task clearly matches one of those domains.
- Always send borderline or ranked result sets through `source-auditor`.
- Use `synthesis-reviewer` before returning large or ranked outputs.

## Final Answer Shape

- keep it under one screen when possible
- state the answer first
- include URLs
- mention process only when it changes how the answer should be interpreted
