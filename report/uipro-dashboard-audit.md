# ClawDev UI Pro Max Audit

- Generated: 2026-04-06T11:57:29.717Z
- Scope: svelte-ui/src/routes/[companyPrefix]
- Pages analyzed: 40

## Round 1 - Inventory

| Page | Layout | Glass | Cards | Sections | Buttons | Alerts | Tables |
|---|---:|---:|---:|---:|---:|---:|---:|
| [companyPrefix]/agents/[agentId]/+page.svelte | yes    | no    | 18    | 0        | 28      | 0      | 0      |
| [companyPrefix]/issues/[issueId]/+page.svelte | yes    | no    | 18    | 0        | 38      | 1      | 0      |
| [companyPrefix]/plugins/[pluginId]/+page.svelte | yes    | no    | 9     | 0        | 9       | 0      | 0      |
| [companyPrefix]/routines/[routineId]/+page.svelte | yes    | no    | 6     | 0        | 13      | 0      | 0      |
| [companyPrefix]/projects/[projectId]/+page.svelte | yes    | no    | 5     | 0        | 17      | 0      | 0      |
| [companyPrefix]/approvals/[approvalId]/+page.svelte | yes    | no    | 4     | 0        | 5       | 0      | 0      |
| [companyPrefix]/documents/+page.svelte     | yes    | no    | 5     | 0        | 3       | 0      | 0      |
| [companyPrefix]/goals/[goalId]/+page.svelte | yes    | no    | 3     | 0        | 7       | 0      | 0      |
| [companyPrefix]/import/+page.svelte        | yes    | no    | 4     | 0        | 4       | 1      | 0      |
| [companyPrefix]/plugins/[pluginId]/settings/+page.svelte | no     | no    | 13    | 0        | 4       | 0      | 0      |
| [companyPrefix]/issues/+page.svelte        | yes    | no    | 2     | 0        | 2       | 1      | 0      |
| [companyPrefix]/providers/+page.svelte     | yes    | no    | 0     | 0        | 4       | 0      | 0      |
| [companyPrefix]/workspaces/[workspaceId]/+page.svelte | yes    | no    | 0     | 0        | 7       | 0      | 0      |
| [companyPrefix]/agents/+page.svelte        | yes    | yes   | 2     | 0        | 1       | 1      | 0      |
| [companyPrefix]/projects/+page.svelte      | yes    | yes   | 2     | 0        | 4       | 0      | 0      |
| [companyPrefix]/export/+page.svelte        | yes    | yes   | 1     | 0        | 1       | 1      | 0      |
| [companyPrefix]/goals/+page.svelte         | yes    | yes   | 1     | 0        | 4       | 0      | 0      |
| [companyPrefix]/members/+page.svelte       | yes    | yes   | 1     | 0        | 1       | 3      | 0      |

- Dashboard: PageLayout missing, glass-card heavy
- Missing PageLayout in company pages: 9
- Glass-card usage in company pages: 15

## Round 2 - Shadcn / UUPM Mapping

- Strong coverage: Button, Badge, Card, Alert, Skeleton, Separator, Avatar, Tabs, Command, Dialog, DropdownMenu, Select.
- Weak coverage: dashboard still leans on custom glass-card surfaces instead of shadcn Card compound layout.
- Design system gap: the repo's generated dashboard style emphasizes data-dense dashboards, while the current dashboard mixes that with custom glass panels and only partial shadcn semantics.
- Implementation gap: most pages already have PageLayout, but the dashboard does not, so the header/actions pattern is inconsistent.
- UUPM mismatch to verify: global typography remains Plus Jakarta Sans in app.css, while the generated design system suggests dashboard-optimized Fira Sans/Fira Code.

## Round 3 - Implementation Opportunities

1. Wrap the dashboard in `PageLayout` so title, description, and actions are standardized.
2. Replace raw `glass-card` sections with `Card` + `CardHeader` + `CardContent` where possible, especially metrics and recent activity blocks.
3. Promote the top summary into a shadcn-style action bar: status badge, quick links, and inline CTA buttons.
4. Keep the chart panels dense, but move them into semantically named cards to align with the dashboard pattern used elsewhere.
5. If typography is part of the UUPM requirement, decide whether to keep Plus Jakarta Sans or scope the Fira stack to the dashboard only.

### High-value pages with the same pattern to standardize

- [companyPrefix]/agents/[agentId]/+page.svelte: Button, Badge, Card, CardHeader, CardTitle, CardContent, Separator, Tabs, +4 more
- [companyPrefix]/issues/[issueId]/+page.svelte: Button, Badge, Card, CardHeader, CardTitle, CardContent, Alert, Separator, +7 more
- [companyPrefix]/plugins/[pluginId]/+page.svelte: Button, Badge, Card, CardHeader, CardTitle, CardDescription, CardContent, Skeleton, +5 more
- [companyPrefix]/routines/[routineId]/+page.svelte: Button, Badge, Card, CardHeader, CardTitle, CardContent, Separator, Tabs, +5 more
- [companyPrefix]/projects/[projectId]/+page.svelte: Button, Badge, Card, CardHeader, CardTitle, CardContent, Separator, Tabs, +3 more
- [companyPrefix]/approvals/[approvalId]/+page.svelte: Button, Badge, Card, CardContent, Separator, Tabs, TabsList, TabsTrigger, +2 more
- [companyPrefix]/documents/+page.svelte: Button, Badge, Card, CardHeader, CardTitle, CardContent, Skeleton
- [companyPrefix]/goals/[goalId]/+page.svelte: Button, Badge, Card, CardHeader, CardTitle, CardContent, Separator, Tabs, +3 more
- [companyPrefix]/import/+page.svelte: Button, Card, CardHeader, CardTitle, CardContent, Alert, AlertTitle, AlertDescription, +1 more
- [companyPrefix]/issues/+page.svelte: Button, Badge, Card, Skeleton, Alert, AlertTitle, AlertDescription, Separator, +1 more
- [companyPrefix]/providers/+page.svelte: Button, Skeleton, Tabs, TabsList, TabsTrigger, TabsContent, Input
- [companyPrefix]/workspaces/[workspaceId]/+page.svelte: Button, Separator, Tabs, TabsList, TabsTrigger, TabsContent, Dialog