---
name: "hiring-signals"
description: "Use hiring activity and open roles as timing signals for outreach and research."
---

<!-- pluxx:generated:start -->
# Hiring Signals

Use hiring activity and open roles as timing signals for outreach and research.

## Tools In This Skill

### `FindJobs`

Find job listings matching a query.

    The `query` param supports a full filter language
    and lets you compose complex searches in ONE call
    (e.g. jobs in a user's org list matching specific
    technologies and job functions).

    Returns job posts with titles, organizations,
    locations, technologies, job functions, teams,
    projects, and URLs. Does not include job
    descriptions by default. Use GetJobDescription
    to get the full description for a specific job.

    If results include URLs or links, always share them
    with the user.

    Costs 2 credits per job returned. If you get a 402
    error, the user needs more credits. Direct them to
    https://sumble.com/account/purchase

    QUERY SYNTAX (use `query` param):
    Operators: EQ, NEQ, IN, NOT IN.
    Combine with AND, OR. Group with parentheses.
    Values are single-quoted. IN/NOT IN use
    comma-separated values in parens.

    Available fields:

    ORGANIZATION / SCOPE FIELDS — filter which orgs
    to search jobs within:
    - organizations_list — EQ/IN. Restrict to a
      user's saved org list by numeric list ID.
      Use ListOrganizationLists to get IDs first.
      Use 'default' for the user's default list.
      Example: organizations_list EQ '42'
    - organization — EQ only. Fuzzy org name/URL.
    - industry — EQ/IN/NOT IN.
    - employee_count — EQ/IN. Range format:
      '100-1000', '1000-' (1000+), '-500'.
    - hq_location — EQ/IN/NEQ. Format:
      'US', 'US:Texas', 'US:Texas:Austin'.
      Region codes: EMEA, APAC, NAMER, LATAM.
    - tag — EQ/IN (e.g. 'digital_native').

    JOB FIELDS — filter which jobs to return:
    - technology — EQ/IN/NOT IN. Use slugs from
      SearchTechnologies.
    - technology_category — EQ/IN/NOT IN (e.g.
      'gen-ai', 'mlops', 'cybersecurity').
    - project — EQ/IN. Filter by project slug.
      Example: project IN ('cloud-migration',
      'gen-ai-initiative')
    - job_function — EQ/IN/NOT IN (e.g.
      'Machine Learning', 'Data Scientist',
      'Engineer', 'Product Manager').
    - job_level — EQ/IN/NOT IN (e.g.
      'Senior', 'Manager', 'VP', 'Director').
    - country — EQ/IN/NOT IN. Format:
      'US', 'US:California',
      'US:California:San Francisco'.
      Use full state names, not abbreviations.
      'UK' is auto-converted to 'GB'.
    - hiring_period — EQ ONLY (not IN/NOT IN).
      Values: '2wk', '1mo', '3mo', '6mo',
      '1yr', '18mo', '2yr'.
    - NOTE: job_title and job_description are NOT
      available as filters. Use job_function and
      job_level.

    COMBINING FILTERS:
    Use AND to combine org fields with job fields.
    Do NOT use OR across org and job fields.

    Examples:
    - Jobs in a user's org list with specific tech:
      organizations_list EQ '42'
      AND technology IN ('snowflake', 'databricks')
    - Jobs in default list, ML roles, recent:
      organizations_list EQ 'default'
      AND job_function EQ 'Machine Learning'
      AND hiring_period EQ '3mo'
    - Jobs at large US companies using PyTorch:
      technology EQ 'pytorch'
      AND hq_location EQ 'US'
      AND employee_count EQ '1000-'
    - Jobs matching a project and function:
      project EQ 'cloud-migration'
      AND job_function IN ('Cloud Engineer',
      'DevOps Engineer')
    - Basic tech + location:
      technology IN ('pytorch', 'tensorflow')
      AND country EQ 'US'
    - Function + level:
      job_function IN ('Machine Learning',
      'AI Engineer') AND job_level EQ 'Senior'

    Args:
        reason: Why you are calling this tool.
        query: Advanced query string.
            See QUERY SYNTAX.
        organization: Domain, numeric ID, or slug
            (e.g. "google.com", "1726684", "google").
            Alternatively use `organization` field in
            query.
        limit: Max results (1-100, default 10)
        offset: Skip N results (default 0)
    

Inputs:
- `reason` (string, required)
- `query` (unknown)
- `organization` (unknown)
- `limit` (integer)
- `offset` (integer)

### `GetJobDescription`

Get the full description for a job listing.

    Returns the job title and full description text.
    Use this after find_jobs when you need the complete,
    untruncated description for a specific job.

    Costs 1 credit. If you get a 402 error, the user
    needs more credits. Direct them to
    https://sumble.com/account/purchase

    Args:
        reason: Why you are calling this tool.
        job_id: The job post ID.
    

Inputs:
- `reason` (string, required)
- `job_id` (integer, required)

## Example Requests

- "Find jobs with <reason>."
- "Look up a job description with <reason>."

## Usage

- Pick the most specific tool in this skill for the user request.
- Gather required inputs before calling a tool.
- Summarize the returned data clearly instead of dumping raw JSON unless the user asks for it.
<!-- pluxx:generated:end -->

## Custom Notes

<!-- pluxx:custom:start -->
Add custom guidance, examples, or caveats here. This section is preserved across `pluxx sync --from-mcp`.
<!-- pluxx:custom:end -->
