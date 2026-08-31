# PLUXX-309 Codex CLI translation proof refresh

Date: 2026-08-31  
Source: `0c7aede7178e722f2255e65d727ecf9048fd53b4`  
Host: Codex CLI `0.148.0`

## Boundary

This is isolated, authenticated Codex CLI proof in temporary `CODEX_HOME` and project directories. The probe copied the existing authentication file into each temporary home but recorded no credential material. It did not mutate the active Codex home. This is Codex evidence only; it does not claim Cursor runtime behavior.

## Results

| Scenario | Observed result |
|---|---|
| project skill discovery | delegated response `SKILL_PROOF_TOKEN_PROJECT_DISCOVERY` |
| parent `[[skills.config]] enabled = false` | discovered skill still responded `SKILL_PROOF_TOKEN_DISABLED_IGNORED` |
| agent-local undiscovered skill path | response remained `SKILL_PROOF_MISSING` |
| project root MCP without tool approval | startup and `tools/list`; `mcp_tool_call` failed because approval policy was `never`; no server-side `tools/call` |
| project root MCP with per-tool approval | server-side `tools/call`; `MCP_PROOF_MARKER_ALLOWED` |
| agent-local inline MCP without approval | no server-side `tools/call`; `MCP_PROOF_MARKER_MISSING` |
| agent-local inline MCP with per-tool approval | server-side `tools/call`; `MCP_PROOF_MARKER_ALLOWED` |
| approved project MCP inherited by a custom agent | server-side `tools/call`; `MCP_PROOF_MARKER_ALLOWED` |
| child `mcp_servers = {}` with approved inherited project MCP | did not opt out; server-side `tools/call`; `MCP_PROOF_MARKER_ALLOWED` |
| user root MCP with per-tool approval | server-side `tools/call`; `MCP_PROOF_MARKER_ALLOWED` |
| approved user MCP inherited by a custom agent, including `mcp_servers = {}` | server-side `tools/call`; `MCP_PROOF_MARKER_ALLOWED` |

## Codex 0.148 event-stream delta

Delegated runs completed with a `wait` collaboration item and a proof-bearing final `agent_message`, but the JSON stream omitted the earlier `spawn_agent` item and child thread id. `--output-last-message` also remained empty for these completed runs. The probe runner now keeps the last-message file as primary and falls back to the final completed JSONL `agent_message`; custom-agent classification accepts the honest `wait` plus proof-bearing delegated message without inventing spawn metadata.

## Product delta

The stable `skills.config` caveats remain unchanged. The previous claim that approved agent-local inline MCP did not activate is obsolete on Codex CLI 0.148.0: explicit per-tool approval now activates it. Unapproved inline MCP remains unavailable, and `mcp_servers = {}` remains ineffective as an inherited-root opt-out.

Raw JSON was retained only in local `/tmp/pluxx-309-*.json` proof files because it contains machine-local paths. The maintained harness and regression fixtures encode the non-sensitive behavioral contract.
