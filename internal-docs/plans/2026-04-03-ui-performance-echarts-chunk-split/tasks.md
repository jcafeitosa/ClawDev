# UI Performance: ECharts Chunk Split — Task Breakdown

## Goal

Reduce the charting bundle footprint in the Svelte UI without changing chart behavior.

## Dependencies

- Existing dashboard and analytics chart components
- Vite build configuration
- Browser smoke coverage for the main navigation flow

## Tasks

1. Identify the heavy charting dependency groups that should become separate chunks.
2. Update the Vite manual chunking config.
3. Rebuild the UI and confirm the chunk warning is gone.
4. Run a browser smoke on the dashboard and major navigation surfaces.
5. Capture the changed chunk sizes in the rollout notes for future reference.

## Verification

- `pnpm --filter @clawdev/svelte-ui typecheck`
- `pnpm --filter @clawdev/svelte-ui build`
- `pnpm exec playwright test tests/e2e/full-navigation.spec.ts --config tests/e2e/playwright.config.ts`

## Risks

- Chunk boundaries could shift in a future ECharts upgrade.
- Over-fragmentation could make the bundle graph harder to reason about.
