---
name: "general-research"
description: "Handle broad search and query workflows when there is not a more specific product surface match."
---

<!-- pluxx:generated:start -->
# General Research

Handle broad search and query workflows when there is not a more specific product surface match.

## Tools In This Skill

### `FindOrganizations`

Find organizations using specific technologies.

    Search by technology names and/or categories, or use
    an advanced query string. At least one of technologies,
    technology_categories, or query is required.

    If results include URLs or links, always share them
    with the user.

    Costs 5 credits per result returned. If you need
    entity details (job_post_count, people_count,
    team_count, job_post_used_count, team_count_used),
    set include_entity_details=True — this costs 5
    credits per technology term instead. IMPORTANT:
    Always ask the user for confirmation before using
    include_entity_details=True, as it is significantly
    more expensive.

    If you get a 402 error, the user needs more credits.
    Direct them to https://sumble.com/account/purchase

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
    - organization — EQ only. Fuzzy name/URL match.
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

    IMPORTANT: Do NOT combine org filters with job
    filters (job_function, job_level, country) using OR.

    Examples:
    - technology IN ('snowflake', 'databricks')
      AND employee_count EQ '1000-'
    - hq_location IN ('US:California', 'US:New York')
    - hq_location EQ 'EMEA'
    - technology EQ 'kubernetes'
      AND hq_location EQ 'US' AND
      employee_count EQ '1000-5000'
    - technology NOT IN ('java', 'dotnet')

    Args:
        reason: Why you are calling this tool.
        query: Advanced query string
        since: Only data since this date (YYYY-MM-DD)
        limit: Max results (1-200, default 10)
        offset: Skip N results (default 0)
        include_entity_details: Include job_post_count,
            people_count, team_count, etc. per tech.
            Much more expensive — ask user before using.
    

Inputs:
- `reason` (string, required)
- `technologies` (unknown)
- `technology_categories` (unknown)
- `query` (unknown)
- `since` (unknown)
- `limit` (integer)
- `offset` (integer)
- `include_entity_details` (boolean)

### `FindPeople`

Find people at an organization.

    Requires an `organization` param (domain, ID, or
    slug). Unlike FindJobs, this tool always searches
    within a single organization.

    The `query` param supports a full filter language
    and lets you compose complex searches in ONE call
    (e.g. people matching specific technologies, job
    functions, and levels).

    Returns people with job titles, functions, levels,
    locations, and LinkedIn URLs.

    If results include URLs or links, always share them
    with the user.

    Costs 1 credit per person returned. If you get a 402
    error, the user needs more credits. Direct them to
    https://sumble.com/account/purchase

    JOB FUNCTIONS (top-level categories with children):
    - Executive, Board of Directors
    - Engineering & R&D: Data Analyst, Statistician,
      Data Scientist, Machine Learning (incl. MLOps
      Engineer), AI Engineer, Researcher, Engineer
      (Software Engineer, Security Engineer, DevOps
      Engineer, Data Engineer, Site Reliability Engineer,
      Cloud Engineer, etc.), Applied Scientist, Scientist
    - Product & Design: Product Manager, Designer (UX,
      Visual, Brand, etc.)
    - Strategy & Operations: Analyst, Strategy, Operations
      (Program Manager, Procurement & Supply Chain)
    - Information Technology: IT Support, IT Security,
      Business Systems, etc.
    - Healthcare Services: Physician, Nurse, Pharmacist
    - Sales: Account Executive, SDR
    - Marketing: Product Marketing, Growth, Content,
      Digital Marketing
    - Customer Support, Customer Success, Solutions
    - Revenue Operations (GTM Engineer)
    - Business Development
    - General & Administrative: Finance (Accountant,
      Financial Analyst), Legal & Compliance, Human
      Resources, Administrator
    - Consultant, Government, Education, Journalist

    JOB LEVELS (highest to lowest rank):
    Board Member, CXO, EVP, CVP, SVP, RVP, AVP, VP,
    Executive Director, Senior Director, Director,
    General Manager, Head, Associate Director,
    Senior Manager, Manager, Principal, Lead, Senior,
    Individual Contributor

    QUERY SYNTAX (use `query` param):
    Operators: EQ, NEQ, IN, NOT IN.
    Combine with AND, OR. Group with parentheses.
    Values are single-quoted. IN/NOT IN use
    comma-separated values in parens.

    Available fields:
    - job_function — EQ/IN/NOT IN. Use values from
      the JOB FUNCTIONS list above.
    - job_level — EQ/IN/NOT IN. Use values from
      the JOB LEVELS list above.
    - country — EQ/IN/NOT IN. Format:
      'US', 'US:California',
      'US:California:San Francisco'.
      Use full state names, not abbreviations.
      'UK' is auto-converted to 'GB'.
    - technology — EQ/IN/NOT IN. Use slugs from
      SearchTechnologies.
    - since — EQ ONLY. ISO date format:
      '2023-01-01'. Returns people with data
      since that date.
    - hiring_period — EQ ONLY. Predefined buckets:
      '2wk', '1mo', '3mo', '6mo', '1yr', '18mo', '2yr'.
      Alternative to `since` for relative ranges.
    - person_name — EQ.
    - NOTE: job_title and job_description are NOT
      available as filters. Use job_function and
      job_level.

    Examples:
    - ML engineers in the US:
      job_function IN ('Machine Learning',
      'AI Engineer') AND job_level IN ('Senior',
      'Lead') AND country EQ 'US'
    - Data scientists in California:
      job_function EQ 'Data Scientist'
      AND country EQ 'US:California'
    - Senior PyTorch users:
      technology EQ 'pytorch'
      AND job_level EQ 'Senior'
    - Recent engineering hires:
      job_function EQ 'Engineer'
      AND since EQ '2026-01-01'
    - VPs in the UK:
      job_level EQ 'VP'
      AND country EQ 'UK'

    Args:
        organization: REQUIRED. Domain, numeric ID,
            or slug (e.g. "google.com", "1726684",
            "google")
        reason: Why you are calling this tool.
        query: Advanced query string.
            See QUERY SYNTAX.
        limit: Max results (1-250, default 10)
        offset: Skip N results (default 0)
    

