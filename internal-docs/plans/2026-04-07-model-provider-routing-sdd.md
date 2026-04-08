# Model Provider Routing — SDD Plan

## Context

ClawDev already discovers models, tracks provider/model health, and applies cooldowns, but the current flow is still company-level and catalog-driven. Agents do not yet receive model choices from a role- and task-aware policy, and the UI still mixes raw adapter lists with catalog/status views.

The goal of this change is to make model selection operationally resilient: adapters should surface the models that are actually usable, the server should compose a final availability view with cooldown and failure state, and agents should receive automatic model routing based on role and task complexity with guaranteed fallback.

Current implementation state:

- The main CLI adapters and the new OpenAI-compatible local adapter are wired into the registry and UI.
- Readiness and availability probes exist, but coverage is not yet perfectly homogeneous across every adapter/package.
- Gateway and embeddings adapters have their own contract and should be treated as special cases, not as failures of the core routing model.

## Goals

- Add a shared routing contract for role, complexity, and capability-aware model selection.
- Make task complexity a first-class input to routing.
- Keep adapters as the source of discovered models while preserving server-side cooldown and failure tracking.
- Expose a single effective availability view for agents and operators.
- Ensure routing always returns a fallback model instead of hard-failing when possible.

## Non-Goals

- Replacing the existing company-level model preferences system in one shot.
- Removing catalog or provider status tables.
- Redesigning the entire UI around a new workflow.
- Implementing a full pricing engine beyond the current cost and limit metadata.

## Spec References

- `internal-docs/GOAL.md`
- `internal-docs/PRODUCT.md`
- `internal-docs/SPEC.md`
- `internal-docs/SPEC-implementation.md`

## Architecture Decisions

- Keep `model_catalog` and `provider_model_status` as runtime persistence, but add a higher-level routing contract.
- Model selection should prefer agent/role/complexity policy first, then company defaults, then adapter fallback.
- `unknown` model state should not be treated as definitively available.
- The effective model list returned to the UI should be a merged view of adapter discovery plus operational status.

## Task Breakdown

1. Add shared constants and types for model complexity and routing policy.
2. Extend issue/task schema with complexity.
3. Add routing profile and assignment tables if needed for persisted policy.
4. Update model discovery and adapter status normalization.
5. Update router to accept role/complexity context and guarantee fallback.
6. Normalize API endpoints that expose effective availability and routing decisions.
7. Update UI surfaces to show effective availability and auto-resolved models.
8. Add tests for discovery, routing, and UI contract changes.
9. Audit remaining adapter-specific gaps and either align them to the shared contract or explicitly document them as special-case runtimes.

## Implementation Notes

- Files to touch:
  - `packages/shared/src/constants.ts`
  - `packages/shared/src/types/*`
  - `packages/shared/src/validators/*`
  - `packages/db/src/schema/*`
  - `server/src/services/*`
  - `server/src/routes/models.ts`
  - `server/src/routes/agents.ts`
  - `svelte-ui/src/routes/*`
  - `svelte-ui/src/lib/components/*`
  - `packages/adapters/*`
- Contracts to sync:
  - issue creation/update payloads
  - model resolve request/response
  - provider/model availability responses
- Migrations or schema changes:
  - issue complexity column
  - routing policy tables if persisted

## Workstreams

### Backend / Contracts

- Keep adapter discovery as the source of truth for what exists.
- Keep server-side cooldown, status, and fallback as operational guards.
- Make routing policy role- and complexity-aware without breaking company-level preferences.

### UI / Adapters

- Keep agent config UI aligned with the effective availability view.
- Ensure adapters expose the same discoverability contract where their runtime supports it.
- Keep special-case adapters documented so they are not mistaken for CLI-model adapters.

### QA / Docs

- Verify that the full test suite only exercises repo-owned tests.
- Keep docs in sync with actual adapter capabilities.
- Preserve explicit notes for gateway and embeddings adapters.

## Verification

- `pnpm -r typecheck`
- `pnpm test:run`
- `pnpm build`
- browser smoke validation for model/provider pages and agent config surfaces

## Risks

- Adding new routing policy tables may require broader data model and UI follow-up.
- Discovery changes can temporarily alter which models appear available.
- Adapter fallback normalization may expose latent gaps in provider CLI availability.

## Rollout

- Ship shared contract and schema changes first.
- Update discovery and routing to consume the new contract.
- Update UI after backend payloads stabilize.
- Validate with tests and a smoke pass on provider/model and agent configuration flows.

## Rollback

- Keep the company-level preference system intact as a fallback path.
- Preserve existing catalog and status tables so the new routing layer can be bypassed if needed.
- Revert UI-only changes independently from backend contract changes when necessary.
