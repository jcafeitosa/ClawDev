# Spec-Driven Development Rollout

## Context

ClawDev now treats Spec-Driven Development (SDD) as the default workflow for meaningful changes. This rollout makes the process operational for the repo and the team.

## Goals

1. Make SDD the expected path for feature work, architecture changes, and cross-layer fixes.
2. Give contributors a reusable template for writing plans.
3. Keep product intent, architecture decisions, and implementation tasks traceable.
4. Reduce drift between docs and code.

## Non-Goals

- Rewriting all historic plans
- Renaming existing plan files
- Enforcing SDD with automation

## Deliverables

1. `internal-docs/spec/spec-driven-development.md`
2. `internal-docs/plans/spec-driven-development-template.md`
3. Process references added to main docs

## Rollout Steps

1. Publish the canonical SDD process document.
2. Add a reusable plan template.
3. Reference the process from the repo README and the internal docs.
4. Use the template for future cross-layer changes.

## Acceptance Criteria

1. A contributor can find the SDD process in one canonical doc.
2. A contributor can copy a plan template and start a new feature plan without inventing structure.
3. The README and internal docs point to the same workflow.

## Notes

- Existing plan docs remain valid and continue to serve as historical examples.
- New work should prefer the SDD chain: spec -> architecture plan -> task breakdown -> implementation -> verification.
