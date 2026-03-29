# Bun Runtime Compatibility Report

> Generated: 2026-03-27 — ClawDev Migration Fase 3

## Summary

| Package | Compatible? | Risk | Action |
|---|---|---|---|
| child_process (fork) | Partial | Medium | Test IPC with JSON serialization |
| better-auth v1.4.18 | Partial | Medium | Use postgres driver, not bun-sqlite |
| drizzle-orm v0.38.4 | Yes | Low | Works out of the box |
| ws v8.19.0 | Yes | Low | Bun includes built-in polyfill |
| embedded-postgres | No | High | Keep on Node for dev only |
| sharp v0.34.5 | Partial | Medium | May need `--force` install |
| multer v2.0.2 | No | High | Replace with Elysia native uploads |
| Express v5.1.0 | Yes | Low | ~3x faster on Bun |
| pino v9.6.0 | Partial | Low | Works without pino-pretty |
| chokidar v4.0.3 | No | High | Replace with Bun.file().watch() |

## Blockers

1. **multer** — `req.file` returns `undefined` on Bun. Resolved by Elysia migration (native multipart handling).
2. **chokidar** — `fs.watch` crashes on Bun. Replace with `Bun.file().watch()` or Bun native `--watch`.
3. **embedded-postgres** — Dev-only dependency. Keep running under Node.js for local dev.

## Workarounds

- **pino-pretty**: Use `bun-plugin-pino` for correct bundling, or use JSON output in production.
- **sharp**: Install with `bun install --force` if initial install fails.
- **child_process.fork**: Use `serialization: "json"` for Bun-to-Node IPC.
- **better-auth**: Test full auth flow with postgres driver before switching runtime.

## Migration Order

1. Replace chokidar with Bun native file watching
2. Replace multer with Elysia multipart (part of Express→Elysia migration)
3. Configure pino for JSON-only output in Bun
4. Test child_process.fork IPC with plugin workers
5. Validate better-auth + postgres driver on Bun
6. Keep embedded-postgres on Node (dev scripts only)
