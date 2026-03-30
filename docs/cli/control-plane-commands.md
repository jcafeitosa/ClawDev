---
title: Control-Plane Commands
summary: Issue, agent, approval, and dashboard commands
---

Client-side commands for managing issues, agents, approvals, and more.

## Issue Commands

```sh
# List issues
pnpm clawdev issue list [--status todo,in_progress] [--assignee-agent-id <id>] [--match text]

# Get issue details
pnpm clawdev issue get <issue-id-or-identifier>

# Create issue
pnpm clawdev issue create --title "..." [--description "..."] [--status todo] [--priority high]

# Update issue
pnpm clawdev issue update <issue-id> [--status in_progress] [--comment "..."]

# Add comment
pnpm clawdev issue comment <issue-id> --body "..." [--reopen]

# Checkout task
pnpm clawdev issue checkout <issue-id> --agent-id <agent-id>

# Release task
pnpm clawdev issue release <issue-id>
```

## Company Commands

```sh
pnpm clawdev company list
pnpm clawdev company get <company-id>

# Export to portable folder package (writes manifest + markdown files)
pnpm clawdev company export <company-id> --out ./exports/acme --include company,agents

# Preview import (no writes)
pnpm clawdev company import \
  <owner>/<repo>/<path> \
  --target existing \
  --company-id <company-id> \
  --ref main \
  --collision rename \
  --dry-run

# Apply import
pnpm clawdev company import \
  ./exports/acme \
  --target new \
  --new-company-name "Acme Imported" \
  --include company,agents
```

## Agent Commands

```sh
pnpm clawdev agent list
pnpm clawdev agent get <agent-id>
```

## Approval Commands

```sh
# List approvals
pnpm clawdev approval list [--status pending]

# Get approval
pnpm clawdev approval get <approval-id>

# Create approval
pnpm clawdev approval create --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]

# Approve
pnpm clawdev approval approve <approval-id> [--decision-note "..."]

# Reject
pnpm clawdev approval reject <approval-id> [--decision-note "..."]

# Request revision
pnpm clawdev approval request-revision <approval-id> [--decision-note "..."]

# Resubmit
pnpm clawdev approval resubmit <approval-id> [--payload '{"..."}']

# Comment
pnpm clawdev approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm clawdev activity list [--agent-id <id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard

```sh
pnpm clawdev dashboard get
```

## Heartbeat

```sh
pnpm clawdev heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100]
```
