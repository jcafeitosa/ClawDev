# ClawDev Backend Migration Analysis: Node.js → Bun + Elysia + Redis/BullMQ + TimescaleDB

## Executive Summary

ClawDev is a sophisticated multi-agent orchestration platform with complex scheduling, real-time events, plugin management, and workspace execution capabilities. The migration requires addressing Node.js-specific APIs, Express-specific patterns, in-memory state management, and database optimization opportunities.

---

## 1. DEPENDENCY ANALYSIS

### 1.1 Server Package.json (server/package.json)

**Core Runtime Dependencies:**
- `express@^5.1.0` - HTTP server framework (requires replacement with Elysia)
- `ws@^8.19.0` - WebSocket implementation (compatible with Bun, but may need Elysia integration)
- `pino@^9.6.0` - Logging framework (Bun-compatible, but Elysia has native logging)
- `pino-http@^10.4.0` - HTTP logging middleware (Express-specific, needs adaptation)
- `multer@^2.0.2` - File upload middleware (Express-specific, needs replacement)

**Database & ORM:**
- `drizzle-orm@^0.38.4` - PostgreSQL ORM (Bun-compatible, no changes needed)
- `postgres@^3.4.5` - PostgreSQL driver (Bun-compatible via postgres-js)
- `embedded-postgres@^18.1.0-beta.16` - Embedded PostgreSQL (Node.js-based)

**Infrastructure:**
- `better-auth@1.4.18` - Authentication framework (Node.js-specific, requires evaluation)
- `aws-sdk/client-s3@^3.888.0` - S3 client (Bun-compatible)
- `sharp@^0.34.5` - Image processing (native bindings, Bun-compatible)
- `chokidar@^4.0.3` - File watching (Bun has native file watcher)
- `detect-port@^2.1.0` - Port detection (Bun-compatible)
- `dotenv@^17.0.1` - Environment config (Bun built-in support)
- `open@^11.0.0` - Open browser (Platform-specific, may need adaptation)

**Schema & Validation:**
- `ajv@^8.18.0`, `ajv-formats@^3.0.1` - JSON Schema validation (Bun-compatible)
- `zod@^3.24.2` - Schema validation (Bun-compatible)

**DOM/HTML:**
- `dompurify@^3.3.2` - HTML sanitization (Bun-compatible)
- `jsdom@^28.1.0` - DOM implementation (Bun-compatible, but heavy)

### 1.2 Database Package.json (packages/db/package.json)

**Key Dependencies:**
- `drizzle-orm@^0.38.4` - ORM (Bun-compatible)
- `drizzle-kit@^0.31.9` - Migration/schema tooling (Bun-compatible)
- `postgres@^3.4.5` - PostgreSQL driver (Bun-compatible)
- `embedded-postgres@^18.1.0-beta.16` - Embedded PostgreSQL (Node.js-specific)

---

## 2. NODE.JS-SPECIFIC APIs FOUND

### 2.1 Child Process Management (CRITICAL)
**Files:** `server/src/services/heartbeat.ts`, `server/src/services/plugin-worker-manager.ts`

- `execFileCallback` from `node:child_process` (used via `promisify`)
- `fork()` from `node:child_process` (plugin worker spawning)
- `ChildProcess` type from `node:child_process`
- Process lifecycle management (stdio, SIGTERM, SIGKILL)

**Migration Impact:** High
- Bun has different child process APIs
- Plugin worker model uses `fork()` with JSON-RPC over stdio
- Needs careful refactoring or use of Bun worker threads

### 2.2 File System APIs
**Files:** Multiple (heartbeat.ts, app.ts, index.ts)

- `fs/promises` for async file operations
- `fs.readFileSync()`, `fs.writeFileSync()`, `fs.existsSync()`
- `fs.rmSync()` (used in index.ts for cleanup)
- Path manipulation with `node:path`

**Migration Impact:** Low
- Bun supports Node.js `fs` module compatibility
- Can use as-is with minimal changes

### 2.3 Stream/Readline APIs
**Files:** `server/src/realtime/live-events-ws.ts`, `server/src/services/plugin-worker-manager.ts`

