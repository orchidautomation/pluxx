# Instructions Prompt

You are refining the Pluxx-generated plugin scaffold for `sumble-plugin` (Sumble).

Inputs:
- `.pluxx/agent/context.md`
- `.pluxx/agent/plan.json`
- `.pluxx/taxonomy.json`
- `INSTRUCTIONS.md`
- `skills/account-research/SKILL.md`
- `skills/contact-discovery/SKILL.md`
- `skills/hiring-signals/SKILL.md`
- `skills/technographics/SKILL.md`
- `skills/table-operations/SKILL.md`
- `skills/general-research/SKILL.md`
- `skills/log-out/SKILL.md`
- `commands/account-research.md`
- `commands/contact-discovery.md`
- `commands/hiring-signals.md`
- `commands/technographics.md`
- `commands/table-operations.md`
- `commands/general-research.md`
- `commands/log-out.md`

Rules:
- Only edit Pluxx-managed generated sections.
- Preserve all custom-note blocks between `<!-- pluxx:custom:start -->` and `<!-- pluxx:custom:end -->`.
- Do not change auth wiring or target-platform config.
- Do not edit files under `dist/`.
- Treat discovered MCP resources, resource templates, and prompt templates as part of the product surface when they are present in the context and metadata.
- Treat per-skill related resources and prompt templates in the context as default evidence for workflow boundaries and examples unless stronger discovery evidence contradicts them.
Your job:
1. Rewrite only the generated block in `INSTRUCTIONS.md`.
2. Explain what the plugin is for, how the skills should be used, and which setup/admin/account/runtime boundaries matter.
3. Use discovered tools, resources, resource templates, and prompt templates to produce short routing guidance, not a raw documentation dump.
4. Keep wording aligned to the MCP's product narrative and branded language; avoid raw MCP server/tool identifiers except when technically required.
5. Prefer the branded product name in user-facing copy; do not lead with internal MCP server identifiers.
6. Replace stale scaffold claims with current discovery-backed language and keep command examples operational, concrete, and copy-paste runnable.
7. When a workflow already has related resources or prompt templates in the context, keep the wording and examples aligned to that surfaced workflow evidence.

Success criteria:
- instructions are concise, actionable, and product-shaped
- wording is branded and product-facing, not raw MCP-internal naming
- auth/setup/admin caveats are explicit when relevant
- raw MCP server identifiers are omitted unless operationally necessary
- the generated section reads like routing guidance, not pasted vendor docs
- command examples use strong command UX (clear intent, realistic args, and runnable shapes)
- workflow guidance stays coherent with related resource and prompt-template evidence in the context
- the file remains safe for future `pluxx sync --from-mcp`
