---
name: "account-research"
description: "Research companies, organizations, and account context before taking action."
---

<!-- pluxx:generated:start -->
# Account Research

Research companies, organizations, and account context before taking action.

## Tools In This Skill

### `AddOrganizationsToList`

Add organizations to an existing list.

    Accepts Sumble organization IDs and/or slugs. Returns
    which were added and which failed.

    WORKFLOW — when a user provides company names/URLs:
    1. Call match_organizations to resolve them to Sumble
       IDs.
    2. Call add_organizations_to_list with the matched IDs
       (use the "id" field from each match result).

    If you already have Sumble org IDs (from a SQL query,
    find_organizations, or another API call), skip step 1
    and pass them directly as organization_ids.

    Args:
        reason: Why you are calling this tool.
        list_id: The organization list ID (from
            list_organization_lists or
            create_organization_list).
        organization_ids: Sumble organization IDs to add.
        organization_slugs: Sumble organization slugs to
            add (resolved server-side).
    

Inputs:
- `reason` (string, required)
- `list_id` (integer, required)
- `organization_ids` (unknown)
- `organization_slugs` (unknown)

### `CreateOrganizationList`

Create a new organization list.

    Returns the new list's id and name. Use
    add_organizations_to_list to populate it afterward.
    Share the list url with the user so they can view it in the dashboard.

    WORKFLOW — when a user provides company names/URLs:
    1. Call match_organizations to resolve them to Sumble
       IDs.
    2. Call create_organization_list to make the list.
    3. Call add_organizations_to_list with the matched IDs.

    If you already have Sumble org IDs (from a SQL query,
    find_organizations, or another API call), skip step 1
    and use those IDs directly.

    Always ask the user for the list name to use. If you
    have a good guess for the name, you can suggest it in the prompt,

    Args:
        reason: Why you are calling this tool.
        name: Name for the new list.
    

Inputs:
- `reason` (string, required)
- `name` (string, required)

### `EnrichOrganization`

Enrich an organization with technology adoption data.

    Shows which technologies an org uses, with job and
    people counts per technology. At least one of
    technologies, technology_categories, or query is
    required.

    If results include URLs or links, always share them
    with the user.

    Costs 5 credits per technology found. If you get a 402
    error, the user needs more credits. Direct them to
    https://sumble.com/account/purchase

    TECHNOLOGY CATEGORY SLUGS (commonly used):
    crm, business-intelligence, cloud-data-warehouse,
    data-catalog, gen-ai, mlops, ml-training,
    cybersecurity, cloud-security, ci-cd, ipaas,
    event-streaming, data-pipeline-orchestration, etl,
    logging-observability-monitoring,
    data-quality-and-observability,
    customer-data-platform,
    feature-flagging-and-a-b-testing,
    vector-database, oss-data-science,
    commercial-data-science,
    infrastructure-as-code-tools, design,
    javascript, siem, edr, headless-cms,
    ccaas, endpoint-management, ecommerce-platform,
    vibe-coding,
    marketing-automation-platforms, frontier-ai-models,
    processing-units-and-chips,
    cloud-and-container-orchestration-platforms,
    identity-and-access-management

    ADVANCED QUERY SYNTAX (use `query` param):
    Operators: EQ, NEQ, IN, NOT IN.
    Combine with AND, OR. Group with parentheses.
    Values are single-quoted. IN/NOT IN use
    comma-separated values in parens.

    Available fields:
    - technology — EQ/IN/NOT IN. Use slugs from
      search_technologies.
    - technology_category — EQ/IN/NOT IN. Slugs
      from the list above.
    - industry — EQ/IN/NOT IN.
    - employee_count — EQ/IN. Range format:
      '100-1000', '1000-' (1000+), '-500' (up to 500).
    - hq_location — EQ/IN/NEQ. Format:
      'US', 'US:Texas', 'US:Texas:Austin'.
      Use full state names, not abbreviations.
      'UK' is auto-converted to 'GB'.
      Region codes: EMEA, APAC, NAMER, LATAM,
      Americas, Europe, MiddleEast, Africa.
    - tag — EQ/IN (e.g. 'digital_native').
    - sic_code — EQ (e.g. '7371').
    - naics_code — EQ (e.g. '541511').

    Example: technology_category EQ 'gen-ai'
    AND employee_count EQ '1000-'

    Args:
        organization: Domain, numeric ID, or slug
            (e.g. "sumble.com", "1726684", "sumble")
        reason: Why you are calling this tool.
        technologies: Technology slugs to search for
            (use search_technologies to find valid slugs)
        technology_categories: Category slugs to filter
            (e.g. ["gen-ai", "mlops"]; see list above)
        query: Advanced query string (alternative to
            the filter params above)
        since: Only data since this date (YYYY-MM-DD)
    

