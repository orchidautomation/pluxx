# Codex installed-plugin inventory fixture

Captured from `codex-cli 0.149.1` on 2026-09-06 using two synthetic local
marketplaces, a synthetic `collision-proof` plugin, and a temporary HOME,
CODEX_HOME, XDG_CONFIG_HOME, and cwd. Only filesystem paths were replaced with
`/synthetic` identities. No active user configuration or credentials were used.

`codex plugin list --json` returned both installed/enabled rows. SHA-256 snapshots
of fixture config, catalogs, plugin sources, and plugin caches were identical
before and after listing. This proves the sampled schema and read-only behavior
for that isolated CLI invocation, not runtime discovery or every Codex version.
