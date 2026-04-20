---
name: pluxx-validate-scaffold
description: Run doctor, lint, eval, and test on a Pluxx scaffold.
---

# Pluxx Validate Scaffold

Use this skill when the user wants to know whether the current Pluxx project is actually healthy enough to trust.

## Workflow

1. Run the source-project checks:
   - `pluxx doctor`
   - `pluxx lint`
   - `pluxx eval`
2. Run the end-to-end verification pass:
   - `pluxx test`
3. If the user asks for a narrower target subset, scope `test` accordingly.

## Rules

- Findings come before reassurance.
- Separate structural issues from quality issues.
- Use `eval` to talk about scaffold quality, not just whether the files exist.
- If everything passes, say so directly and note any remaining soft risks.

## Output

- Return the important errors, warnings, and quality findings.
- Make the next recommended action obvious:
  - refine
  - build
  - install
  - or ship
