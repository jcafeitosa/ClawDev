---
title: Database
summary: Embedded PGlite vs Docker Postgres vs hosted
---

ClawDev uses PostgreSQL via Drizzle ORM. There are three ways to run the database.

## 1. Embedded-compatible local database (Default dev path)

Zero config for `pnpm dev`. If you don't set `DATABASE_URL`, the dev runner boots a local PGlite-backed database automatically so the server can run without an external PostgreSQL process.

```sh
pnpm dev
```

On first start, the server:

1. Creates a local data directory for storage
2. Runs migrations automatically
3. Starts serving requests

Data persists across restarts. To reset, remove the local data directory for your instance.

If you want the legacy embedded PostgreSQL path directly, start the server with `CLAWDEV_DB_RUNTIME` unset and run the server entrypoint rather than the dev runner.

## 2. Local PostgreSQL (Docker)

For a full PostgreSQL server locally:

```sh
docker compose up -d
```

This starts PostgreSQL 17 on `localhost:5432`. Set the connection string:

```sh
cp .env.example .env
# DATABASE_URL=postgres://clawdev:clawdev@localhost:5432/clawdev
```

Push the schema:

```sh
DATABASE_URL=postgres://clawdev:clawdev@localhost:5432/clawdev \
  npx drizzle-kit push
```

## 3. Hosted PostgreSQL (Supabase)

For production, use a hosted provider like [Supabase](https://supabase.com/).

1. Create a project at [database.new](https://database.new)
2. Copy the connection string from Project Settings > Database
3. Set `DATABASE_URL` in your `.env`

Use the **direct connection** (port 5432) for migrations and the **pooled connection** (port 6543) for the application.

If using connection pooling, disable prepared statements:

```ts
// packages/db/src/client.ts
export function createDb(url: string) {
  const sql = postgres(url, { prepare: false });
  return drizzlePg(sql, { schema });
}
```

## Switching Between Modes

| `DATABASE_URL` | Mode |
|----------------|------|
| Not set | Local PGlite dev database via the dev runner |
| `postgres://...localhost...` | Local Docker PostgreSQL |
| `postgres://...supabase.com...` | Hosted Supabase |

The Drizzle schema (`packages/db/src/schema/`) is the same regardless of mode.
