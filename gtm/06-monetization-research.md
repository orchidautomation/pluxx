# Monetization Research — Developer Tool Comps

## The Playbook: Open Source Core → Paid Cloud

Every successful dev tool company in the "define once, generate many" space follows this:

| Company | OSS Component | Paid Component | Pricing | ARR |
|---------|--------------|----------------|---------|-----|
| **Vercel** | Next.js (MIT) | Hosting platform | $20/seat/mo, Ent ~$45K/yr | $200M |
| **Speakeasy** | CLI (open) | SDK generation | $250/mo per SDK | Series A $15M |
| **Stainless** | Some SDK repos | Managed generation | $250-800/mo per SDK | ~$1M, raised $25M |
| **Fern** | CLI (MIT) | SDKs + docs hosting | $250/mo per SDK | Seed $4M |
| **Buf** | CLI (Apache 2.0) | Schema Registry | $1K + $5/type/mo | Raised $93M |
| **Prisma** | ORM (Apache 2.0) | Accelerate, Optimize | Usage-based $0.02-0.08/10K ops | Raised $56M |

## Key Patterns

1. **The CLI is never the product. The CLI is the acquisition channel.**
   - Vercel doesn't charge for Next.js
   - Buf doesn't charge for the buf CLI
   - Prisma doesn't charge for the ORM

2. **Per-project/per-SDK pricing** is standard in this space
   - Speakeasy: per SDK
   - Stainless: per SDK
   - Fern: per SDK
   - We should: per plugin (or per workspace)

3. **$250/mo is the anchor price** for "generate for many targets" tools
   - We undercut at $49/mo Starter to capture the long tail
   - Pro at $199/mo for teams is still cheaper than one Speakeasy SDK

4. **Usage-based components improve NRR by 20-40%**
   - Add overage billing on publish count, analytics events, or API calls
   - Example: $49/mo includes 3 plugins, $10/mo per additional plugin

5. **Freemium converts at ~5% for dev tools**
   - But free trial converts at 17% (people who try intend to buy)
   - Our free tier should be genuinely useful (unlimited local builds)
   - Paywall = publish + analytics + team features

## AI Agent Ecosystem Monetization (Emerging)

- 11,000+ MCP servers exist, <5% monetized
- 8M MCP downloads, 85% month-over-month growth
- Emerging models: per-call pricing, subscription bundles, marketplace commissions
- **Infrastructure plays** (auth, hosting, gateways) are where money is now
- Composio raised $29M for managed auth across 800+ tool integrations

## Conversion Benchmarks

| Metric | Benchmark | Our Target |
|--------|-----------|-----------|
| Free → Paid conversion | 5% median | 5% |
| Free trial → Paid | 17% median | N/A (freemium, not trial) |
| Monthly churn | 3-7% for dev tools | <5% |
| Net Revenue Retention | 110-130% for good tools | 120% |
| Time to convert | 30-90 days for platform tools | 60 days |
| Expansion revenue | 30% of revenue for top tools | 25% target |

## Sources
- Speakeasy, Stainless, Fern, Buf, Prisma pricing pages (April 2026)
- Sacra: Vercel revenue analysis
- ProductLed 2025: SaaS freemium benchmarks
- SaaStr: Developer tool pricing models
- MCP ecosystem reports (dev.to, various)
