# Browser Smoke Diagnostics Helper — Task Breakdown

## Goal

Reduce duplication in the browser smoke tests while keeping the same failure semantics.

## Dependencies

- Playwright e2e tests
- Local dev server
- Existing smoke coverage

## Tasks

1. Add a shared diagnostics collector helper in the e2e helpers module.
2. Refactor dashboard, full navigation, and inbox retry smokes to use the helper.
3. Re-run the smoke tests and confirm they still pass.
4. Document the new helper in the internal docs index.

## Verification

- `pnpm exec playwright test tests/e2e/dashboard-console.spec.ts --config tests/e2e/playwright.config.ts`
- `pnpm exec playwright test tests/e2e/full-navigation.spec.ts --config tests/e2e/playwright.config.ts`
- `pnpm exec playwright test tests/e2e/inbox-retry.spec.ts --config tests/e2e/playwright.config.ts`

## Risks

- Over-filtering browser diagnostics could hide a real problem.
- Keeping the helper too generic could make it harder to reason about what each smoke is actually validating.
