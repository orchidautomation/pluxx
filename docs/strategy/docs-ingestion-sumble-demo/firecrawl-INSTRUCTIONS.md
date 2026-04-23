<!-- pluxx:generated:start -->
# Sumble

Sumble provides account intelligence data, enabling sales teams to do deep research. Use it to better inform your targeting and outreach.

Sumble connects to its MCP over HTTP. Claude Code and Cursor use platform-managed auth at runtime (for example native OAuth/custom connector flows). Exported env vars remain useful for scaffold refreshes and other non-platform-managed targets like Codex and OpenCode.

## Workflow Guidance

- `account-research`: Research companies, organizations, and account context before taking action. Primary tools: `AddOrganizationsToList`, `CreateOrganizationList`, `EnrichOrganization`, `GetAccountInformation`, `GetMyCompanyProfile`, `GetOrganizationList`, `ListOrganizationLists`, `MatchOrganizations`.
- `contact-discovery`: Find people, contacts, and buyer-side context at the right accounts. Primary tools: `AddContactsToList`, `CreateContactList`, `EnrichPerson`, `FindRelatedPeopleToJob`, `FindRelatedPeopleToPerson`, `GetContactList`, `ListContactLists`.
- `hiring-signals`: Use hiring activity and open roles as timing signals for outreach and research. Primary tools: `FindJobs`, `GetJobDescription`.
- `technographics`: Research technologies, tools, and stack adoption across target accounts. Primary tools: `SearchTechnologies`.
- `table-operations`: Build, inspect, run, document, and export tables, rows, and enrichment workflows. Primary tools: `ListTables`.
- `general-research`: Handle broad search and query workflows when there is not a more specific product surface match. Primary tools: `FindOrganizations`, `FindPeople`, `Query`.
- `log-out`: Log out the current user. Args: reason: Why you are calling this tool. Primary tools: `LogOut`.

## Tool Routing

- `GetAccountInformation`: Check your API key and account status.
- `GetMyCompanyProfile`: Get your company's profile and target account intelligence profile.
- `LogOut`: Log out the current user.
- `ListContactLists`: List the user's contact lists (people lists).
- `GetContactList`: Get one contact list and its people.
- `CreateContactList`: Create a new contact list (people list).
- `AddContactsToList`: Add people to an existing contact list.
- `ListOrganizationLists`: List the user's organization lists.
- `GetOrganizationList`: Get one organization list and its organizations.
- `CreateOrganizationList`: Create a new organization list.
- `AddOrganizationsToList`: Add organizations to an existing list.
- `FindJobs`: Find job listings matching a query.
- `GetJobDescription`: Get the full description for a job listing.
- `FindRelatedPeopleToJob`: Find people related to a job listing.
- `FindOrganizations`: Find organizations using specific technologies.
- `EnrichOrganization`: Enrich an organization with technology adoption data.
- `MatchOrganizations`: Match a list of organizations to Sumble's database.
- `FindPeople`: Find people at an organization.
- `EnrichPerson`: Enrich a person with contact information (email).
- `FindRelatedPeopleToPerson`: Find people related to a specific person.
- `SearchTechnologies`: Search for technologies by name.
- `Query`: Execute a read-only SQL query against the Sumble DuckDB.
- `ListTables`: List all available tables and their columns in the DuckDB.

## Sourced Context

- Workflow hints: Tech stack | Active projects | Org structure | Company and people profiles | Access Sumble your way | Sumble Web | Sumble Signals | Sumble Enrich
- Setup hints: Run the following command in your terminal to install the MCP claude mcp add --transport http sumble https://mcp.sumble.com --scope user | Complete auth and the MCP will be successfully setup
- Auth hints: Complete auth and the MCP will be successfully setup

## Operating Notes

- Prefer the most specific tool that matches the user request.
- If the MCP exposes resources or prompt templates, use them as canonical context before improvising your own workflow.
- Confirm required inputs before calling a tool.
- Summarize returned data instead of dumping raw JSON unless the user asks for it.

## User Config

- `sumble-api-key` (Sumble Api Key; secret, required) — env: `SUMBLE_API_KEY`: Authentication credential for the sumble MCP server.
<!-- pluxx:generated:end -->

## Custom Instructions

<!-- pluxx:custom:start -->
Add custom plugin instructions here. This section is preserved across `pluxx sync --from-mcp`.
<!-- pluxx:custom:end -->
