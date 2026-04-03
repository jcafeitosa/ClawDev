# Browser Smoke Diagnostics Helper — ADR

## Status

Accepted

## Context

The existing e2e smokes repeated the same websocket and SES noise filtering logic in multiple test files. That duplication made the test suite harder to maintain and risked inconsistent handling of the same harmless messages.

## Decision

Introduce a shared `collectBrowserDiagnostics(page)` helper in `tests/e2e/helpers.ts` that:

- tracks console errors
- tracks page errors
- tracks request failures
- tracks 404 responses where needed
- filters known local-development noise once

Then update the major smoke tests to use the shared helper.

## Alternatives Considered

- Leave the duplicated logic in each smoke test.
- Create a full browser test framework abstraction.
- Disable the noisy messages globally.

## Consequences

- The smoke tests become shorter and more consistent.
- The filtering rules live in one place.
- The helper remains intentionally small and local to the e2e harness.

## Rollout

Roll out by updating the most visible smoke tests first:

- dashboard console smoke
- deep navigation smoke
- inbox retry smoke

Then keep the new helper as the reference for future browser smoke additions.

## References

- Related spec: `internal-docs/plans/2026-04-03-browser-smoke-diagnostics-helper/spec.md`
- Related task breakdown: `internal-docs/plans/2026-04-03-browser-smoke-diagnostics-helper/tasks.md`
- Related implementation files: `tests/e2e/helpers.ts`, `tests/e2e/dashboard-console.spec.ts`, `tests/e2e/full-navigation.spec.ts`, `tests/e2e/inbox-retry.spec.ts`