- `createInterface()` from `node:readline` (stdin/stdout)
- `readline/promises` (async readline)
- `Duplex` stream type from `node:stream`
- `IncomingMessage` from `node:http`

**Migration Impact:** Medium
- Bun supports readline but plugin worker communication may need adjustment
- HTTP/WebSocket upgrade handling differs from Node.js

### 2.4 Timers & Process Management
**Files:** Throughout services

```
setInterval() - plugin-job-scheduler.ts, plugin-host-services.ts, plugin-log-retention.ts
setTimeout() - multiple services
setImmediate() - implicit in event loop
process.once('exit') - app.ts
process.once('beforeExit') - app.ts
```

**Migration Impact:** Low
- Bun supports all standard timer APIs
- process.once() events work in Bun

### 2.5 VM Module
**Files:** `server/src/services/plugin-runtime-sandbox.ts`

- `vm.createContext()` (plugin sandboxing)
- Script execution in sandboxed contexts

**Migration Impact:** Medium
- Bun supports `vm` module
- Plugin capability validation still works

### 2.6 Crypto
**Files:** `packages/db/src/client.ts`, `server/src/realtime/live-events-ws.ts`

- `createHash()` from `node:crypto` (migration history, token hashing)

**Migration Impact:** Low
- Bun has crypto support and can use Node.js API

### 2.7 Module Resolution
**Files:** `server/src/services/plugin-runtime-sandbox.ts`, `server/src/realtime/live-events-ws.ts`

- `fileURLToPath()` from `node:url` (ESM file resolution)
- `createRequire()` from `node:module` (for ws package dynamic import)
- `import.meta.url` (ESM)

**Migration Impact:** Low
- Bun fully supports ESM and these APIs

---

## 3. EXPRESS-SPECIFIC PATTERNS

### 3.1 Middleware Stack (app.ts)

```typescript
app.use(express.json())           // JSON body parser
app.use(httpLogger)               // HTTP request logging
app.use(privateHostnameGuard)     // Custom hostname validation
app.use(actorMiddleware)          // Auth/actor context
app.use(errorHandler)             // Global error handler
```

**Elysia Equivalents:**
- `body()` hook for JSON parsing
- `onAfterResponse` or custom logging hook
- `guard` for hostname validation
- `guard` or `hook` for actor context
- Error handler (built-in)

### 3.2 Route Registration Pattern (app.ts:131-220)

```typescript
const api = Router()
api.use(boardMutationGuard())
api.use("/health", healthRoutes(db))
api.use("/companies", companyRoutes(db, storageService))
// ... 10+ route groups
app.use("/api", api)
```

**Migration:** Elysia's prefix and grouping:
```typescript
const api = new Elysia({ prefix: '/api' })
  .use(boardMutationGuard())
  .use(healthRoutes(db))
  .use(companyRoutes(db, storageService))
  // ... etc
```

### 3.3 Static File Serving (app.ts:238-253)

```typescript
app.use(express.static(uiDist))
app.get(/.*/, (_req, res) => {
  res.status(200).set("Content-Type", "text/html").end(indexHtml)
})
```

**Elysia Equivalent:** `static()` plugin

### 3.4 Vite Middleware Integration (app.ts:256-284)

```typescript
const vite = await createViteServer()
app.use(vite.middlewares)
app.get(/.*/, async (req, res, next) => {
  const html = await vite.transformIndexHtml()
  res.status(200).set({ "Content-Type": "text/html" }).end(html)
})
```

**Migration Consideration:** Vite dev server can proxy to Elysia

### 3.5 WebSocket Upgrade (index.ts)

```typescript
const server = createServer(app)
setupLiveEventsWebSocketServer(server, db, opts)
server.on('upgrade', (req, socket, head) => { ... })
```

**Migration:** Elysia has native WebSocket support via `.ws()` route

---

## 4. DATABASE ARCHITECTURE ANALYSIS

### 4.1 Current Schema (59 schema files)

**Tables Suitable for TimescaleDB Hypertables:**

