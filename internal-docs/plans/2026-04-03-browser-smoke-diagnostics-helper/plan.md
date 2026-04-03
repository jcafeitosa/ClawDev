# Browser Smoke Diagnostics Helper — SDD Plan

## Context

The browser smoke tests already work, but they had repeated boilerplate for collecting and filtering known local-development noise. That duplication was beginning to spread across multiple files.

## Goals

- Centralize the browser diagnostics filtering.
- Preserve the current smoke semantics.
- Keep the test harness easy to read.

## Non-Goals

- Changing the actual browser coverage.
- Weakening the failure thresholds.
- Refactoring the entire Playwright setup.

## Spec References

- `internal-docs/GOAL.md`
- `internal-docs/PRODUCT.md`
- `internal-docs/SPEC.md`
- `internal-docs/SPEC-implementation.md`

## Architecture Decisions

- Add one shared browser diagnostics helper in `tests/e2e/helpers.ts`.
- Reuse it in the major smoke tests.
- Keep the helper minimal and local to the e2e harness.

## Task Breakdown

1. Extract the shared diagnostics helper.
2. Refactor the smoke tests to use it.
3. Validate the dashboard, full navigation, and inbox retry smoke tests.

## Implementation Notes

- File to touch: `tests/e2e/helpers.ts`
- Smoke tests to update:
  - `tests/e2e/dashboard-console.spec.ts`
  - `tests/e2e/full-navigation.spec.ts`
  - `tests/e2e/inbox-retry.spec.ts`

## Verification

- `pnpm exec playwright test tests/e2e/dashboard-console.spec.ts --config tests/e2e/playwright.config.ts`
- `pnpm exec playwright test tests/e2e/full-navigation.spec.ts --config tests/e2e/playwright.config.ts`
- `pnpm exec playwright test tests/e2e/inbox-retry.spec.ts --config tests/e2e/playwright.config.ts`

## Rollout / Risks

- Roll out by keeping the smoke tests functionally identical while consolidating the shared logic.
- If future smokes need extra filters, add them only when the same harmless noise is proven across multiple files.