Inputs:
- `organization` (string, required)
- `reason` (string, required)
- `technologies` (unknown)
- `technology_categories` (unknown)
- `query` (unknown)
- `since` (unknown)

### `GetAccountInformation`

Check your API key and account status.

    Returns validation status, credits remaining, and
    plan info if available. Free (no credits used).

    Args:
        reason: Why you are calling this tool.
    

Inputs:
- `reason` (string, required)

### `GetMyCompanyProfile`

Get your company's profile and target account intelligence profile.

    Returns the intelligence profile for your company, designed to
    help you understand how to position and break into accounts.
    Use this data to craft targeted outreach and prioritize efforts.

    The response includes:

    - company_summary: Who your company is, what you sell, what
      problems you solve, your sales plays, and reference customers
      you can cite.

    - technologies: Your competitive landscape. Includes your own
      technology, modern and legacy competitors, and complementary
      tools in your ecosystem. Each technology has a tier (key or
      other) indicating its importance.

    - tech_concepts: Abstract technology themes relevant to your
      company (e.g., SIEM, ETL, CI/CD).

    - job_functions: The personas and roles your company targets,
      split by importance (key vs other).

    - projects: The types of initiatives and projects happening at
      target accounts that are relevant to your offering, split by
      importance (key vs other).

    This is a free call. Once you get it, keep this information handy
    and refer it often to guide your outreach and account strategy.

    Args:
        reason: Why you are calling this tool.
    

Inputs:
- `reason` (string, required)

### `GetOrganizationList`

Get one organization list and its organizations.

    Fetch a list by id after calling list_organization_lists. Share the url with the user.

    Costs 1 credit per returned item. If you get a 402 error,
    the user needs more credits. Direct them to
    https://sumble.com/account/purchase

    Args:
        reason: Why you are calling this tool.
    

Inputs:
- `list_id` (integer, required)
- `reason` (string, required)

### `ListOrganizationLists`

List the user's organization lists.

    Returns concise metadata for each list: id, name, type,
    and organizations_count. Use get_organization_list after this to
    retrieve one list's organizations. Share the list urls with the user so they can view
    them in the dashboard.

    Each list has a type: "group" or "user". A "group" list is
    the user's territory — synced from their employer's CRM or
    territory management system. When a user asks about "my
    territory" or "my accounts", prefer the group list.

    Costs 1 credit per returned list. If you get a 402 error,
    the user needs more credits. Direct them to
    https://sumble.com/account/purchase

    Args:
        reason: Why you are calling this tool.
    

Inputs:
- `reason` (string, required)

### `MatchOrganizations`

Match a list of organizations to Sumble's database.

    Given organization names and/or URLs, finds the
    matching Sumble organization for each. Useful for
    resolving external company lists to Sumble IDs before
    adding them to an organization list.

    Costs 1 credit per matched organization. If you get
    a 402 error, the user needs more credits. Direct them
    to https://sumble.com/account/purchase

    Each organization dict must have at least one of
    `name` or `url`. The `location` field is optional
    but improves matching accuracy.

    Args:
        reason: Why you are calling this tool.
        organizations: List of dicts, each with keys:
            - name: Organization name (optional)
            - url: Website URL or domain (optional)
            - location: Country name or code (optional)
            At least `name` or `url` is required per org.
            Max 1000 organizations per call.
    

Inputs:
- `reason` (string, required)
- `organizations` (array, required)

## Example Requests

- "Create a new organizations to list with <reason>."
- "Create a new organization list with <reason>."
- "Find enrich organizations for <organization>."
- "Look up an account information with <reason>."
- "Look up a my company profile with <reason>."
- "Look up an organization list using <list_id>."
- "List organization lists with <reason>."
- "Find match organizations with <reason>."

## Usage

- Pick the most specific tool in this skill for the user request.
- Gather required inputs before calling a tool.
- Summarize the returned data clearly instead of dumping raw JSON unless the user asks for it.
<!-- pluxx:generated:end -->

## Custom Notes

<!-- pluxx:custom:start -->
Add custom guidance, examples, or caveats here. This section is preserved across `pluxx sync --from-mcp`.
<!-- pluxx:custom:end -->
