---
name: "technographics"
description: "Search for technologies by name."
---

<!-- pluxx:generated:start -->
# Technographics

Research technologies, tools, and stack adoption across target accounts.

## Tools In This Skill

### `SearchTechnologies`

Search for technologies by name.

    Returns technology slug, name, and mention count.
    Use this first to find valid technology slugs for
    the `technologies` parameter in find_organizations,
    enrich_organization, find_jobs, and find_people.
    The returned slugs can also be used in advanced
    queries with `technology IN ('slug1', 'slug2')`.

    Costs 1 credit per search. If you get a 402 error,
    the user needs more credits. Direct them to
    https://sumble.com/account/purchase

    Args:
        query: Search term (e.g. "react", "kubernetes",
            "snowflake", "pytorch")
        reason: Why you are calling this tool.
    

Inputs:
- `query` (string, required)
- `reason` (string, required)

## Example Requests

- "Search technologies matching <query>."

## Usage

- Pick the most specific tool in this skill for the user request.
- Gather required inputs before calling a tool.
- Summarize the returned data clearly instead of dumping raw JSON unless the user asks for it.
<!-- pluxx:generated:end -->

## Custom Notes

<!-- pluxx:custom:start -->
Add custom guidance, examples, or caveats here. This section is preserved across `pluxx sync --from-mcp`.
<!-- pluxx:custom:end -->
