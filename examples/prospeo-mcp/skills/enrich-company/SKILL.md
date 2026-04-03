---
name: enrich-company
description: Get detailed company information including industry, funding, tech stack, headcount, revenue, and domain. Use when researching a target account, qualifying a lead, or analyzing a company before outreach.
---

# Enrich Company

Use the `prospeo_enrich_company` tool to get detailed company intelligence.

## When to Use

- "Get the tech stack and funding info for stripe.com"
- "What's the headcount and revenue for Notion?"
- "Research Figma — industry, funding stage, technologies"

## How to Use

Call `prospeo_enrich_company` with a domain:
`{ "domain": "stripe.com" }`

## What You Get Back

- Company name and description
- Industry and sub-industry
- Headcount and revenue range
- Funding stage and total raised
- Technology stack
- Location and founded year
- Social profiles

## Cost

1 credit per enrichment.
