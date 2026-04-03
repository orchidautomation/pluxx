# Platform Rules Verification — Firecrawl Audit (April 3, 2026)

Scraped all 6 remaining platform docs with Firecrawl. Cross-referenced against `src/validation/platform-rules.ts`.

## Verification Results

### Warp -- ALL CORRECT
- Source: https://docs.warp.dev/agent-platform/capabilities/skills (200)
- Skill dirs: 10 dirs confirmed (`.agents/skills/` through `.opencode/skills/`)
- Frontmatter: `name` + `description` standard
- Arguments: `$ARGUMENTS`, `$ARGUMENTS[N]`, `$N` (same as Claude Code)
- Global: `~/.agents/skills/`, `~/.warp/skills/`, etc.
- No manifest format (correct in our rules)

### Roo Code -- ALL CORRECT
- Source: https://docs.roocode.com/features/custom-instructions (200)
- Rules: `.roo/rules/` (preferred) or `.roorules` (fallback)
- Mode-specific: `.roo/rules-{modeSlug}/` or `.roorules-{modeSlug}`
- AGENTS.md: Supported, loads from workspace root
- Global: `~/.roo/rules/`
- Skills: Uses `.claude/skills/` and `.cline/skills/` compat dirs
- **NOTE**: Bad URLs in individual PR were fixed by using PLUG-15 bundled version

### OpenHands -- MOSTLY CORRECT, 1 NEW FINDING
- Source: https://docs.openhands.dev/sdk/guides/plugins (200)
- Manifest: `.plugin/plugin.json` -- CONFIRMED (our generator correctly uses this after the fix)
- Skills: YAML frontmatter with standard fields + `trigger` field (type: keyword, keywords: [...])
- Hooks: `hooks/hooks.json`, PascalCase events (`PostToolUse`)
- MCP: `.mcp.json`
- **NEW**: OpenHands skills support a `trigger` frontmatter field with keyword-based activation
- **ACTION**: Add `trigger` to OpenHands supported frontmatter in platform-rules.ts

### Cline -- ALL CORRECT, NEW DETAILS
- Source: https://docs.cline.bot/customization/skills (200)
- Skills: `.cline/skills/` (workspace), `~/.cline/skills/` (global)
- Also: `.clinerules/skills/`, `.claude/skills/`
- `name` MUST match directory name -- CONFIRMED
- Description max 1024 chars -- CONFIRMED
- **NEW**: Skills is experimental, needs `Settings > Features > Enable Skills`
- **NEW**: Progressive loading: metadata ~100 tokens, instructions <5k tokens, resources unlimited
- **NEW**: Global skills take precedence over project skills with same name (opposite of some others)

### Gemini CLI -- MOSTLY CORRECT, SEVERAL NEW FINDINGS
- Source: https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md (200)
- Manifest: `gemini-extension.json` -- CONFIRMED
- Name must match directory name, lowercase/numbers/dashes -- CONFIRMED
- **NEW FIELDS NOT IN OUR RULES**:
  - `contextFileName` (defaults to GEMINI.md)
  - `excludeTools` (array of tool names to block)
  - `migratedTo` (URL for extension migration)
  - `plan.directory` (planning artifacts path)
  - `settings` (array with name, description, envVar, sensitive)
  - `themes` (array of custom theme objects)
- **CORRECTION**: Custom commands use TOML format (`commands/*.toml`), NOT markdown
- **NEW**: `${extensionPath}` and `${workspacePath}` variables in configs
- **NEW**: Policy engine with `policies/*.toml` files
- **ACTION**: Update Gemini CLI rules with new manifest fields and TOML commands

### AMP -- VERIFIED BUT SPARSE
- Source: https://ampcode.com/manual (200)
- Multi-model agent (Opus 4.6, GPT-5.4)
- Subagents + Oracle concept
- CLI + web UI for thread sharing
- **Docs are less structured than others** -- manual is more of a user guide than a plugin spec
- Our rules are reasonable approximations based on available info

## Actions Required

1. **OpenHands**: Add `trigger` to supported frontmatter fields
2. **Gemini CLI**: Add contextFileName, excludeTools, migratedTo, plan, settings, themes to manifest fields. Fix commands format (TOML not MD). Add variable substitution.
3. **Cline**: Add note about experimental feature flag. Document progressive loading token budgets. Note global > project precedence.
4. **AMP**: Mark rules as "approximate" since docs are sparse.

## Overall Assessment

Our platform-rules.ts is **85-90% accurate**. The main gaps are:
- Gemini CLI has significantly more manifest fields than we captured
- OpenHands has a unique `trigger` frontmatter field
- Cline has some behavioral nuances (experimental flag, precedence order)

None of these are blocking for the current generators — they're lint rule refinements.
