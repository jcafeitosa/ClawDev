---
title: Environment Variables
description: Complete reference for all ClawDev environment variables.
---

## Server

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DATABASE_URL` | string | — | PostgreSQL connection string |
| `REDIS_URL` | string | — | Redis connection for BullMQ queues |
| `BETTER_AUTH_SECRET` | string | — | Session encryption key (required in prod) |
| `PORT` | number | `3100` | HTTP server port |
| `HOST` | string | `0.0.0.0` | Bind address |
| `NODE_ENV` | string | `development` | Environment mode |
| `SERVE_UI` | boolean | `true` | Serve built UI from server |
| `OPENAI_API_KEY` | string | — | For embedding generation (semantic search) |

## Deployment

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PAPERCLIP_DEPLOYMENT_MODE` | string | `local_trusted` | Auth mode |
| `PAPERCLIP_DEPLOYMENT_EXPOSURE` | string | `private` | Network exposure |
| `PAPERCLIP_PUBLIC_URL` | string | `http://localhost:3100` | Public-facing URL |
| `PAPERCLIP_HOME` | string | `/paperclip` | Data directory |
| `PAPERCLIP_INSTANCE_ID` | string | `default` | Multi-instance ID |
| `PAPERCLIP_CONFIG` | string | — | Config file path |

## LLM Adapters

| Variable | Type | Description |
|----------|------|-------------|
| `ANTHROPIC_API_KEY` | string | Claude API access |
| `OPENAI_API_KEY` | string | OpenAI API access |
| `GOOGLE_API_KEY` | string | Gemini API access |
