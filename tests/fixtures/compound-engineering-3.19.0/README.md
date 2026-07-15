# Compound Engineering 3.19.0 migration fixture

Bounded manifest fixture distilled from `EveryInc/compound-engineering-plugin` commit `f871e4b4308f5a175b38ccada51d80dd67bab4fc`.

The Claude manifest exposes website branding without a display name, while the Codex manifest carries the required display name and richer interface metadata. The Cursor manifest carries a host-specific keyword catalog. This reproduces the mature multi-manifest intake defect without vendoring the upstream plugin.