1. **heartbeat_run_events** (high-volume time-series)
   - `bigserial` ID (11M+ rows expected)
   - Indexed by `(runId, seq)`, `(companyId, runId)`, `(companyId, createdAt)`
   - Perfect candidate for hypertable with `createdAt` as time column

2. **cost_events** (financial time-series)
   - Indexed by `(companyId, occurredAt)`, `(companyId, agent, occurredAt)`
   - Time column: `occurredAt` with timezone
   - High cardinality: provider, biller, model

3. **activity_log** (audit trail)
   - Indexed by `(companyId, createdAt)`, `(entityType, entityId)`
   - Time column: `createdAt`
   - Growing log table ideal for compression

4. **plugin_job_runs** (job execution history)
   - Indexed by status and job ID
   - Time columns: `startedAt`, `finishedAt`, `createdAt`

5. **finance_events** (related to cost_events)
   - Likely similar structure

**Regular Tables (59 total, ~50+ are regular):**
- Entity tables: agents, companies, projects, issues, goals, documents, plugins, etc.
- Join tables: labels, memberships, permissions, configurations
- State tables: agent_runtime_state, plugin_state, workspace_runtime_services

### 4.2 Database Client Implementation (packages/db/src/client.ts)

**Current Approach:**
- Uses `postgres-js` driver directly via Drizzle
- Custom migration management (not using Drizzle's auto-migrator due to issues)
- Embedded PostgreSQL support for local development

**Key Functions:**
- `createDb(url)` - Returns Drizzle instance
- `applyPendingMigrations(url)` - Manual migration runner
- `reconcilePendingMigrationHistory(url)` - Migration state repair
- `migratePostgresIfEmpty(url)` - Bootstrap for fresh databases

**Migration Compatibility:**
- Uses `postgres-js` which is Bun-compatible
- Drizzle-orm is Bun-compatible
- Migration system doesn't depend on Node.js APIs

### 4.3 Migration System (46 SQL files in migrations/)

**Current System:**
- Drizzle-based SQL migrations
- Manual statement execution (custom runner)
- Hash-based change detection
- Journal-based ordering

**TimescaleDB Considerations:**
- Add migrations for creating hypertables (after base table creation)
- Enable compression on old partitions
- Add continuous aggregates for cost/activity summaries

---

## 5. SCHEDULING & JOB MANAGEMENT

### 5.1 Cron System (server/src/services/cron.ts)

**Status:** Fully JavaScript-based, zero Node.js dependencies
- Parses 5-field cron expressions
- Calculates next run times
- No external libraries needed

**Migration:** Can be used as-is or ported to Bun module

### 5.2 Plugin Job Scheduler (plugin-job-scheduler.ts)

**Current Implementation:**
```
setInterval(() => {
  // Tick every 30 seconds
  // Query plugin_jobs table for nextRunAt <= now
  // Dispatch runJob RPC calls to worker processes
  // Record execution in plugin_job_runs
}, 30_000)
```

**Issues with Current Approach:**
- Single setInterval timer (not distributed)
- In-memory state for concurrent job tracking
- Worker dispatch via RPC on stdio

**Replacement Strategy (BullMQ):**
- Use Redis job queue instead of database polling
- Each job has automatic retry logic
- Built-in scheduling with cron expressions
- Atomic job transitions (pending→active→completed)
- Visibility into queue metrics

### 5.3 Heartbeat Service (heartbeat.ts)

**Current Flow:**
1. Agent triggers heartbeat (manual or scheduled)
2. Lock prevents concurrent runs (via `startLocksByAgent` Map)
3. Spawns adapter process via `execFile()`
4. Captures stderr, stdout, exit code
5. Records events to `heartbeat_run_events` table
6. Publishes live events

**Challenges for Migration:**
- Heavy use of `execFile()` and child process management
- Process resource monitoring
- Log capture and persistence

**Replacement Strategy:**
- Keep heartbeat spawning as-is (Bun `spawn()`)
- Replace event publishing with Redis Pub/Sub
- Keep database recording (works with TimescaleDB)

### 5.4 Plugin Worker Manager (plugin-worker-manager.ts)

**Current Architecture:**
```
fork() child process per plugin
↓
stdin/stdout JSON-RPC communication
↓
Automatic restart on crash with exponential backoff
```

**Bun Equivalent:**
- Use Bun worker threads or subprocess
- JSON-RPC protocol stays the same
- Backoff logic reusable

---

## 6. REAL-TIME EVENT SYSTEM

### 6.1 Live Events Service (live-events.ts)

**Current Implementation:**
```typescript
const emitter = new EventEmitter()

publishLiveEvent({
  companyId: "company-123",
  type: "heartbeat_started",
  payload: {...}
})

subscribeCompanyLiveEvents(companyId, listener)
```

**Issues:**
- In-memory EventEmitter only (single process)
- Not suitable for distributed systems
- No persistence or replay

**Replacement Strategy (Redis Pub/Sub):**
```typescript
redis.publish(`company:${companyId}:events`, JSON.stringify(event))
redis.subscribe(`company:${companyId}:events`)
```

### 6.2 WebSocket Handler (live-events-ws.ts)

**Current Implementation:**
```
HTTP Upgrade request
↓ Authorization & context extraction
↓ WebSocket upgrade via ws library
↓ Subscribe to company events
↓ Forward events to client
```

**Key Functions:**
- `parseCompanyId()` from URL path
- `parseBearerToken()` from Authorization header
- Database auth verification
- `subscribeCompanyLiveEvents()` listener attachment

**Migration to Elysia:**
```typescript
app.ws('/api/companies/:companyId/events/ws', {
  open(ws) { /* auth & subscribe */ },
  message(ws, msg) { /* handle */ },
  close(ws) { /* cleanup */ },
})
```

**Note:** Still needs Redis Pub/Sub for event distribution

---

## 7. IN-MEMORY STATE MANAGEMENT ISSUES

### Current State Stores (Problematic for Scaling)

1. **`startLocksByAgent` Map** (heartbeat.ts:66)
   - Prevents concurrent heartbeat runs per agent
   - In-memory (lost on restart)
   - Not distributed

2. **`pluginJobScheduler` tick state** (plugin-job-scheduler.ts)
   - Concurrent job counter
   - Backoff timers
   - Next run calculations

3. **`pluginWorkerManager` state** (plugin-worker-manager.ts)
   - Worker process references
   - Pending RPC calls Map
   - Backoff timers per worker

4. **`EventEmitter` (live-events.ts)**
   - In-memory event subscriptions
   - No persistence

5. **`pluginDevWatcher` file timers** (plugin-dev-watcher.ts)
   - Debounce timers

### Migration Strategy

| Component | Current | Replacement |
|-----------|---------|-------------|
| Heartbeat locks | Map | Redis SETNX or Drizzle row locks |
| Job scheduling | setInterval + DB poll | BullMQ |
| Job concurrency control | In-memory counter | BullMQ concurrency settings |
| Event distribution | EventEmitter | Redis Pub/Sub |
| Worker process refs | Map | Subprocess management (local) |
| Backoff timers | setTimeout | BullMQ retry logic |

---

## 8. PLUGIN ARCHITECTURE ANALYSIS

### 8.1 Plugin Manifest & Schema (plugin_jobs.ts)

**Job Declaration:**
```typescript
{
  id: uuid (primary)
  pluginId: uuid (FK to plugins)
  jobKey: text (identifier in manifest)
  schedule: text (cron expression)
  status: "active" | "paused" | "error"
  lastRunAt: timestamp
  nextRunAt: timestamp (pre-computed)
  createdAt, updatedAt: timestamp
}

// With indexes:
// - plugin_jobs_plugin_idx on (pluginId)
// - plugin_jobs_next_run_idx on (nextRunAt)  ← Critical for scheduler query
// - plugin_jobs_unique_idx on (pluginId, jobKey)
```

**Job Runs:**
```typescript
{
  id: uuid
  jobId: uuid (FK)
  pluginId: uuid (denormalized)
  trigger: "scheduled" | "manual"
  status: "pending" | "queued" | "running" | "succeeded" | "failed" | "cancelled"
  durationMs: integer
  error: text
  logs: jsonb array
  startedAt, finishedAt, createdAt: timestamp
}

// With indexes:
// - plugin_job_runs_job_idx on (jobId)
// - plugin_job_runs_plugin_idx on (pluginId)
// - plugin_job_runs_status_idx on (status)
```

**TimescaleDB Consideration:** `plugin_job_runs` could be hypertable with time column

### 8.2 Plugin Sandbox (plugin-runtime-sandbox.ts)

**Security Model:**
- VM context isolation via `vm.createContext()`
- Module allow-listing (only specified imports allowed)
- Timeout enforcement (2s default)
- Path boundary checking (prevent escape from plugin root)

**Migration:** Bun's `vm` module is compatible

### 8.3 Plugin Worker Model (plugin-worker-manager.ts)

**Process Model:**
```
Host Process (Elysia server)
  ↓ fork() [per plugin]
Worker Process (Node.js/Bun)
  ↓ stdin/stdout JSON-RPC 2.0
  ↓ Lifecycle: start → running → crash/stop
```

**Bun Compatibility Issues:**
- `fork()` returns `ChildProcess` (Node.js specific)
- Bun has `Bun.spawnSync()` and async spawn alternatives
- May need wrapper for API compatibility

---

## 9. AUTHENTICATION & AUTHORIZATION

### 9.1 better-auth Integration (auth/better-auth.ts)

**Status:** Used for session management
- Requires evaluation for Bun compatibility
- If not compatible, consider alternatives:
  - `@auth/core` (framework-agnostic)
  - Lucia Auth
  - NextAuth.js (if using Next.js for frontend)

**Impact:** Potentially major refactor if not Bun-compatible

---

## 10. SUMMARY: MIGRATION REQUIREMENTS

### High Priority (Blocking)

1. **Express → Elysia**
   - 131-290 lines in app.ts
   - 15+ route files to adapt
   - Middleware pattern conversion

2. **Child Process Management**
   - heartbeat.ts: execFile() usage
   - plugin-worker-manager.ts: fork() usage
   - Requires Bun subprocess API learning

3. **WebSocket Integration**
   - Current: ws library + HTTP server
   - Target: Elysia native .ws() routes
   - 100+ lines in live-events-ws.ts

4. **better-auth Compatibility**
   - Unknown compatibility with Bun
   - May require authentication framework swap

### Medium Priority (Significant Work)

1. **Event System Refactor**
   - EventEmitter → Redis Pub/Sub
   - Affects live-events.ts, heartbeat.ts, services

2. **Job Scheduler Refactor**
   - setInterval/database polling → BullMQ
   - Plugin job scheduler (80+ lines)
   - Plugin job coordinator (50+ lines)

3. **In-Memory Locks**
   - Map-based locks → Redis locks or DB
   - Distributed heartbeat state

4. **Plugin Worker RPC**
   - Evaluate Bun fork() compatibility
   - May need stdio wrapper

### Low Priority (Nice to Have)

1. **Database Optimization**
   - Convert heartbeat_run_events → hypertable
   - Convert cost_events → hypertable
   - Add compression policies
   - Add continuous aggregates for analytics

2. **File System APIs**
   - Already Bun-compatible
   - Can be updated incrementally

3. **Logging Stack**
   - Replace pino/pino-http → Elysia native logging
   - Non-blocking refactor

---

## 11. DETAILED MIGRATION ROADMAP

### Phase 1: Foundation
- [ ] Verify better-auth Bun compatibility or choose replacement
- [ ] Set up Bun project structure
- [ ] Implement Elysia server with basic routing
- [ ] Migrate database layer (already compatible)
- [ ] Set up PostgreSQL with TimescaleDB extension

### Phase 2: Core Server
- [ ] Migrate all route files (15+ files)
- [ ] Implement middleware pattern
- [ ] Migrate error handling
- [ ] Implement static file serving
- [ ] Integrate Vite dev server

### Phase 3: Real-Time & Events
- [ ] Set up Redis connection
- [ ] Migrate live-events.ts to Redis Pub/Sub
- [ ] Implement Elysia WebSocket routes
- [ ] Test subscription model

### Phase 4: Job Scheduling
- [ ] Set up BullMQ
- [ ] Migrate plugin-job-scheduler.ts
- [ ] Migrate plugin-job-coordinator.ts
- [ ] Implement retry/backoff via BullMQ
- [ ] Test cron expressions

### Phase 5: Process Management
- [ ] Evaluate Bun fork() compatibility
- [ ] Migrate plugin-worker-manager.ts
- [ ] Test plugin spawn/lifecycle
- [ ] Verify JSON-RPC communication

### Phase 6: Database Optimization
- [ ] Create TimescaleDB hypertable migrations
- [ ] Set up compression policies
- [ ] Implement continuous aggregates
- [ ] Test time-series queries

### Phase 7: Testing & Hardening
- [ ] Unit test all services
- [ ] Integration tests
- [ ] Load testing
- [ ] Distributed deployment testing

---

## 12. ESTIMATED EFFORT

| Component | Effort | Risk |
|-----------|--------|------|
| Express → Elysia | 40 hours | Medium |
| Child process management | 20 hours | High |
| WebSocket upgrade | 15 hours | Medium |
| Redis/BullMQ integration | 30 hours | Medium |
| better-auth replacement (if needed) | 20-40 hours | High |
| Plugin worker refactor | 20 hours | High |
| Database → TimescaleDB | 15 hours | Low |
| Testing & hardening | 40 hours | Medium |
| **Total** | **200-240 hours** | |

---

## 13. KEY FILES REFERENCE

**App Setup:**
- `/server/src/app.ts` (320 lines)
- `/server/src/index.ts` (350+ lines)

**Database:**
- `/packages/db/src/client.ts` (780 lines)
- `/packages/db/src/schema/` (59 files)
- `/packages/db/src/migrations/` (46 SQL files)

**Services:**
- `/server/src/services/heartbeat.ts` (1200+ lines)
- `/server/src/services/plugin-worker-manager.ts` (400+ lines)
- `/server/src/services/plugin-job-scheduler.ts` (200+ lines)
- `/server/src/services/plugin-job-coordinator.ts` (100+ lines)
- `/server/src/services/live-events.ts` (55 lines)
- `/server/src/services/plugin-runtime-sandbox.ts` (200+ lines)

**Routes:**
- `/server/src/routes/` (15+ route files)

**Real-time:**
- `/server/src/realtime/live-events-ws.ts` (200+ lines)

---

## 14. CRITICAL COMPATIBILITY NOTES

1. **Embedded PostgreSQL**: `embedded-postgres` is Node.js-based. For production Bun, use standalone PostgreSQL.

2. **better-auth**: Requires explicit verification. Check https://github.com/better-auth/better-auth for Bun support status.

3. **sharp**: Has native bindings but is Bun-compatible.

4. **jsdom**: Heavy DOM implementation. Consider if truly needed; may have alternatives for Bun.

5. **Bun's `Bun.file()` API**: Can replace some fs operations for better performance.

6. **Bun Subprocess**: Different API than Node.js child_process. Learn `Bun.spawnSync()`, `Bun.spawn()`, `Bun.run()`.

7. **Worker Threads**: Bun has `Web Worker` support instead of Node.js worker_threads.

---

## Conclusion

The migration is feasible but non-trivial. The main challenges are:

1. **Express → Elysia** (routing, middleware patterns)
2. **Child process management** (heartbeat, plugin workers)
3. **Distributed state** (in-memory Maps → Redis)
4. **Authentication framework** (better-auth compatibility TBD)

The database layer, ORM, and core business logic are largely compatible. TimescaleDB integration offers significant benefits for time-series data (cost events, activity logs, job runs).

Estimated effort: **200-240 hours** with 2-3 developers = **4-6 weeks**.

Recommend starting with Phase 1 (foundation verification) before committing to full migration.
