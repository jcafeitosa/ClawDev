# ClawDev Backend Comparison

Date: 2026-04-03

## Executive Summary

ClawDev’s backend is largely equivalent to the baseline on the core company/agent control plane, and in a few places it is more explicit and more operationally resilient.

The main differences I found are not functional regressions. They are mostly:

1. **Architecture and state management**
   - The baseline keeps a disk-backed local service supervisor in `server/src/services/local-service-supervisor.ts`.
   - ClawDev primarily models runtime services in the database through `workspaceRuntimeServices` and `server/src/services/workspace-runtime.ts`, then reconciles persisted runtime services on startup. It now also adopts live local-service registry records during boot through a small supervisor layer, so startup recovery is no longer DB-only.

2. **Route organization**
   - ClawDev has split several backend concerns into dedicated route modules: `documents`, `inbox`, `models`, `runs`, `search`, and `comments`.
   - The baseline keeps many of those handlers inside broader modules like `agents.ts`, `issues.ts`, and `companies.ts`.

3. **Operational / test hardening**
   - ClawDev’s local bootstrap, import/export path, and e2e validation were stabilized during the fork work.
   - The standard suite is green with zero skips.

I did **not** find a core backend gap in the major domain areas:
auth, company isolation, agents/runtime, issue checkout/release semantics, approvals, budgets, routines/heartbeats, documents, plugins, import/export/bootstrap, or activity logging.

### Bottom line

**Recommendation: merge as-is.**

The remaining differences are best treated as architectural decisions, not blockers.

---

## Comparison Matrix

### 1) Auth and trust model

- **Baseline**
  - Uses board vs agent authz separation with company-scoped access checks.
  - Has explicit authz route helpers and board/instance-admin logic.
- **ClawDev**
  - Uses the same company-scoped model and preserves the board/agent split.
  - Authz is enforced in middleware/helpers and throughout routes/services.
- **Gap**
  - No meaningful functional gap surfaced.
- **Type**
  - Parity.
- **Recommendation**
  - Keep the ClawDev trust model. It is aligned with the baseline semantics.

### 2) Company isolation

- **Baseline**
  - Company access checks are enforced in routes and services.
  - Company import/export is supported with portability flows.
- **ClawDev**
  - Same company boundary model, plus stronger local test coverage around delete/import/export.
  - Safe import/export flows exist and are role-gated.
- **Gap**
  - No meaningful functional gap surfaced.
- **Type**
  - Parity with improved verification.
- **Recommendation**
  - Keep the current ClawDev implementation.

### 3) Agents and runtime config

- **Baseline**
  - Agent routes handle agent CRUD, lifecycle, runs, runtime state, permissions, and model probing.
  - Runtime services are tracked through a local service supervisor and registry files on disk.
- **ClawDev**
  - Agent routes cover the same domain and also include dedicated model routing / provider status surfaces.
  - Runtime services are DB-backed (`workspaceRuntimeServices`), reconciled on startup, and now adopt live local registry records during boot.
- **Gap**
  - The gap is architectural, not functional: file-backed supervisor vs DB-backed runtime service persistence.
- **Type**
  - Architectural.
- **Recommendation**
  - Keep ClawDev’s DB-backed runtime model. The local registry adoption layer closes the practical boot/recovery gap without changing the source of truth.

### 4) Issues, checkout semantics, and wakeups

- **Baseline**
  - Issue checkout/release semantics are implemented with run ownership checks and wakeup behavior.
  - `shouldWakeAssigneeOnCheckout` exists and is used in the checkout flow.
- **ClawDev**
  - Checkout/release logic matches the same lock semantics.
  - Wakeups on checkout, comments, and updates are present.
- **Gap**
  - No functional gap found.
- **Type**
  - Parity.
- **Recommendation**
  - Keep current ClawDev behavior.

### 5) Approvals and budgets

- **Baseline**
  - Approvals and budget hard-stop behavior are part of the control plane.
