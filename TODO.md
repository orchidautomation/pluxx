# pluxx — TODO

## Immediate (Next Session)

- [ ] `npm login` + `npm publish` and verify the Bun runtime launcher on a clean machine
- [ ] Update Codex CLI (`npm install -g @openai/codex`) and run review
- [ ] Custom domain for landing page (pluxx.dev)
- [ ] Write launch blog post: "I built one config that generates AI agent plugins for 11 platforms"
- [ ] Post to HN (Show HN), r/ClaudeAI, r/cursor, r/OpenAI
- [ ] Tweet thread with terminal demo GIF
- [ ] Share in Claude Code Discord, Cursor Discord, OpenCode Discord

## Polish Before Launch

- [ ] Add more tests (migrate command, new generators, init flow)
- [ ] Fix help text to list all 11 platforms (currently only shows 4)
- [ ] Update README to reflect 11 generators (currently says 7)
- [ ] Add CONTRIBUTING.md
- [ ] Create Discord server
- [ ] Record 2-minute demo video (terminal recording: init → build → install → validate)

## Features — Phase 2

- [ ] `pluxx diff` — show what changed per platform since last build
- [ ] `pluxx publish` — push to Cursor marketplace, npm (OpenCode), Codex marketplace
- [ ] `pluxx lint` — validate skills + plugin against all platform rules:
  - SKILL.md description max 1024 chars (Agent Skills spec, Codex enforces this)
  - SKILL.md description max 250 chars displayed (Claude Code truncates)
  - SKILL.md name must match directory name (Cursor requires this)
  - SKILL.md name: lowercase, hyphens only, max 64 chars
  - YAML frontmatter values with special chars must be quoted (caught by claude plugin validate)
  - MCP URLs must be valid
  - Hook commands must reference existing scripts
  - Brand color must be valid hex
  - Codex: max 3 default prompts, 128 chars each
  - Warn on missing description, missing author, missing license
- [ ] Platform detection (auto-detect which tools are installed, only install to those)
- [ ] YAML config support (`pluxx.config.yaml`)

## Features — Phase 3

- [ ] CI/CD GitHub Action (push → build → publish)
- [ ] `pluxx test` — dry-run skills, validate MCP connections
- [ ] Template library (starter templates for common plugin types: MCP wrapper, linting, devtools)
- [ ] Plugin testing framework
- [ ] Additional generators: Kimi CLI, OpenClaw, Qwen Code, Kilo Code

## Business — Paid Tier (pluxx.dev)

- [ ] Landing page on custom domain (pluxx.dev)
- [ ] Waitlist for cloud features
- [ ] Analytics dashboard MVP (installs per platform per day)
- [ ] `pluxx publish` cloud service (one-click to all marketplaces)
- [ ] Team plugin registries
- [ ] Stripe integration for $49/$199/$499 tiers

## Content Calendar

| Week | Content | Channel |
|------|---------|---------|
| 1 | "One config, 11 platforms" blog post | Blog, HN, Reddit |
| 1 | Demo GIF/video | Twitter, Discord |
| 2 | "How Claude Code vs Cursor vs Codex plugins differ" deep dive | Blog |
| 3 | "Building an MCP plugin in 5 minutes with pluxx" tutorial | Blog, YouTube |
| 4 | "The Agent Skills standard explained" | Blog |
| 5 | "Why every SaaS needs AI agent plugins" (thought leadership) | Blog, LinkedIn |

## Research / Open Questions

- [ ] Should we rename before launch? (pluxx vs plugforge vs plugsmith — all available on npm)
- [ ] Vercel or Cloudflare Pages for the landing page?
- [ ] Mintlify for docs? (Ultracite uses it)
- [ ] Should `pluxx migrate` support importing from Cursor marketplace plugins?
- [ ] MCP server generation as a future product? (OpenAPI → MCP server → plugin)

## Done (Session 1 — April 2, 2026)

- [x] Core SDK — schema, config loader, definePlugin()
- [x] 11 generators: Claude Code, Cursor, Codex, OpenCode, GitHub Copilot, OpenHands, Warp, Gemini CLI, Roo Code, Cline, AMP
- [x] CLI: build, validate, init (interactive), install, uninstall, dev (watch), migrate, help
- [x] 6 tests passing, TypeScript compiles clean
- [x] Real-world example: Megamind → 85 files across 11 platforms
- [x] `claude plugin validate` PASSED on generated output
- [x] Landing page designed and deployed to Vercel
- [x] npm package prepped (name available, LICENSE, package.json ready)
- [x] GTM: 9 strategy docs (positioning, pricing, competitors, launch plan, naming, Ultracite teardown, agent matrix, monetization, honest assessment)
- [x] GitHub repo public at orchidautomation/pluxx
- [x] RESEARCH.md — deep cross-platform feature map (40 agents analyzed)
- [x] PLAN.md — full architecture and phased roadmap
