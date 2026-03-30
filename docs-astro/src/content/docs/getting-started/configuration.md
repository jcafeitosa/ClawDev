---
title: Configuration
description: Environment variables and configuration options.
---

ClawDev is configured via environment variables. All settings have sensible defaults for local development.

## Required Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://localhost:5432/clawdev` |
| `BETTER_AUTH_SECRET` | Auth session encryption key | (required in production) |

## Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3100` |
| `HOST` | Bind address | `0.0.0.0` |
| `REDIS_URL` | Redis connection string | (optional, enables BullMQ) |
| `OPENAI_API_KEY` | For semantic search embeddings | (optional) |
| `SERVE_UI` | Serve SvelteKit UI from server | `true` |
| `CLAWDEV_DEPLOYMENT_MODE` | `local_trusted` or `authenticated` | `local_trusted` |
| `CLAWDEV_DEPLOYMENT_EXPOSURE` | `private` or `public` | `private` |
| `CLAWDEV_HOME` | Data directory | `~/.clawdev` |

## Deployment Modes

- **`local_trusted`** — No authentication required. Suitable for local development and single-user setups.
- **`authenticated`** — Requires login via better-auth. Supports multiple users with RBAC.