- **ClawDev**
  - Same concepts exist: approvals, budget policy, budget actions, and logging.
- **Gap**
  - No functional gap found in the reviewed surfaces.
- **Type**
  - Parity.
- **Recommendation**
  - Keep current ClawDev behavior.

### 6) Routines, schedulers, and heartbeats

- **Baseline**
  - Has heartbeat and scheduler behavior tied to agent execution and local service state.
- **ClawDev**
  - Has dedicated routines and heartbeat services plus startup reconciliation.
  - The suite validates these paths without skips.
- **Gap**
  - No functional gap found.
- **Type**
  - Parity with stronger test stability.
- **Recommendation**
  - Keep current ClawDev behavior.

### 7) Documents and revisions

- **Baseline**
  - Documents are deeply tied to issues and issue-specific document routes.
- **ClawDev**
  - Has issue documents plus a dedicated company document library with revisions and search.
- **Gap**
  - ClawDev expands the surface; no missing core behavior surfaced.
- **Type**
  - Extension / organization.
- **Recommendation**
  - Keep ClawDev’s explicit document routes. They are a useful extension.

### 8) Plugins and plugin runtime

- **Baseline**
  - Plugin support exists as an alpha system with runtime services, job coordination, and plugin-host concerns.
- **ClawDev**
  - Has a comparable plugin stack, with explicit route modules, host services, loader/runtime, and UI contribution routes.
- **Gap**
  - No core backend gap found in the reviewed surfaces.
- **Type**
  - Parity with ClawDev being more explicit in route organization.
- **Recommendation**
  - Keep the ClawDev plugin architecture as-is.

### 9) Import/export and bootstrap

- **Baseline**
  - Company portability exists with preview/apply flows.
  - Local runtime state is not bootstrapped through the same DB-backed reconciliation path seen in ClawDev.
- **ClawDev**
  - Company portability exists and is validated.
  - Local dev/test bootstrap uses PGlite when `DATABASE_URL` is unset, and runtime services are reconciled on startup with live registry adoption.
- **Gap**
  - Architectural and operational, not functional.
- **Type**
  - Architectural / operational.
- **Recommendation**
  - Keep the ClawDev bootstrap and portability flow.

### 10) Activity / audit trail

- **Baseline**
  - Mutating actions log activity.
- **ClawDev**
  - Same invariant is present, with broad activity logging coverage.
- **Gap**
  - No meaningful functional gap found.
- **Type**
  - Parity.
- **Recommendation**
  - Keep current logging conventions.

### 11) API contracts and error handling

- **Baseline**
  - Routes are more monolithic but still enforce company checks and return consistent HTTP failures.
- **ClawDev**
  - Contracts are split into more focused route modules and services.
  - Error handling is explicit and the shared contract is well factored.
- **Gap**
  - No functional gap found.
- **Type**
  - Organization / maintainability.
- **Recommendation**
  - Keep the explicit ClawDev modules. They make the backend easier to reason about.

### 12) Tests and smoke coverage

- **Baseline**
  - Not part of this comparison’s validation baseline.
- **ClawDev**
  - Standard suite is green with zero skipped tests.
  - Build and typecheck pass.
  - The fork work includes targeted regressions for company delete, import/export, routines, and runtime startup behavior.
- **Gap**
  - ClawDev is ahead here.
- **Type**
  - Coverage / operational robustness.
- **Recommendation**
  - Keep the stronger ClawDev verification posture.

---

## Deep Dive

### Auth / trust model

Both systems separate board-level operator context from agent-authenticated requests. Both enforce company-scoped access and reject cross-company access for agent keys. In ClawDev this behavior is consistently enforced through middleware/helpers and service-level checks, and I did not find a divergence worth treating as a gap.

### Company isolation

Company isolation is aligned. Import/export, delete, update, and read flows all remain company-scoped. ClawDev’s recent regression coverage around company deletion actually improves confidence in that invariant.

