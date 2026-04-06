# ClawDev UI Pro Max Audit

Generated from the local route scan on 2026-04-06T11:58:07.963Z.

## Round 1. Page Inventory

### Summary
- Total company-scoped pages scanned: 42
- PageLayout coverage: 32/42
- glass-card usage: 16/42
- Classified aligned: 14
- Classified mixed: 18
- Classified cleanup: 10

### Route Matrix
| Page | Verdict | PageLayout | glass-card | Shadcn primitives |
|---|---|---:|---:|---|
| `+page.svelte` | cleanup | no | no | none |
| `activity/+page.svelte` | mixed | yes | yes | Badge, Button, Skeleton, Separator |
| `agents/+page.svelte` | mixed | yes | yes | Card, Badge, Skeleton, Avatar, Alert, Button |
| `agents/[agentId]/+page.svelte` | aligned | yes | no | Button, Badge, Card, Separator, Tabs, DropdownMenu |
| `agents/[agentId]/runs/[runId]/+page.svelte` | cleanup | no | no | none |
| `agents/new/+page.svelte` | cleanup | no | no | Card, Button, Input, Alert, Badge, Skeleton, Separator |
| `approvals/+page.svelte` | mixed | yes | yes | Card, Badge, Button, Skeleton |
| `approvals/[approvalId]/+page.svelte` | aligned | yes | no | Button, Badge, Card, Separator, Tabs, Textarea |
| `budgets/+page.svelte` | mixed | yes | yes | Card, Badge, Button, Alert, Progress, Skeleton, Separator |
| `costs/+page.svelte` | mixed | yes | yes | Tabs, Skeleton |
| `dashboard/+page.svelte` | cleanup | no | yes | Skeleton, Card, Alert, Progress |
| `documents/+page.svelte` | aligned | yes | no | Card, Badge, Button, Alert, Skeleton, Separator |
| `export/+page.svelte` | mixed | yes | yes | Card, Badge, Button, Progress, Skeleton, Separator, Alert |
| `goals/+page.svelte` | mixed | yes | yes | Card, Badge, Button, Input, Skeleton, Progress |
| `goals/[goalId]/+page.svelte` | aligned | yes | no | Button, Badge, Card, Separator, Tabs |
| `import/+page.svelte` | aligned | yes | no | Card, Badge, Button, Alert, Separator, Skeleton |
| `inbox/+page.svelte` | aligned | yes | no | Badge, Button, Skeleton, Separator |
| `issues/+page.svelte` | aligned | yes | no | Badge, Button, Input, Skeleton, Alert, Separator, Card |
| `issues/[issueId]/+page.svelte` | aligned | yes | no | Button, Badge, Card, Separator, Tabs, Textarea, Input, Alert |
| `issues/mine/+page.svelte` | mixed | yes | no | Alert |
| `issues/new/+page.svelte` | cleanup | no | no | Card, Input, Button, Alert, Separator |
| `labels/+page.svelte` | mixed | yes | yes | Card, Badge, Button, Input, Skeleton, Separator, Alert |
| `members/+page.svelte` | mixed | yes | yes | Card, Badge, Button, Alert, Skeleton, Separator, Avatar |
| `onboarding/+page.svelte` | cleanup | no | no | none |
| `org/+page.svelte` | cleanup | no | no | none |
| `org/chart/+page.svelte` | mixed | yes | no | Skeleton |
| `plugins/+page.svelte` | cleanup | no | no | Badge, Button, Input, Separator, Skeleton, Dialog |
| `plugins/[pluginId]/+page.svelte` | aligned | yes | no | Badge, Button, Card, Separator, Skeleton, Tabs |
| `plugins/[pluginId]/page/+page.svelte` | cleanup | no | no | none |
| `plugins/[pluginId]/settings/+page.svelte` | cleanup | no | no | Badge, Button, Card, Input, Separator, Skeleton, Tabs, Textarea |
| `projects/+page.svelte` | mixed | yes | yes | Card, Badge, Button, Input, Skeleton, Separator |
| `projects/[projectId]/+page.svelte` | aligned | yes | no | Button, Badge, Card, Separator, Tabs |
| `providers/+page.svelte` | aligned | yes | no | Skeleton, Badge, Input, Button |
| `routines/+page.svelte` | mixed | yes | yes | Card, Badge, Button, Input, Skeleton, Alert |
| `routines/[routineId]/+page.svelte` | aligned | yes | no | Button, Badge, Card, Separator, Tabs, Input, Textarea, Select |
| `runs/+page.svelte` | mixed | yes | yes | Card, Badge, Input, Skeleton, Alert |
| `runs/[runId]/+page.svelte` | aligned | yes | no | Card, Badge, Button, Skeleton, Separator |
| `secrets/+page.svelte` | mixed | yes | yes | Card, Badge, Button, Alert, Skeleton, Separator |
| `settings/+page.svelte` | mixed | yes | yes | Card, Badge, Button, Input, Separator, Alert |
| `skills/+page.svelte` | mixed | yes | yes | Badge, Button, Skeleton, Separator |
| `workspaces/+page.svelte` | mixed | yes | no | Button, Badge |
| `workspaces/[workspaceId]/+page.svelte` | aligned | yes | no | Button, Separator, Tabs, Dialog |

