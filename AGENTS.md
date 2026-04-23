# AGENTS

## Start Here

If you are new to the repo, read these first:

1. [docs/start-here.md](./docs/start-here.md)
2. [docs/todo/queue.md](./docs/todo/queue.md)
3. [docs/todo/master-backlog.md](./docs/todo/master-backlog.md)
4. [docs/roadmap.md](./docs/roadmap.md)

Use [Linear](https://linear.app/orchid-automation) for ticket-level detail and execution state.

## Docs Maintenance Rule

When editing a doc that contains a `Doc Links` block:

1. read the files listed under `Related`
2. update any files listed under `Update together` if the change affects them
3. keep the high-level story aligned across:
   - one maintained plugin source
   - four native destinations
   - OSS authoring substrate first
   - later trust / distribution layer second

## Docs And Linear Sync Rule

If a change affects any of these:

- product truth
- what is shipped vs not shipped
- proof state
- priority order
- host compatibility or lifecycle truth
- release readiness

then update the relevant repo docs and the relevant Linear issue or project in the same work block.

Minimum repo-doc surfaces to consider:

- [docs/start-here.md](./docs/start-here.md)
- [docs/todo/queue.md](./docs/todo/queue.md)
- [docs/todo/master-backlog.md](./docs/todo/master-backlog.md)
- [docs/roadmap.md](./docs/roadmap.md)

If the change is narrower than that, update only the specific source-of-truth doc it affects.

## Canonical Planning Files

The canonical planning docs now live in `docs/todo/`:

- [docs/todo/queue.md](./docs/todo/queue.md)
- [docs/todo/master-backlog.md](./docs/todo/master-backlog.md)

Legacy compatibility shims remain at:

- [TODO.md](./TODO.md)
- [docs/master-backlog.md](./docs/master-backlog.md)

Edit the canonical files, not the shims.

## Public vs Private Material

Keep public repo docs focused on product, proof, and execution.

Do not store account-specific GTM notes, named prospect research, or private outreach planning in the public repo.