### Agents / runtime

This is the most interesting architectural difference.

- The baseline persists local service registry records to disk through `local-service-supervisor.ts`.
- ClawDev uses DB-backed runtime service rows and reconciles them on startup through `workspaceRuntimeServices` and `workspace-runtime.ts`.

The important point is that the capability appears equivalent from a product perspective:
runtime services are started, tracked, reused, and cleaned up. The implementation shape differs, but the control-plane behavior is intact.

### Issue lifecycle / checkout

The checkout/release semantics are effectively the same:

- run ownership is checked
- stale checkout ownership can be adopted
- release is restricted to the assignee / matching run
- assignee wakeup on checkout is preserved

That means the core issue control flow is aligned.

### Approvals / budgets / costs

The approval gate and budget hard-stop model are present in both systems. I did not identify a meaningful gap in the reviewed code paths. ClawDev’s logging and route/service decomposition make the behavior easier to audit.

### Routines / heartbeats

Routines and heartbeats exist in both systems. ClawDev’s startup reconciliation plus the now-green full suite make this area more operationally stable in practice.

### Documents / plugins

ClawDev expands the backend surface with explicit document/search/inbox/models/runs routes and a dedicated company document library. That is not a regression; it is a more explicit backend surface.

Plugins are comparable at the backend level, with ClawDev using clearer route separation and explicit plugin host/support services.

### Import/export / bootstrap

ClawDev’s import/export and bootstrap story is more operationally hardened:

- PGlite bootstrap when `DATABASE_URL` is absent
- import/export flows tested under the current suite
- startup reconciliation of persisted runtime services

This is an advantage, not a gap.

### Observability / audit trail

Both systems log mutating actions. ClawDev retained and expanded logging around the areas I checked, so no issue surfaced here.

### Tests / smoke coverage

ClawDev is in better shape on validation:

- `pnpm test:run` → `679 passed, 0 skipped`
- `pnpm -r typecheck` → passed
- `pnpm build` → passed

That is a stronger operational baseline than “feature parity by inspection” alone.

---

## Findings

### Finding 1: Runtime service persistence is implemented differently

ClawDev uses DB-backed runtime services and startup reconciliation, with a local registry adoption layer added to recover live services during boot. The baseline uses a file-backed local service supervisor. This is the largest backend divergence, but it is architectural rather than functional.

**Why it matters:** it changes where state lives and how startup recovery works.

**Why it is not a blocker:** the runtime service lifecycle remains supported; the implementation is simply more normalized in ClawDev.

### Finding 2: ClawDev exposes a larger, more explicit route surface

ClawDev has explicit modules for documents, inbox, models, runs, search, and comments. The baseline keeps some of that logic embedded in broader route files.

**Why it matters:** ClawDev is easier to navigate and reason about, but the module split itself is not a product gap.

**Why it is not a blocker:** the backend behavior observed in the core control plane still matches.

### Finding 3: ClawDev’s validation posture is stronger

The ClawDev fork now ships with a fully green suite and no skipped tests, plus targeted regressions around company delete and runtime recovery.

**Why it matters:** this reduces risk when changing the backend further.

---

## Recommendation

**Merge as-is.**

I did not find a backend blocker that would justify reverting ClawDev changes to chase the baseline’s internal structure.

If you want stricter alignment later, the only area worth a deliberate decision is the runtime-service persistence model:

- keep ClawDev’s DB-backed runtime state
- or formally decide to reintroduce a file-backed supervisor layer

That decision should be made explicitly in an ADR, not as an accidental rollback.

---

## Verification Notes

This comparison report is analysis-only. I did not run new end-to-end tests against the baseline or re-run the ClawDev suite as part of writing the report.

Baseline ClawDev verification already completed and was green:

- `pnpm test:run` → `679 passed, 0 skipped`
- `pnpm test:run` → `681 passed, 0 skipped`
- `pnpm -r typecheck` → passed
- `pnpm build` → passed
