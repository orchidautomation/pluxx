# Sumble Example

This document tracks the public Sumble example for Pluxx.

## Purpose

Show a real remote MCP import with:

- workflow grouping
- generated source files
- observed core-four build output
- explicit caveats around hooks and Codex parity

## Source

- MCP: `https://mcp.sumble.com`
- auth: bearer token via `SUMBLE_API_KEY`
- targets: `claude-code,cursor,codex,opencode`
- grouping: `workflow`
- hooks: `safe`

## Public Docs Page

- `/site/examples/sumble-proof-run.mdx`

## Notes For Public Wording

- write it as a normal product example, not an internal proof memo
- include the real tree and the observed output paths
- acknowledge both warnings directly
- explain that Codex's caveat is about hook packaging parity, not overall build failure
