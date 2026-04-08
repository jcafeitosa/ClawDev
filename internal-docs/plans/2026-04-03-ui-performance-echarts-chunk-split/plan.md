# UI Performance: ECharts Chunk Split — SDD Plan

## Context

The UI already works correctly, but the production build showed a large ECharts vendor chunk. That warning is a useful signal that charting code can be split more cleanly so chart-heavy pages stay fast without making the rest of the app pay the cost.

This change was validated against the live dashboard and the main navigation smoke after the chunk split landed.

## Goals

- Remove the large ECharts chunk warning from the production build.
- Keep the dashboard and analytics routes working as they do today.
- Preserve the existing chart components and plugin UI React bridge.

## Non-Goals

- Redesigning the charts.
- Replacing chart libraries.
- Changing the dashboard information architecture.

## Spec References

- `internal-docs/GOAL.md`
- `internal-docs/PRODUCT.md`
- `internal-docs/SPEC.md`
- `internal-docs/SPEC-implementation.md`

## Architecture Decisions

- Split ECharts into smaller manual chunks in Vite.
- Keep React and ReactDOM isolated because plugin UI mounts use them.
- Avoid changing chart component APIs.

## Task Breakdown

1. Update the build chunking strategy.
2. Validate the production build.
3. Smoke the dashboard and main navigation in the browser.
4. Record the resulting bundle sizes as the baseline for future regressions.

## Implementation Notes

- File to touch: `svelte-ui/vite.config.ts`
- No schema changes required.
- No route/API contract changes required.

## Verification

- `pnpm --filter @clawdev/svelte-ui typecheck`
- `pnpm --filter @clawdev/svelte-ui build`
- `pnpm exec playwright test tests/e2e/full-navigation.spec.ts --config tests/e2e/playwright.config.ts`

## Risks

- If future ECharts updates change module paths, update the chunk split accordingly.

## Rollout

- Roll out with the existing build pipeline.

## Rollback

- Restore the previous chunking approach if the split causes regressions in build time or runtime loading.

## Bundle Baseline

After the split landed, the dashboard build no longer emitted the previous oversized ECharts vendor chunk warning. The largest remaining client chunk observed during the build was `Cdbwjq4H.js` at roughly `378.66 kB` minified, which is the current baseline to compare against in future regressions.

## Follow-up Answers

- Additional heavy client dependencies should follow the same pattern only when they become a real build or runtime problem.
- Route-level lazy loading for charts is a future option, not a requirement for this delivery.
- The current chart wrappers should stay as they are unless dependency growth makes finer granularity worthwhile.
