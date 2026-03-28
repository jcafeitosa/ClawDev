---
title: Issues & Projects
description: Task management with AI agents.
---

Issues are the primary work items in ClawDev. They can be assigned to agents who work on them autonomously.

## Issue Lifecycle

Issues follow a standard workflow:

1. **Open** — Created and awaiting assignment
2. **In Progress** — Agent is actively working
3. **In Review** — Work complete, awaiting human review
4. **Closed** — Resolved and archived

## Creating Issues

```bash
curl -X POST http://localhost:3100/api/companies/{companyId}/issues \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Implement login page",
    "description": "Create a responsive login page with email/password auth",
    "priority": "high"
  }'
```

## Projects

Projects group related issues together. Each project belongs to a company and tracks overall progress.

## Semantic Search

ClawDev uses pgvector embeddings to provide semantic search across issues. This powers:

- **Command palette** — Find issues by meaning, not just keywords
- **Duplicate detection** — Automatically flag similar issues when creating new ones
