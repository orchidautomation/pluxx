<!-- pluxx:generated:start -->
# Sumble

Use Sumble for account intelligence, buyer discovery, technographic research, and hiring-based timing signals. Route requests by workflow, not by backend tool name: understand the account motion first, resolve technologies into Sumble slugs, find matching companies or people, and use lists when the user wants to save or operationalize the result.

## Setup And Boundaries

- Claude Code and Cursor use platform-managed auth. Codex and OpenCode require `SUMBLE_API_KEY`.
- If access, credits, territory context, or your company positioning is unclear, start with `/account-research`. Example: `/account-research "check my account status, remaining credits, and company profile"`
- No Sumble resources or prompt templates were surfaced in this scaffold, so keep routing workflow-first.
- Keep user-facing language Sumble-first. Mention internals only when they are operationally required, such as `SUMBLE_API_KEY`, list IDs, profile URLs, or a last-resort DuckDB query.

## Route By Workflow

- `account-research`: Use for territory and account-list work, company matching, organization enrichment, account status, and your own company profile. Start here for "my accounts", "my territory", "build an account list", or "enrich this company." Example: `/account-research "show my territory lists, then enrich datadog.com for cloud-security and gen-ai signals"`
- `technographics`: Use first when the request starts from a vendor, platform, or product name and downstream searches will need Sumble technology slugs. Example: `/technographics "resolve snowflake, databricks, and dbt into Sumble technology slugs"`
- `general-research`: Use for broad account discovery, account-level people search inside one known organization, and custom analysis only when a structured Sumble workflow cannot express the request. Example: `/general-research "find 25 US fintech companies with 500+ employees using snowflake or databricks"`
- `contact-discovery`: Use when the user wants to enrich a person, expand from a known contact or job, build a contact list, or save people for follow-up. Example: `/contact-discovery "find people related to the VP of Data at datadog.com and save them to a new contact list"`
- `hiring-signals`: Use for job searches, hiring momentum, and role-level timing signals. Pull the full description only when the posting text itself matters. Example: `/hiring-signals "search my default organization list for AI Engineer or MLOps hiring in the last 3 months"`
- `table-operations`: Use only to inspect the DuckDB schema before a custom SQL fallback. The live surface here is schema discovery, not table creation, exports, or workflow automation. Example: `/table-operations "list DuckDB tables and columns before a custom hiring-trends query"`
- `log-out`: Use only when the user explicitly wants to disconnect the current Sumble session. Example: `/log-out "disconnect my current Sumble session"`

## Runtime Guardrails

- Prefer Sumble’s structured workflows over raw SQL. SQL is lower-confidence because the query is generated dynamically and bypasses the curated search surfaces.
- Start technology-led requests with `/technographics`; Sumble filters expect technology slugs, not casual product names.
- Distinguish ad hoc people search from contact operations: use `/general-research` for search inside a known organization, and `/contact-discovery` when the user wants enrichment, related people, or contact-list actions.
- Share Sumble profile URLs and list URLs whenever they are returned.
- Most non-admin reads consume credits. Treat `402` as a credit issue, not a tool failure, and warn before noticeably higher-cost paths such as organization enrichment, entity-detail expansion, detailed list retrieval, person enrichment, or broad SQL output.

## Current Caveats

- `table-operations` is over-described in the scaffold taxonomy; the live workflow currently exposes schema listing only.
- `log-out` is an operational admin action, not a research surface.
<!-- pluxx:generated:end -->

## Custom Instructions

<!-- pluxx:custom:start -->
Add custom plugin instructions here. This section is preserved across `pluxx sync --from-mcp`.
<!-- pluxx:custom:end -->
