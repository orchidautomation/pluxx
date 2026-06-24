# Host Adapter Behavior Tests

Generated host bundles can have the right files while still failing the host-facing adapter contract. The adapter behavior tests focus on that boundary.

Adapter tests mean:

- the generated bundle exposes the host discovery surfaces Pluxx claims to emit
- startup instructions are delivered once where the host has a startup instruction surface
- skills are discoverable
- commands, agents, and MCP config are discoverable where the host supports them
- missing contract files fail with adapter-contract language before workflow content is evaluated

Adapter tests do not mean:

- a remote MCP server was called
- a real desktop or CLI host completed a workflow
- the plugin's product taxonomy, prompts, or content quality are correct
- user machine trust, review, feature flags, or tool allow settings are already configured

If an adapter test fails, treat it as a Pluxx generator or host-adapter regression. If adapter tests pass but a real workflow fails, debug the plugin product behavior, host setup, live runtime, or remote service separately.

## Expected Host Limitations

- Claude Code: bundle inspection can verify manifest, skills, commands, agents, MCP config, and startup hook files. It does not prove a live app run.
- Cursor: bundle inspection can verify manifest, rules, skills, commands, agents, hooks, and MCP config. It does not prove live Cursor Agent execution.
- Codex: canonical commands intentionally degrade to `AGENTS.md` routing plus `.codex/commands.generated.json`; this is expected behavior, not a product failure. Bundled hooks and MCP calls still depend on host trust, feature flags, review, and tool allow settings outside the generated bundle.
- OpenCode: adapter tests inspect the generated plugin wrapper constants and package entrypoint. They do not execute a live OpenCode host run.

