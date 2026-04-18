# Pluxx Agent Context

## Plugin

- Name: `sumble-plugin`
- Display name: Sumble
- Targets: claude-code, cursor, codex, opencode

## MCP

- Metadata source: `.pluxx/mcp.json`
- Semantic taxonomy: `.pluxx/taxonomy.json`
- Server name: `sumble`
- Transport: http
- Auth: bearer via SUMBLE_API_KEY
- Tool count: 23
- Resource count: 0
- Prompt template count: 0

## Generated Skills

### `account-research`

- Title: Account Research
- Tools: AddOrganizationsToList, CreateOrganizationList, EnrichOrganization, GetAccountInformation, GetMyCompanyProfile, GetOrganizationList, ListOrganizationLists, MatchOrganizations

### `contact-discovery`

- Title: Contact Discovery
- Tools: AddContactsToList, CreateContactList, EnrichPerson, FindRelatedPeopleToJob, FindRelatedPeopleToPerson, GetContactList, ListContactLists

### `hiring-signals`

- Title: Hiring Signals
- Tools: FindJobs, GetJobDescription

### `technographics`

- Title: Technographics
- Tools: SearchTechnologies

### `table-operations`

- Title: Table Operations
- Tools: ListTables

### `general-research`

- Title: General Research
- Tools: FindOrganizations, FindPeople, Query

### `log-out`

- Title: Log Out
- Tools: LogOut

## Lint Snapshot

- Errors: 0
- Warnings: 1

### Current Issues

- [warning] codex-hooks-external-config: Codex plugin docs currently separate hook configuration from plugin packaging, so Pluxx does not bundle Codex hooks into generated plugin output. If you want Codex to run these hooks, configure them in `~/.codex/hooks.json` or `<repo>/.codex/hooks.json` and enable `codex_hooks = true` in Codex itself.

## Write Contract

- Edit only Pluxx-managed generated sections.
- Preserve custom sections marked by `<!-- pluxx:custom:start -->` and `<!-- pluxx:custom:end -->`.
- Do not change auth wiring or target-platform config unless explicitly requested.
- Do not edit generated platform bundles in `dist/`.

## Quality Bar

- Each skill should represent a real user workflow or product surface.
- Setup, admin, account, and runtime workflows should be grouped intentionally.
- Prefer branded product language in user-facing content; avoid exposing raw MCP server identifiers unless they are operationally required.
- Avoid tiny singleton skills unless the surface is genuinely standalone.
- Examples should be concrete and specific, not generic placeholders.
- Weak MCP metadata (missing/generic tool descriptions) should be called out explicitly before publishing.
- The wording should match the MCP product narrative, not just raw tool names.
- Use discovered MCP resources and prompt templates when they clarify the real product surface.
- Respect the per-skill resource and prompt-template associations in the metadata/context unless stronger discovery evidence shows they are wrong.
- Keep INSTRUCTIONS.md as concise routing guidance; do not dump raw vendor documentation into generated sections.

