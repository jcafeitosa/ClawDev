# Full Product Gap Closure — SDD Plan

## Context

We already closed major portions of the model/provider routing work, the Bun migration, and the adapter readiness layer. What remains is the set of gaps between the original product goal and the current repository state:

- fully consistent adapter discovery/readiness across the runtime surface
- complete model routing by role + task complexity everywhere it matters
- UI alignment for provider/model selection and admin visibility
- validation coverage that proves the system behaves correctly in real flows
- documentation that matches the shipped behavior

This plan coordinates the remaining work as a single SDD effort.

## Goals

- Finish the adapter ecosystem so each supported adapter advertises the right discovery/readiness contract.
- Ensure agents receive model selection automatically from role + complexity-aware routing.
- Keep adapter-reported availability and cooldown as the source of truth for usable models.
- Align UI surfaces with the effective model/provider view.
- Close validation gaps with focused tests and full-suite verification.
- Update docs so they describe the shipped behavior, not the pre-migration state.

## Non-Goals

- Rewriting the full control plane product direction.
- Removing the adapter abstraction.
- Replacing company-scoped budget/approval/task flows.
- Introducing new major runtime families beyond the current adapter set.

## Architecture Decisions

- Adapters remain the discovery source for model availability.
- The server composes effective availability, cooldown, and fallback decisions.
- Routing policy remains persisted and company/agent scoped.
- UI should consume effective availability, not raw adapter metadata alone.
- Validation must cover both repo-owned tests and user-visible flows.

## Workstreams

### 1. Backend and Routing

- Audit remaining routing paths to ensure role + complexity policy is applied everywhere.
- Verify fallback behavior and model availability composition.
- Normalize model discovery and cooldown handling across adapters.
- Keep company-scoped contracts synchronized across db/shared/server.

### 2. Adapters

- Verify each supported adapter package exposes the correct metadata, readiness, and discovery contract.
- Confirm the new `openai_compatible_local` adapter is wired through server + UI.
- Audit special-case adapters (`openclaw_gateway`, `embedding_local`) and keep them in their correct contract class.

### 3. UI

- Keep agent creation/editing aligned with the effective adapter/model list.
- Keep provider/model pages aligned with readiness and discovery.
- Ensure the admin/operator surfaces reflect current backend contracts.

### 4. QA / Docs

- Add or fix tests that prove routing, readiness, discovery, and fallback behavior.
- Keep docs in sync with the current shipped behavior.
- Re-run repo-wide typecheck, tests, and build before handoff.

## Task Breakdown

1. Final backend audit of routing and effective availability flows.
2. Final adapter audit for discovery/readiness/model metadata parity.
3. Final UI audit for provider/model selection and admin surfaces.
4. Test hardening for the remaining end-to-end and integration gaps.
5. Documentation cleanup and verification pass.

## Verification

- `pnpm -r typecheck`
- `pnpm test:run`
- `pnpm build`

## Rollout

- Keep changes incremental and company-scoped.
- Prefer additive changes over wholesale rewrites.
- Verify each workstream before moving to the next.

## Risks

- Adapter CLIs can change outside the repo and affect discovery surfaces.
- Routing and readiness changes can shift which models are considered available.
- UI surfaces can drift again if they consume raw adapter metadata instead of the effective view.