## Round 2. Pattern Drift

- The app already uses many shadcn primitives, but the dashboard remains the clearest outlier because it still relies on bespoke `glass-card` surfaces instead of the shared `PageLayout` / Card composition used elsewhere.
- The strongest alignment is on data-heavy routes that already use `PageLayout`, `Card`, `Badge`, `Alert`, `Skeleton`, and other shadcn primitives in predictable combinations.
- The remaining drift is mostly structural, not functional: custom section wrappers, mixed surface styles, and inconsistent action placement rather than missing core components.
- The local UI pro guidance points to data-dense layouts, tabular data presented as tables, and stronger block scaffolding; those are mostly present in the design guide and partially present in runtime pages.

## Round 3. Highest-Leverage Candidates

1. Convert `svelte-ui/src/routes/[companyPrefix]/dashboard/+page.svelte` to `PageLayout` and card-based sections first. This is the biggest single win because it is the only major company page still using a fully custom shell.
2. Keep the `glass-card` effect only as a styling choice on top of `Card` where needed, instead of using raw div wrappers. That preserves the visual direction while standardizing semantics.
3. Add a small dashboard action bar with shadcn `Button` variants for the main flows: agents, issues, costs, approvals.
4. Preserve the current charts and timeline, but wrap each region in `CardHeader` / `CardContent` / `CardDescription` so the page reads like the rest of the app.
5. If a future pass is needed, add table-based layouts to the data-heavy lists; that is the most direct UI Pro Max compliance gain after the dashboard shell is normalized.

## High-Leverage Targets

| Page | Why it matters | Primary fix |
|---|---|---|
| `dashboard/+page.svelte` | missing PageLayout | wrap in PageLayout |
| `+page.svelte` | missing PageLayout | wrap in PageLayout |
| `agents/[agentId]/runs/[runId]/+page.svelte` | missing PageLayout | wrap in PageLayout |
| `onboarding/+page.svelte` | missing PageLayout | wrap in PageLayout |
| `org/+page.svelte` | missing PageLayout | wrap in PageLayout |
| `plugins/[pluginId]/page/+page.svelte` | missing PageLayout | wrap in PageLayout |
| `agents/new/+page.svelte` | missing PageLayout | wrap in PageLayout |
| `issues/new/+page.svelte` | missing PageLayout | wrap in PageLayout |

## Notes

- This audit is intentionally conservative: it flags structural drift and obvious shell inconsistencies, not every visual nuance.
- No files were edited by the audit itself.
- The next implementation pass should target the dashboard and any page that still uses bespoke surface containers for large content blocks.