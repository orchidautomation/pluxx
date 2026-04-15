# Pricing And Packaging

## Pricing Redo

The earlier instinct to use low-end SaaS tiers like `$49 / $199 / $499` is probably wrong for this product.

That pricing shape assumes:

- solo users will pay monthly for convenience
- analytics is a strong enough paid wedge on its own
- the buyer is a typical self-serve prosumer

Those assumptions are weak for Pluxx.

The stronger buyer is a team shipping or governing official plugins across multiple agent ecosystems.

## Packaging Principles

Pricing should follow these rules:

- keep the local CLI and core authoring loop free
- charge for team coordination, governance, release confidence, and hosted operations
- avoid usage pricing on local workflows
- optimize for high-value team buyers, not hobbyist extraction

## Proposed Plans

### OSS Core

Price:

- `$0`

Who it is for:

- solo developers
- hobbyists
- early MCP builders
- teams evaluating the workflow

Includes:

- local authoring
- `init`, `sync`, `doctor`, `lint`, `test`, `build`, `install`, `autopilot`
- local source-project maintenance

### Team

Price:

- `$299 / month`

Who it is for:

- small teams with shared plugin operations

Includes:

- hosted registry
- release history
- basic publish flows
- basic analytics
- shared team access
- enough seats for a small working group

### Vendor

Price:

- `$999 / month`

Who it is for:

- MCP companies shipping official plugins
- devtools companies supporting multiple agent ecosystems

Includes:

- everything in Team
- multi-platform publish pipeline
- compatibility verification
- signed releases
- advanced analytics
- priority support

### Enterprise

Price:

- starts at `$25k / year`

Who it is for:

- internal platform teams
- larger vendors
- companies with governance and compliance needs

Includes:

- SSO
- SCIM
- audit logs
- approval workflows
- org policy and allowlists
- private catalogs
- support and SLA expectations

## Metering

Pluxx should primarily meter on:

- number of managed plugins
- team or org capabilities
- support tier

Pluxx should not meter on:

- build count
- sync count
- model usage
- token usage
- raw CLI activity

## Service SKU

There should likely be a near-term service offer before the hosted product is fully mature.

Suggested service:

- `Official Plugin Launch Pack`
- `$5k - $15k` one-time

Possible scope:

- take one MCP to an official multi-agent plugin setup
- harden validation and release flow
- package documentation and setup guidance
- prepare the account for an eventual recurring hosted plan

## Launch Sequence

Recommended order:

1. keep OSS generous
2. sell design partner engagements first
3. use those engagements to identify the minimum viable hosted control-plane surface
4. launch Team and Vendor plans after real partner feedback

## Summary

The best packaging shape is:

- free local authoring
- paid team operations
- paid vendor distribution
- enterprise governance
