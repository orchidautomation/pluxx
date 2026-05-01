# Authenticated Control Path

This example deliberately separates:

- read-only investigation and planning
- authenticated mutation work

The mutation lane is not considered ready just because metrics, logs, or tickets are readable.

Before merge, publish, change-window open, or rollback work, require:

- runtime bootstrap success
- fresh policy cache
- a service-health snapshot
- explicit human approval for the risky action

That is the main enterprise behavior this example is meant to pressure.
