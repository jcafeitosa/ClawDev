# Internal Docs Index

This directory is the canonical internal documentation home for ClawDev.

## Primary Docs

- [GOAL](./GOAL.md)
- [PRODUCT](./PRODUCT.md)
- [SPEC](./SPEC.md)
- [SPEC-implementation](./SPEC-implementation.md)
- [DEVELOPING](./DEVELOPING.md)
- [DATABASE](./DATABASE.md)

## Spec-Driven Development

- [Spec-Driven Development](./spec/spec-driven-development.md)
- [SDD rollout plan](./plans/2026-04-03-spec-driven-development-rollout.md)
- [SDD plan template](./plans/spec-driven-development-template.md)
- [Worked SDD example: issue labels and documents](./plans/2026-04-03-sdd-worked-example-issue-labels-and-documents.md)
- [UI performance: ECharts chunk split](./plans/2026-04-03-ui-performance-echarts-chunk-split/README.md)
- [UI performance baseline note](./plans/2026-04-03-ui-performance-echarts-chunk-split/plan.md)
- [Browser smoke diagnostics helper](./plans/2026-04-03-browser-smoke-diagnostics-helper/README.md)
- [Runtime services boot recovery](./plans/2026-04-03-runtime-services-boot-recovery/README.md)
- [ClawDev backend comparison](./plans/2026-04-03-clawdev-backend-comparison.md)
- [Backend parity maintenance checklist](./plans/2026-04-03-backend-parity-maintenance-checklist.md)
- [Spec template](./templates/spec-template.md)
- [ADR template](./templates/adr-template.md)
- [Task breakdown template](./templates/task-breakdown-template.md)

## Planning

Use `internal-docs/plans/` for dated feature and architecture plans.
Create a new scaffold with:

```sh
pnpm clawdev sdd new <slug> --title "Human readable title"
pnpm clawdev sdd init
pnpm clawdev sdd init --yes
pnpm clawdev plan new <slug> --title "Human readable title"
pnpm clawdev spec new <slug> --title "Human readable title"
pnpm clawdev adr new <slug> --title "Human readable title"
pnpm sdd:new -- <slug>
pnpm sdd:init
pnpm sdd:init:yes
pnpm plan:new -- <slug>
pnpm spec:new -- <slug>
pnpm adr:new -- <slug>
```

Prefer `sdd new` when you want the full bundle (`spec.md`, `adr.md`, `tasks.md`, and `plan.md`).
Each bundle also includes a `README.md` that acts as the entry point for the generated docs.
Prefer `sdd init` when you want the same bundle but want the CLI to ask for the title and slug interactively. Pass `--yes` or use `sdd:init:yes` to skip the final confirmation prompt once the values are filled in.

Recommended flow for meaningful work:

1. Update or create the relevant spec.
2. Add or update an architecture plan / ADR.
3. Break the work into implementation tasks.
4. Implement.
5. Verify with typecheck, tests, build, and a smoke check when the UI changes.

## Reference Collections

- [Spec notes](./spec/)
- [Plans](./plans/)
- [Plugins docs](./plugins/)
- [Experimental notes](./experimental/)
