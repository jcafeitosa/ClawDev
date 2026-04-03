# UI Performance: ECharts Chunk Split — ADR

## Status

Accepted

## Context

The Svelte UI relies on ECharts for dashboard and analytics charts. The production build was emitting a large shared chunk for the charting dependency, which is a signal that the vendor payload is too concentrated in a single bundle.

## Decision

Split ECharts into multiple manual chunks in the Vite build:

- `echarts-core`
- `echarts-charts`
- `echarts-components`
- `echarts-renderers`

Also keep React / ReactDOM isolated because plugin UI mounts depend on them and they are reused outside the chart surfaces.

## Alternatives Considered

- Leave ECharts in one shared chunk and accept the warning.
- Introduce dynamic imports around every chart component.
- Replace ECharts with a different charting library.

## Consequences

- The build warning is removed.
- The vendor payload is more granular and easier to cache.
- The build config becomes slightly more explicit.
- Additional heavy dependencies can be split the same way if they show up later.
- The chunking strategy now tracks the actual chart dependency groups used by the dashboard and analytics surfaces.

## Rollout

Ship the chunk split behind the existing build pipeline, then validate the main dashboard and interactive navigation smoke to confirm chart routes still render correctly.

The browser smoke should cover the dashboard first because it is the highest-traffic chart surface and the easiest place to catch regressions in shared chart bootstrapping.

## References

- Related spec: `internal-docs/plans/2026-04-03-ui-performance-echarts-chunk-split/spec.md`
- Related task breakdown: `internal-docs/plans/2026-04-03-ui-performance-echarts-chunk-split/tasks.md`
- Related implementation files: `svelte-ui/vite.config.ts`, chart components under `svelte-ui/src/lib/components/charts/`
