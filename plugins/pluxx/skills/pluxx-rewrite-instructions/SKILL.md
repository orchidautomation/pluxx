---
name: pluxx-rewrite-instructions
description: Rewrite INSTRUCTIONS.md so a Pluxx scaffold explains itself clearly.
---

# Pluxx Rewrite Instructions

Use this skill when the scaffold structure is fine but the shared instructions need to sound more like the actual MCP product.

## Workflow

1. Refresh context:
   - `pluxx agent prepare`
   - include `--website`, `--docs`, and local context files when they clarify the product
2. Generate or run the instructions prompt:
   - `pluxx agent prompt instructions`
   - or `pluxx agent run instructions --runner codex`
3. Limit edits to the generated block in `INSTRUCTIONS.md`.
4. Re-run:
   - `pluxx lint`
   - `pluxx test`

## Rules

- Keep the output concise and operational.
- Make setup/auth caveats explicit when they affect tool usage.
- Use branded product-facing language and avoid raw MCP server/tool naming unless technically required.
- Clarify setup/admin/account/runtime boundaries so agents know where each skill belongs.
- Explain what the plugin is for, how the skills should be used, and what the host agent must not do.
- Do not rewrite custom sections unless the user explicitly asks.

## Output

- Summarize the instruction changes.
- Mention any setup/auth caveats that still need manual confirmation.
