# Browser Smoke Diagnostics Helper — Spec

## Summary

The Playwright browser smokes in ClawDev were duplicating the same browser error filtering logic across several tests. The duplicated code handled known local-development noise like Vite websocket startup chatter and SES intrinsic warnings, but it was spread across files.

## Problem

When the browser smokes are maintained independently, the filtering rules drift. That makes the tests harder to keep consistent and increases the chance that a known harmless message is handled in one smoke but fails another.

## Goals

- Centralize the browser diagnostics collection logic used by the major smoke tests.
- Keep the existing filtering rules for known local-development noise.
- Make the smoke tests easier to maintain and reason about.

## Non-Goals

- Changing the browser smoke coverage itself.
- Relaxing the failure criteria beyond the already-accepted local-development noise.
- Rewriting the Playwright setup.

## Users and Flow

Maintainers run browser smokes against the local server to verify the app still navigates cleanly. The helper should make those tests cleaner without changing what they validate.

## Acceptance Criteria

- The major browser smoke tests share one diagnostics collector helper.
- Known local-development noise is filtered in one place.
- The dashboard and navigation smokes still pass.

## Constraints

- Must preserve the existing smoke semantics.
- Must not hide real browser failures.
- Must keep the helper local to the e2e test harness.

## Open Questions / Answers

- Should we add more noise filters later? Yes, but only when the same harmless message appears in more than one smoke and is clearly a local-development artifact.
- Should the helper also collect screenshots or traces? Not for this change. The current scope is diagnostics normalization only.
- Should this helper be reused by release-smoke tests too? Not yet; keep the scope to the main e2e smokes until the pattern proves stable.
