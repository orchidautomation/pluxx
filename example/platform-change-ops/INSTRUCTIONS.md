## Platform Change Ops

Use Platform Change Ops when the user is handling an incident, a release-risk review, a policy-sensitive rollout, or a rollback.

This example is intentionally the most demanding reference plugin in the repo. It is meant to pressure:

- multiple MCP servers
- a bundled local stdio runtime
- runtime readiness
- policy-aware hooks
- explicit permissions
- delegated agents
- host-honest command degradation

## Operating Model

Always work in this order unless the user explicitly changes it:

1. investigate
2. plan
3. execute
4. communicate
5. verify

Do not jump directly to mutation work because a rollout or publish looks routine.

## Read Lane Vs Write Lane

This plugin has two distinct lanes:

- read lane
  - inspect PRs
  - inspect change tickets
  - inspect metrics, logs, incidents, and runbooks
  - draft plans and stakeholder updates
- write lane
  - merge or gate release changes
  - mutate issue state
  - send stakeholder updates
  - open change windows
  - record audit events

Treat write-lane work as approval-sensitive. If context is missing, stop and explain which approval or evidence is absent.

## Routing

- use `/intake-change-request [system-or-ticket]` to orient a new change
- use `/inspect-change-surface [repo-or-service]` to map blast radius and current state
- use `/research-external-impact [vendor-or-dependency]` when outside docs or vendor changes might affect the rollout
- use `/review-risk-and-policy [change-id]` before any risky execution path
- use `/publish-docs-or-release [scope]` only when the user is explicitly at execution time
- use `/announce-rollout [audience]` for stakeholder messaging
- use `/rollback-change [release-or-change-id]` when the safest next step is reversal
- use `/verify-installed-state [host-or-plugin]` to prove the installed bundle and runtime path are still healthy

## Delegation

Use specialist agents when the work is naturally bounded:

- `@incident-commander` for the top-level control loop
- `@policy-auditor` for policy and approval checks
- `@external-research-scout` for vendor or dependency impact
- `@release-reviewer` for release and rollout evidence
- `@rollback-planner` when reversal planning is the main job
- `@comms-writer` for operator-safe stakeholder updates

## Runtime Expectations

The bundled runtime exists for policy sync, local state snapshots, risk scoring, and audit capture.

Use the bundled helper scripts when they reduce guesswork:

- `scripts/check-env.sh`
- `scripts/bootstrap-runtime.sh`
- `scripts/assert-change-window.sh`
- `scripts/risk-score.mjs`
- `scripts/record-audit-event.mjs`

Do not treat a green runtime bootstrap as approval to merge, publish, or rollback. Runtime health is necessary context, not human authorization.
