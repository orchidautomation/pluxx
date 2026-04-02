# Naming Brainstorm

## Current: plugahh
- Pros: Memorable, playful, available on npm/GitHub
- Cons: Hard to spell, doesn't communicate what it does, might not be taken seriously by enterprise

## Candidates

### Category: Direct / Descriptive
| Name | npm | .com | Vibe |
|------|:---:|:----:|------|
| **plugsmith** | ? | ? | Craftsman who forges plugins. Professional. |
| **plugforge** | ? | ? | Same energy as plugsmith. More powerful. |
| **agentpack** | ? | ? | Pack(age) for agents. Clear. |
| **skillpack** | ? | ? | Packs skills into plugins. Could confuse with skills-only tools. |
| **plugkit** | ? | ? | Kit for building plugins. Clean, short. |
| **multiплуг** | no | no | lol never mind |

### Category: Abstract / Brandable
| Name | npm | .com | Vibe |
|------|:---:|:----:|------|
| **socket** | taken | taken | Plugs go into sockets. Too generic. |
| **prong** | ? | ? | The metal bits on a plug. Weird but memorable. |
| **outlet** | taken | taken | Where plugs go. Too generic. |
| **adaptr** | ? | ? | Adapts plugins across platforms. Missing vowel trend. |
| **xplug** | ? | ? | Cross-platform plug. Short. |
| **omniplug** | ? | ? | All-platform plug. Sounds like hardware. |

### Category: Clever / Punny
| Name | npm | .com | Vibe |
|------|:---:|:----:|------|
| **plugahh** | avail | ? | Current. Playful. "Plug ahh" = eureka moment. |
| **plug-n-play** | taken | taken | Perfect meaning but too generic/taken. |
| **replug** | ? | ? | Re-plug your plugin everywhere. |
| **unplug** | taken | taken | Ironic. Bad idea. |
| **plugd** | ? | ? | "Plugged" = connected. Short. |

### Category: Premium / Enterprise-Ready
| Name | npm | .com | Vibe |
|------|:---:|:----:|------|
| **shipkit** | ? | ? | Ship your plugins. Action-oriented. |
| **crossplug** | ? | ? | Cross-platform plugins. Descriptive. |
| **agentforge** | ? | ? | Forge agent integrations. Premium feel. |
| **plugstudio** | ? | ? | Studio for building plugins. |
| **portplug** | ? | ? | Portable plugins. |

## My Top 5 Recommendations

1. **plugahh** — Keep it. It's memorable, available, and you've already shipped with it. Rename later if needed (see: Vercel was ZEIT, Bun was "Zig's package manager").

2. **shipkit** — "Ship your plugins everywhere." Action-oriented, professional, easy to spell. `npx shipkit build`. shipkit.dev.

3. **plugforge** — "Forge plugins for every platform." Strong imagery. `npx plugforge build`. plugforge.dev.

4. **agentpack** — "Pack your agent plugins." Clear category signal. `npx agentpack build`. agentpack.dev.

5. **xplug** — Short, cross-platform signal. `npx xplug build`. xplug.dev.

## Decision Framework

If targeting **indie devs + open source**: Keep plugahh. Fun > professional.
If targeting **enterprise + SaaS companies**: Rename to shipkit or plugforge. Professional > fun.
If targeting **both** (open core model): Start with plugahh, rename to something professional when you launch the paid tier.

## Action: Check Availability
```bash
# npm
npm view plugahh
npm view shipkit
npm view plugforge
npm view agentpack
npm view xplug

# domains
whois shipkit.dev
whois plugforge.dev
whois agentpack.dev
whois xplug.dev
```
