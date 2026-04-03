---
name: enrich-person
description: Find verified work email, job title, LinkedIn URL, mobile number, and employment history for a specific person. Use when looking up someone's contact info, finding an email address, or researching a prospect.
---

# Enrich Person

Use the `prospeo_enrich_person` tool to get verified contact information for a person.

## When to Use

- "Find the email for Sarah Park at Mosaic"
- "Get me contact info for the VP of Engineering at Stripe"
- "Look up John Smith's LinkedIn and work email"

## How to Use

Call `prospeo_enrich_person` with either:
- A LinkedIn URL: `{ "linkedin_url": "https://linkedin.com/in/sarahpark" }`
- A name + company: `{ "first_name": "Sarah", "last_name": "Park", "company_name": "Mosaic" }`

## What You Get Back

- Verified work email (98% accuracy)
- Job title and department
- LinkedIn profile URL
- Mobile number (costs 10 credits)
- Employment history
- Company details

## Cost

1 credit per enrichment. Mobile number adds 10 credits.
