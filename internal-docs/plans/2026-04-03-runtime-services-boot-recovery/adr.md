# Runtime Services Boot Recovery — ADR

## Status

Accepted

## Context

ClawDev and the baseline both need to start, recover, and reuse long-lived runtime services attached to workspaces and runs.

The baseline uses a disk-backed local service supervisor as the primary registry for local runtime services.
ClawDev already models runtime services in the database through `workspaceRuntimeServices`, which gives a normalized and queryable source of truth for lifecycle, ownership, and cleanup.

During the backend comparison, one practical gap remained: startup recovery needed to account for services that were already alive in the local environment when the server restarted. ClawDev needed to preserve its DB-backed model while also adopting those live services so the operator experience stayed aligned with the baseline.

## Decision

Keep ClawDev's runtime services DB-backed as the canonical model, and add a local registry adoption layer during startup.

Concretely:

- Runtime services continue to be persisted in `workspaceRuntimeServices`.
- Startup reconciliation still scans persisted runtime rows and reconciles them into the in-memory runtime service map.
- Startup also consults a local runtime-service registry to adopt live local processes when they already exist.
- The local registry is a recovery aid, not the source of truth.

This keeps the control plane normalized while closing the practical boot/recovery behavior gap.

## Alternatives Considered

- Reintroduce a file-backed local supervisor as the primary runtime source of truth.
- Keep DB-backed runtime services but ignore already-running local services on boot.
- Keep the current DB-backed model and add startup adoption from the local registry.

## Consequences

- Runtime state stays queryable and auditable in the database.
- Startup recovery can reuse already-running local services instead of forcing unnecessary restarts.
- The implementation becomes slightly more complex because boot now has two recovery paths:
  - persisted runtime service reconciliation
  - live local registry adoption
- This decision avoids a rollback to a file-backed primary supervisor and preserves the stronger ClawDev contract model.

## Rollout

This decision has already been implemented and validated.

Relevant implementation files:

- `server/src/services/workspace-runtime.ts`
- `server/src/services/local-service-supervisor.ts`
- `server/src/services/index.ts`
- `server/src/index.ts`
- `server/src/__tests__/workspace-runtime-startup.test.ts`

Validation completed:

- `pnpm --filter @clawdev/server typecheck`
- `pnpm test:run` -> `681 passed, 0 skipped`
- `pnpm build`

## References

- [ClawDev backend comparison](../2026-04-03-clawdev-backend-comparison.md)
- [Spec-Driven Development](../../../spec/spec-driven-development.md)
- [Runtime services startup test](../../../../server/src/__tests__/workspace-runtime-startup.test.ts)
