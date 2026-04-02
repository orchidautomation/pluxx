# Business Model

## Strategy: Open Core
Open-source the CLI + SDK. Monetize the cloud platform.

## Revenue Model

### Free Tier (MIT Open Source)
- `plugahh init` / `build` / `validate`
- All 4 generators (Claude Code, Cursor, Codex, OpenCode)
- Full Zod schema + TypeScript types
- `plugahh install` (local symlinks for testing)
- Unlimited local builds
- Community Discord support

### Starter — $49/mo
- `plugahh publish` — one-click publish to all platform marketplaces
- Plugin analytics dashboard (installs, usage, errors per platform per day)
- Up to 3 plugins
- Email support

### Pro — $199/mo
- Everything in Starter
- Unlimited plugins
- CI/CD GitHub Action (push → build → publish automatically)
- Team workspace (5 seats)
- Private plugin registry
- Approval workflows for publishing
- Version pinning + rollback
- Priority support

### Enterprise — $499/mo
- Everything in Pro
- Unlimited seats
- SSO / SCIM
- Audit logs
- Custom generators (Windsurf, Zed, JetBrains, etc.)
- SLA + dedicated support
- On-prem registry option

## Pricing Rationale
- $49/mo anchored against Speakeasy ($250/mo) and Stainless ($250/mo) — 5x cheaper
- $199/mo for teams matches Cursor Pro ($40/seat × 5 = $200/mo range)
- Enterprise at $499/mo is a rounding error for companies paying $10K+/yr on dev tools

## Revenue Projections (Conservative)

| Milestone | Stars | Active Users | Paying | MRR | ARR |
|-----------|-------|-------------|--------|-----|-----|
| Month 3 | 500 | 100 | 5 | $245 | $2.9K |
| Month 6 | 2,000 | 400 | 20 | $2K | $24K |
| Month 12 | 5,000 | 1,000 | 50 | $7K | $84K |
| Month 18 | 10,000 | 2,000 | 100 + 5 enterprise | $17K | $200K |

## Key Metrics to Track
- GitHub stars (vanity but signals momentum)
- `npx plugahh build` executions (telemetry, opt-in)
- Plugins generated per platform (which platforms matter most)
- Free → Starter conversion rate (target: 5%)
- Starter → Pro upgrade rate (target: 20%)
- Monthly churn (target: < 5%)

## Flywheel
```
Developer builds plugin with plugahh (free)
    → Publishes to Cursor + Claude Code marketplaces
        → Plugin users see "Built with plugahh" attribution
            → More developers discover plugahh
                → More plugins built → more marketplace presence
                    → Enterprise teams adopt for consistency
```
