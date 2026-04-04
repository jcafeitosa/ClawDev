# Backend Parity Maintenance Checklist

Date: 2026-04-03

This checklist captures the backend areas that are already functionally aligned between ClawDev and the baseline, plus the residual architectural decisions that should be monitored over time.

## Functional parity already confirmed

- Auth / trust model
- Company isolation
- Agents and runtime config
- Issues, checkout, release, comments, and inbox archive semantics
- Approvals
- Budgets and hard-stop enforcement
- Routines and heartbeats
- Documents and revisions
- Plugins and plugin runtime/tooling
- Goals
- Assets
- Secrets
- Execution workspaces
- Import/export/bootstrap
- Observability and audit logging
- Search and model catalog/status

## Architectural decisions to keep stable

- Runtime services are DB-backed in ClawDev and recovered/adopted on boot.
- `budgets` is intentionally split between operational cost routes and dedicated budget overview routes.
- `authz` lives in middleware in ClawDev instead of a route helper module.
- ClawDev keeps more explicit route surfaces for `documents`, `inbox`, `runs`, `search`, and `comments`.

## Residual watchpoints

### Runtime services

- Keep startup recovery tests for persisted runtime services.
- Keep the fallback from `metadata.config.workspaceRuntime` to project/execution workspace config covered.
- Watch for regressions in local-service adoption during boot.

### Routines

- Keep ownership checks for agent-managed routines.
- Keep tests for routine create/update/manual run/trigger update/delete/secret rotation.

### Company portability

- Keep import/export smoke coverage around PGlite and safe import.
- Keep the runtime-service recovery path covered by bundle/import tests.
- Watch for regressions in skill and asset path remapping.

### Budgets

- Keep hard-stop enforcement tests for company, agent, and project scopes.
- Keep policy upsert and incident resolution coverage.
- Watch for regressions in budget pauses propagating to work cancellation.

### Issues

- Keep checkout/release ownership tests.
- Keep inbox archive/unarchive coverage.
- Keep comment reopen / interrupt semantics covered.

### Plugins

- Keep lifecycle, tool dispatch, webhook, SSE, and UI contribution coverage.
- Watch for regressions in capability gating and company scoping.

### Approvals

- Keep approve/reject idempotency and requester wakeup coverage.
- Keep approval-to-issue linkage semantics covered.

### Audit trail

- Keep `logActivity` coverage on mutating routes.
- Watch for missing entity IDs or entity types in logs after new mutating endpoints are added.

## Verification baseline

The backend parity baseline is considered healthy when:

- `pnpm -r typecheck` passes
- `pnpm test:run` passes with zero skipped tests
- `pnpm build` passes
