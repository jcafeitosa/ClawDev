---
title: "Paperclip -> ClawDev Frontend Parity Matrix"
---
# Paperclip -> ClawDev Frontend Parity Matrix

Date: 2026-03-30
Owner: CTO
Source inventory:
- Paperclip React routes: `/private/tmp/paperclip/ui/src/App.tsx`
- ClawDev Svelte routes: `/Users/juliocezaraquinofeitosa/Development/clawdev/svelte-ui/src/routes`

## 1) Route/Page Inventory Mapping

| Paperclip route (canonical) | ClawDev route | Parity | Notes |
|---|---|---|---|
| `/auth` | `/auth` | Full | Auth entry exists in both. |
| `/cli-auth/:id` | `/cli-auth` | Partial | ClawDev has route; tokenized path wiring needs verification. |
| `/invite/:token` | `/invite` | Partial | ClawDev has invite page; token path handling to validate. |
| `/onboarding` | `/onboarding` | Full | Both support onboarding flow. |
| `/companies` | `/companies` | Full | Company list/selection exists in both. |
| `/:companyPrefix/dashboard` | `/:companyPrefix/dashboard` | Full | Dashboard present. |
| `/:companyPrefix/agents` | `/:companyPrefix/agents` | Full | Agent list present. |
| `/:companyPrefix/agents/new` | `/:companyPrefix/agents/new` | Full | New-agent flow present. |
| `/:companyPrefix/agents/:agentId` | `/:companyPrefix/agents/:agentId` | Full | Agent detail present. |
| `/:companyPrefix/agents/:agentId/runs/:runId` | `/:companyPrefix/runs/:runId` and linked from agent page | Partial | Run detail exists but canonical path differs. |
| `/:companyPrefix/projects` | `/:companyPrefix/projects` | Full | Project list present. |
| `/:companyPrefix/projects/:projectId` | `/:companyPrefix/projects/:projectId` | Full | Project detail present. |
| `/:companyPrefix/projects/:projectId/{overview,issues,configuration,budget}` | `/:companyPrefix/projects/:projectId` | Partial | ClawDev consolidates tabs in single page. |
| `/:companyPrefix/issues` | `/:companyPrefix/issues` | Full | Issue board/list present. |
| `/:companyPrefix/issues/:issueId` | `/:companyPrefix/issues/:issueId` | Full | Issue detail present. |
| `/:companyPrefix/issues/new` | `/:companyPrefix/issues/new` | Full | New issue page present. |
| `/:companyPrefix/issues/mine` | `/:companyPrefix/issues/mine` | Full | Mine list present. |
| `/:companyPrefix/routines` | `/:companyPrefix/routines` | Full | Routines list present. |
| `/:companyPrefix/routines/:routineId` | `/:companyPrefix/routines/:routineId` | Full | Routine detail present. |
| `/:companyPrefix/execution-workspaces/:workspaceId` | `/:companyPrefix/workspaces/:workspaceId` | Full | Naming differs; functional equivalent exists. |
| `/:companyPrefix/workspaces` (implicit in ClawDev nav) | `/:companyPrefix/workspaces` | Full | Present in ClawDev; equivalent to Paperclip workspace surface. |
| `/:companyPrefix/goals` | `/:companyPrefix/goals` | Full | Goals list present. |
| `/:companyPrefix/goals/:goalId` | `/:companyPrefix/goals/:goalId` | Full | Goal detail present. |
| `/:companyPrefix/approvals` | `/:companyPrefix/approvals` | Full | Approvals list present. |
| `/:companyPrefix/approvals/:approvalId` | `/:companyPrefix/approvals/:approvalId` | Full | Approval detail present. |
| `/:companyPrefix/costs` | `/:companyPrefix/costs` | Full | Costs page present. |
| `/:companyPrefix/activity` | `/:companyPrefix/activity` | Full | Activity page present. |
| `/:companyPrefix/inbox/*` | `/:companyPrefix/inbox` | Partial | ClawDev has a single inbox route; filter subroutes not split. |
| `/:companyPrefix/skills/*` | `/:companyPrefix/skills` | Full | Skill manager exists (file navigation in-page). |
| `/:companyPrefix/plugins/:pluginId` and plugin route path | `/:companyPrefix/plugins` + `/:companyPrefix/plugins/:pluginId` | Partial | Core plugin pages exist; dynamic plugin route slot parity to verify. |
| `/:companyPrefix/company/settings` | `/:companyPrefix/settings` | Full | ClawDev settings page covers company settings. |
| `/:companyPrefix/company/import` | `/:companyPrefix/import` | Full | Import page present. |
| `/:companyPrefix/company/export/*` | `/:companyPrefix/export` | Full | Export page present. |
| `/:companyPrefix/org` | `/:companyPrefix/org` + `/org/chart` | Full | Org redirect + chart route present. |
| `/:companyPrefix/design-guide` | `/design-guide` | Partial | Global route exists, company-prefixed variant differs. |
| `/:companyPrefix/tests/ux/runs` | none | Gap | No direct Svelte route found. |
| `/:companyPrefix/providers` | `/:companyPrefix/providers` | Full | Providers page present. |
| `/:companyPrefix/labels` | `/:companyPrefix/labels` | Full | Labels page present. |
| `/:companyPrefix/members` | `/:companyPrefix/members` | Full | Members page present. |
| `/:companyPrefix/secrets` | `/:companyPrefix/secrets` | Full | Secrets page present. |
| `/:companyPrefix/runs` | `/:companyPrefix/runs` | Full | Runs list present. |

