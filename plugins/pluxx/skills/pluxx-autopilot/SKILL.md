---
name: pluxx-autopilot
description: Run the one-shot Pluxx import, refinement, and verification path.
---

# Pluxx Autopilot

Use this skill when the user wants the one-shot path instead of a manually staged import and refinement flow.

## Workflow

1. Identify the source and desired scope:
   - remote MCP URL
   - local stdio command
   - current working project
   - desired targets
2. Make the mode explicit:
   - `quick`
   - `standard`
   - `thorough`
3. Run the one-shot path:
   - `pluxx autopilot --from-mcp ... --yes`
   - include runner, mode, and review flags when they matter
   - use `pluxx autopilot --resume` for an interrupted compatible run
   - use `pluxx autopilot --rollback` when the user wants to abandon an interrupted run; rollback is local and does not require source or runner access
4. Summarize:
   - files created or updated
   - which agent passes ran
   - which verification checks ran
   - what still needs human follow-up

## Rules

- Do not present autopilot as magic. Explain what it actually ran.
- Keep auth flags explicit when the MCP requires them.
- Treat autopilot as a native-shaping pass, not just a file dump:
  - promote repeated entrypoints into commands when that is stronger than a flat skill list
  - promote isolated reviewer/research/delegated work into agents or subagents when the host supports that more naturally
  - keep argument-rich workflows argument-rich instead of flattening them into vague generic commands
- If the user is learning or debugging, suggest the manual lifecycle when autopilot hides too much.
- If autopilot fails mid-run, say which stage failed:
  - auth
  - introspection
  - baseline
  - runner
  - boundary
  - review
  - post-agent-verification
- Preserve Autopilot recovery metadata while resume or rollback is still needed, and do not publish its raw contents.
- Resume only a compatible saved run. If behavior-affecting inputs changed, stop and start a new run instead of weakening the fingerprint check.

## Output

- Explain what autopilot actually did.
- Call out what still needs human review.
- Make the next step obvious:
  - refine more
  - build/install
  - sync later
  - or ship
