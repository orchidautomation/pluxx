# Exa Query Patterns

Use Exa by describing the page you want to find, not by writing keyword soup.

## General Rules

- Prefer natural-language queries over boolean logic.
- Encode dates semantically after calculating them from the current date.
- Use category hints when they sharpen the query:
  - `category:company`
  - `category:people`
  - `category:news`
  - `category:research paper`

## When To Use Which Tool

- `web_search_exa`
  Best default for most discovery work.
- `web_search_advanced_exa`
  Use when you need stronger filters, domain control, highlights, or more structured search behavior.
- `web_fetch_exa`
  Use when the title and snippet are not enough to validate the result.

## Good Angle Splits

- builder vs practitioner vs critic
- official docs vs implementation examples vs migration notes
- primary announcement vs independent coverage vs reaction
