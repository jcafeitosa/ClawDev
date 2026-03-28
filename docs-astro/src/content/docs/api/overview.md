---
title: API Overview
description: ClawDev REST API reference.
---

ClawDev exposes a REST API under the `/api` prefix. All endpoints return JSON.

## Authentication

- **Local trusted mode** — No auth required
- **Authenticated mode** — Session cookie or Bearer token

## Base URL

```
http://localhost:3100/api
```

## Endpoints

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server status and version |

### Companies

| Method | Path | Description |
|--------|------|-------------|
| GET | `/companies` | List all companies |
| GET | `/companies/:id` | Get company details |
| POST | `/companies` | Create company |
| PATCH | `/companies/:id` | Update company |

### Agents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/companies/:id/agents` | List agents |
| GET | `/agents/:id` | Get agent details |
| POST | `/companies/:id/agents` | Hire agent |
| POST | `/agents/:id/pause` | Pause agent |
| POST | `/agents/:id/resume` | Resume agent |
| POST | `/agents/:id/terminate` | Terminate agent |

### Issues

| Method | Path | Description |
|--------|------|-------------|
| GET | `/companies/:id/issues` | List issues |
| GET | `/issues/:id` | Get issue details |
| POST | `/companies/:id/issues` | Create issue |
| PATCH | `/issues/:id` | Update issue |

### Search

| Method | Path | Description |
|--------|------|-------------|
| GET | `/search/companies/:id/semantic?q=` | Semantic search |
| POST | `/search/companies/:id/similar-issues` | Find duplicates |

### Plugins

| Method | Path | Description |
|--------|------|-------------|
| GET | `/plugins` | List plugins |
| POST | `/plugins/install` | Install plugin |
| POST | `/plugins/:id/enable` | Enable plugin |
| POST | `/plugins/:id/disable` | Disable plugin |

## Type-Safe Client

Use Eden Treaty for a fully typed API client:

```typescript
import { treaty } from "@elysiajs/eden";
import type { App } from "@clawdev/server/eden-treaty";

const api = treaty<App>("localhost:3100");
const { data } = await api.api.health.get();
```
