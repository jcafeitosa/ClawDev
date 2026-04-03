# UI Performance: ECharts Chunk Split — Spec

## Summary

ClawDev's Svelte UI was emitting a large client chunk for charting code because multiple routes and dashboards import ECharts through shared chart components. The build still succeeds, but the large vendor bundle increases initial load cost and triggers warnings during production builds.

The chart-heavy surfaces are primarily the dashboard, costs, and other analytics-adjacent views that rely on the shared chart wrappers under `svelte-ui/src/lib/components/charts/`.

## Problem

The dashboard and related surfaces use charts heavily enough that ECharts is pulled into a large shared chunk. Even though Vite can build the app successfully, the bundle warning makes the regression risk visible and increases the chance of slower first-load performance on chart-heavy screens.

## Goals

- Keep the production build healthy and warning-free for chunk size.
- Split charting dependencies into smaller, meaningful chunks.
- Preserve existing chart behavior and routing.
- Avoid impacting non-chart pages with unnecessary payload.

## Non-Goals

- Rewriting the chart surfaces or changing chart libraries.
- Replacing ECharts with another charting system.
- Changing visual design or dashboard layout.

## Users and Flow

Board operators open the dashboard, costs, and related analytics pages. Those routes should remain fast to load and should only pull the charting code they need. Users should not see any change in behavior other than faster perceived performance and a cleaner build.

The validation path for this change is the interactive browser smoke that covers the dashboard and the major navigation surfaces.

## Acceptance Criteria

- The Svelte UI production build no longer reports the oversized ECharts chunk warning.
- Chart-heavy routes still render correctly after code splitting.
- Non-chart routes continue to load without depending on the full charting vendor bundle.

## Constraints

- Must preserve existing chart components and their public APIs.
- Must work with the current Vite + SvelteKit build pipeline.
- Must not break SSR or client navigation.

## Open Questions / Answers

- Should additional heavy client dependencies be split the same way if they become large later? Yes, but only when a real build warning or measured regression appears. We should not preemptively fragment the bundle graph without evidence.
- Do we want route-level lazy loading for charts in a later iteration? Possibly, but not for this change. Manual chunk splitting is enough for the current problem and keeps the implementation simpler.
- Should the chart wrappers become more granular if future chart dependencies grow again? Only if the chart dependency surface expands enough to justify it. The current wrappers are fine for the present workload.