Inputs:
- `organization` (string, required)
- `reason` (string, required)
- `query` (unknown)
- `limit` (integer)
- `offset` (integer)

### `Query`

Execute a read-only SQL query against the Sumble DuckDB.

    ⚠️ LAST RESORT — Only use this tool when the structured tools
    cannot answer the question. Prefer these tools first:
    - find_organizations: search/filter companies by name,
      industry, technology, location, size, etc.
    - enrich_organization: get detailed data for a specific org
      (technologies, job functions, teams, people, etc.)
    - find_jobs: search job postings by org, title, technology,
      job function, location, etc.
    - find_people: search people by org, title, job function,
      seniority, location, etc.
    - search_technologies: look up technologies by name/keyword.

    Only fall back to this raw SQL tool when you need queries
    those tools cannot express (e.g. custom aggregations, joins
    across tables, or columns not exposed by structured tools).

    When using this endpoint, let the user know that the data is not as reliable as the
    structured tools, since the underlying query is built by the LLM it may not be correct.
    The structured tools use curated queries to ensure higher data quality, while this
    raw SQL endpoint queries the underlying DuckDB directly without those safeguards.

    Args:
        sql: The read-only SQL query to execute.
        reason: A short explanation of what you are trying to
            find and why the structured tools cannot provide it.

    CORE TABLES:
    - organizations: id, parent_id, slug, name, linkedin_url,
      industry, headquarters_country, headquarters_state,
      headquarters_location, employee_count_int, jobs_count,
      teams_count, people_count, tags (list of slugs),
      founded, first_activity_time, last_activity_time,
      is_staffing_org, sic_code, sic_name, sic_division,
      sic_major_group, sic_industry_group,
      sic_confidence_score, naics_code, naics_sector,
      naics_subsector, naics_industry_group, naics_title,
      naics_confidence_score
    - denormalized_jobs: id, organization_id, title,
      datetime_pulled, job_function_id, country_code,
      location, job_functions (JSON), teams (JSON),
      projects (JSON)
    - people_info: organization_id, person_id, job_level_id,
      job_level, job_level_rank, job_function_id, name,
      current_title, location, country_id, linkedin_url,
      job_function_position, connections_count,
      current_experience_date_from

    REFERENCE TABLES:
    - technologies: id, slug, name, total_mentions,
      total_org_mentions, competitors, complements
    - technologies_by_slug: slug, id
    - technologies_slug_aliases: alias, slug
    - technology_categories: name, name_short, slug,
      tech_slug, tech_name
    - job_functions: id, name, slug, parent_id, total_mentions,
      total_org_mentions, total_jobs_count
    - job_levels: id, name, level_rank
    - countries: id, code, name
    - projects: id, name, slug, technologies, fts_keywords,
      exclude_industries, headcount_min, created_at,
      updated_at, is_active
    - teams: id, organization_id, parent_id, name, slug,
      hierarchy_id

    JUNCTION TABLES (for filtering jobs by attribute):
    - job_job_functions: id (=job post id), job_function_id
    - job_technologies: id (=job post id), technology_id
    - job_teams: id (=job post id), team_id
    - job_posts_job_levels: job_post_id, job_level_id
    - job_posts_projects: job_post_id, project_id,
      organization_id, label, explanation, sumble_url, excerpt

    ANALYTICS TABLES:
    - hiring_trends_tech: org_slug, tech_slug, tech_name,
      month, jobs_count, total_jobs_count, tech_rank

    TIPS:
    - JSON cols use DuckDB syntax: json_keys(), ->> operator
    - Join people to orgs: people_info.organization_id =
      organizations.id
    - Use list_tables to discover all tables and columns.
    - Read-only, 30s timeout, max 1,000 rows. Use LIMIT.
    - Costs 1 credit per 100 bytes of response data. If you get
      a 402 error, the user needs more credits. Direct them to
      https://sumble.com/account/purchase
    

Inputs:
- `sql` (string, required)
- `reason` (string, required)

## Example Requests

- "Find organizations with <reason>."
- "Find people for <organization>."
- "Query queries with <sql>."

## Usage

- Pick the most specific tool in this skill for the user request.
- Gather required inputs before calling a tool.
- Summarize the returned data clearly instead of dumping raw JSON unless the user asks for it.
<!-- pluxx:generated:end -->

## Custom Notes

<!-- pluxx:custom:start -->
Add custom guidance, examples, or caveats here. This section is preserved across `pluxx sync --from-mcp`.
<!-- pluxx:custom:end -->
