---
title: Docker
description: Self-hosting ClawDev with Docker.
---

ClawDev provides official Docker images for easy self-hosting.

## Docker Compose (Recommended)

The included `docker-compose.yml` sets up everything you need:

- **PostgreSQL** with TimescaleDB extension
- **Redis** for job queues (BullMQ)
- **ClawDev server** with UI

```bash
# Set required secret
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)

# Start all services
docker compose up -d

# View logs
docker compose logs -f server
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| `server` | 3100 | ClawDev API + UI |
| `db` | 5432 | TimescaleDB (PostgreSQL 17) |
| `redis` | 6379 | Redis 7 |

## Volumes

| Volume | Purpose |
|--------|---------|
| `pgdata` | PostgreSQL data |
| `redisdata` | Redis persistence |
| `clawdev-data` | ClawDev config and plugin data |

## Updating

```bash
docker compose pull
docker compose up -d
```

Database migrations run automatically on startup.
