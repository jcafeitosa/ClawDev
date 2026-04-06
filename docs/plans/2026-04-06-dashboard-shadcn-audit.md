# Dashboard / shadcn Audit Context

Date: 2026-04-06

## Objective

Run a page-by-page UI audit with three rounds of review per page:

1. Inventory components, state, and data dependencies.
2. Map the page to the local design system and shadcn/UI Pro patterns.
3. Identify and implement the highest-value structural improvements without changing business rules.

## Scope

- Primary page: `/[companyPrefix]/dashboard`
- Supporting surfaces: company-scoped pages, shared layout, and the design guide
- Reference files:
  - `design-system/clawdev/MASTER.md`
  - `design-system/clawdev/pages/dashboard.md`
  - `design-system/clawdev/pages/global.md`
  - `svelte-ui/src/app.css`
  - `svelte-ui/src/routes/design-guide/+page.svelte`

## Working Rules

- Prefer `PageLayout` for page scaffolding.
- Prefer shadcn compound components for standard data panels.
- Keep `glass-card` only where the glassmorphism effect is intentional and adds value.
- Do not touch unrelated worktree changes.

## Round Protocol

### Round 1

- Inventory visible sections, imported UI primitives, and data-loading patterns.
- Note whether the page already uses `PageLayout`.
- Record whether the page relies on `glass-card` or shadcn compound components.

### Round 2

- Compare the page against the design system.
- Flag missing structure, inconsistent spacing, and places where custom wrappers replace a shadcn primitive.
- Separate acceptable visual variation from actual pattern drift.

### Round 3

- Implement the smallest set of changes that improves consistency the most.
- Preserve live refresh behavior, routing, and data contracts.
- Re-run typecheck or targeted validation after edits.

## Current Audit Snapshot

- Dashboard route currently does **not** use `PageLayout`.
- Dashboard still uses `glass-card` as the primary surface wrapper.
- Dashboard already uses shadcn primitives selectively: `Alert`, `Card`, `Progress`, `Skeleton`.
- Company-scoped pages are mostly aligned on `PageLayout`, but many still mix `glass-card` with compound components.

## Implementation Targets

1. Wrap the dashboard in `PageLayout` or otherwise align its top-level structure with the rest of the app.
2. Normalize dashboard panels to `Card`/`CardHeader`/`CardContent`/`CardFooter`.
3. Keep charts and live feeds intact, but present them inside consistent shells.
4. Audit the remaining company-scoped pages for the same pattern and fix the ones that are still free-form.
