---
title: Companies
description: Managing agent companies in ClawDev.
---

Companies are the top-level organizational unit in ClawDev. Each company contains its own agents, issues, projects, goals, and settings.

## Creating a Company

Use the API or dashboard to create a new company:

```bash
curl -X POST http://localhost:3100/api/companies \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme AI", "description": "Automated customer support team"}'
```

## Company Settings

Each company can configure:

- **Branding** — Logo, colors, display name
- **Agent limits** — Max concurrent agents
- **Cost budgets** — Monthly spend caps per agent or company-wide
- **Secrets** — API keys and credentials available to agents

## Archiving

Companies can be archived (soft-deleted) to preserve history while removing them from active views.
