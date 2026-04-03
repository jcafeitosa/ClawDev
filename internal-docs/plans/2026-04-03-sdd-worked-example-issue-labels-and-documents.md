# Worked Example: Issue Labels and Documents

Status: Example
Date: 2026-04-03

This document shows how to write a ClawDev SDD plan for a real feature already delivered in the repo.
It is intentionally post-hoc so contributors can use it as a reference for the expected level of detail.

## Context

The issue and documents surfaces had a functional parity gap compared with the newer company-level workflow:

- issue creation supported assignee, status, priority, and project selection, but label selection was not present in the UI
- issue detail displayed labels, but the edit flow could not change them inline
- the company-level documents page exposed document CRUD, but the issue page did not make the relationship to company documents obvious in both directions

The backend already supported the underlying contracts:

- issue creation and update accepted `labelIds`
- company labels were available from `/api/companies/:companyId/labels`
- issue documents and company documents shared the same durable records with issue linkage metadata

## Goals

1. Allow labels to be selected when creating an issue.
2. Allow labels to be edited on an existing issue.
3. Make the issue-to-documents and documents-to-issue navigation explicit.
4. Preserve the existing company-scoped contracts and activity logging.

## Non-Goals

- Reworking the issue object model
- Changing label persistence or document storage semantics
- Introducing a separate chat-like issue editor

## Spec References

- `internal-docs/SPEC-implementation.md`
- `internal-docs/PRODUCT.md`
- `internal-docs/spec/spec-driven-development.md`

## Architecture Decisions

1. Keep labels company-scoped and load them from the existing labels endpoint.
2. Reuse the same `labelIds` contract for create and update flows.
3. Keep document linkage as a navigation and metadata concern rather than creating a second document system.
4. Use inline selection chips in existing forms instead of a separate label picker modal.

## Task Breakdown

1. Add label fetching and selection to the new issue dialog.
2. Add label fetching and selection to the `/issues/new` page.
3. Load labels in issue detail and allow editing them in the inline edit card.
4. Expose issue/document linkage in both directions on the company documents page and issue detail page.
5. Validate the UI with typecheck, tests, and build.

## Implementation Notes

- Files touched:
  - `svelte-ui/src/lib/components/new-issue-dialog.svelte`
  - `svelte-ui/src/routes/[companyPrefix]/issues/new/+page.svelte`
  - `svelte-ui/src/routes/[companyPrefix]/issues/[issueId]/+page.svelte`
  - `svelte-ui/src/routes/[companyPrefix]/documents/+page.svelte`
  - `server/src/routes/documents.ts`
  - `server/src/routes/issues.ts`
- Keep the issue detail edit flow aligned with the existing `PATCH /api/issues/:id` handler.
- Keep label color rendering reusable so the chip styling is consistent across screens.

## Verification

- `pnpm --filter @clawdev/svelte-ui typecheck`
- `pnpm test:run`
- `pnpm build`

## Result

This feature stayed aligned with the SDD workflow:

- the UI reflected an existing backend contract,
- the docs and product direction stayed synchronized,
- and the implementation was validated end-to-end.