## 2) Component Parity Checklist (Per Page Group)

Legend: `I` = interactive behavior, `N` = non-interactive visual/content parity.

### Dashboard
- I: KPI cards navigate to filtered lists, quick actions open expected flows, live widgets update without hard refresh.
- N: section hierarchy, card density, labels, badge/status semantics.

### Agents (list/new/detail/runs)
- I: create/edit agent, pause/resume, run start/resume, instructions bundle CRUD, report-chain updates.
- N: status chips, capability summary blocks, run transcript readability, tool output formatting.

### Issues (board/list/detail/new/mine)
- I: create/assign/checkout/release transitions, comment thread, attachments, subtasks, approvals from issue.
- N: column grouping, priority/status color semantics, metadata side panel clarity.

### Projects + Workspaces
- I: project create/edit, workspace attach/sync, issue/goal linking from project detail.
- N: project summary cards, workspace metadata display, health indicators.

### Inbox + Approvals + Activity + Costs
- I: approve/reject flow, filtered inbox actions, deep links into runs/issues, pagination/refresh.
- N: table/card readability, timestamp rendering, empty/loading/error states.

### Goals + Routines + Org
- I: goal/routine CRUD and status transitions, org chart navigation and drill-down.
- N: hierarchy rendering and edge readability, status/owner badges.

### Skills + Plugins + Settings/Import/Export
- I: skill tree/file open-save, plugin install/enable/configure, import/export action completion.
- N: file tree hierarchy, plugin/source metadata readability, settings section grouping.

## 3) Implementation Order (Replication Stream)

1. Global shell + auth/session redirects (`/`, `/auth`, `/setup`, `/companies`, `/:companyPrefix/+layout`).
2. Core operations pages: dashboard, agents, issues.
3. Governance pages: approvals, inbox, activity, costs.
4. Planning/execution pages: projects, workspaces, goals, routines, runs.
5. Admin surfaces: skills, plugins, settings, import/export, members, providers, labels, secrets, org.
6. Close route gaps and compatibility aliases (`tests/ux/runs`, plugin dynamic route-path handling, legacy inbox subroutes).

## 4) Acceptance Checks Per Page

For each page above, accept only when all pass:

- Route parity: URL resolves and deep links work from nav and related entities.
- Data parity: primary query payload and key aggregates match server contracts.
- Action parity: all mutating controls (create/update/transition/approve) succeed and surface errors.
- State parity: loading, empty, error, and success states are explicit and non-silent.
- Interaction parity: keyboard focus, modal flows, and confirm/cancel outcomes match expected control-plane behavior.
- Regression gate: add/update UI smoke test for entry + critical interaction path.

## 5) Known Gaps to Track as Follow-up

- Dedicated `tests/ux/runs` route parity missing in ClawDev Svelte UI.
- Paperclip `inbox/*` segmented routes are consolidated in ClawDev (`/inbox`); verify filter-memory parity.
- Plugin `:pluginRoutePath` dynamic slot route from React app requires explicit parity decision in Svelte implementation.
- Legacy path alias coverage (`/agents/:agentId/runs/:runId`, nested project tab URLs) should be validated for deep-link compatibility.
