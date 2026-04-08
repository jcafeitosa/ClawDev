import { existsSync, readFileSync, unlinkSync } from "fs";
import { resolve } from "path";
import { createInterface } from "readline/promises";
import { stdin, stdout } from "process";
import { fileURLToPath, pathToFileURL } from "url";
import { and, eq } from "drizzle-orm";
import {
  createDb,
  decodePGliteUrl,
  ensurePostgresDatabase,
  formatEmbeddedPostgresError,
  getPostgresDataDirectory,
  inspectMigrations,
  applyPendingMigrations,
  applyTimescaleMigrations,
  createEmbeddedPostgresLogBuffer,
  reconcilePendingMigrationHistory,
  formatDatabaseBackupResult,
  runDatabaseBackup,
  openPGliteDatabase,
  encodePGliteUrl,
  authUsers,
  companies,
  companyMemberships,
  instanceUserRoles,
} from "@clawdev/db";
import { createElysiaApp } from "./elysia-app.js";
import { loadConfig } from "./config.js";
import { logger } from "./middleware/logger.js";
import {
  heartbeatService,
  reconcilePersistedRuntimeServicesOnStartup,
  restartDesiredRuntimeServicesOnStartup,
  routineService,
} from "./services/index.js";
import { createStorageServiceFromConfig } from "./storage/index.js";
import { printStartupBanner } from "./startup-banner.js";
import { getBoardClaimWarningUrl, initializeBoardClaimChallenge } from "./board-claim.js";
import { maybePersistWorktreeRuntimePorts } from "./worktree-config.js";
import { pluginJobStore } from "./services/plugin-job-store.js";
import { createPluginWorkerManager } from "./services/plugin-worker-manager.js";
import { createPluginStreamBus } from "./services/plugin-stream-bus.js";
import { createPluginToolDispatcher } from "./services/plugin-tool-dispatcher.js";
import { createBullMQJobScheduler } from "./services/bullmq-job-scheduler.js";
import { createPluginJobScheduler } from "./services/plugin-job-scheduler.js";
import { isRedisAvailable, disconnectRedis } from "./services/redis.js";
import {
  type EmbeddingProviderConfig,
  ensureEmbeddingDimensions,
} from "./services/embedding-service.js";

type BetterAuthSessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

type BetterAuthSessionResult = {
  session: { id: string; userId: string } | null;
  user: BetterAuthSessionUser | null;
};

type EmbeddedPostgresInstance = {
  initialise(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
};

type PGliteDatabaseInstance = {
  db: unknown;
  dataDir: string;
  stop(): Promise<void>;
};

type EmbeddedPostgresCtor = new (opts: {
  databaseDir: string;
  user: string;
  password: string;
  port: number;
  persistent: boolean;
  initdbFlags?: string[];
  onLog?: (message: unknown) => void;
  onError?: (message: unknown) => void;
}) => EmbeddedPostgresInstance;

async function detectFreePort(port: number, hostname: string): Promise<number> {
  for (let candidate = Math.max(1, port); candidate <= 65535 && candidate < port + 20; candidate += 1) {
    const isFree = await new Promise<boolean>((resolve) => {
      try {
        const server = Bun.serve({
          hostname,
          port: candidate,
          fetch() {
            return new Response("ok");
          },
        });
        server.stop(true);
        resolve(true);
      } catch {
        resolve(false);
      }
    });
    if (isFree) return candidate;
  }
  return port;
}


export interface StartedServer {
  host: string;
  listenPort: number;
  apiUrl: string;
  databaseUrl: string;
}

export async function startServer(): Promise<StartedServer> {
  const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  let config = loadConfig();
  logger.info(
    {
      host: config.host,
      port: config.port,
      databaseMode: config.databaseMode,
      hasDatabaseUrl: Boolean(config.databaseUrl),
    },
    "Startup config loaded",
  );
  if (process.env.CLAWDEV_SECRETS_PROVIDER === undefined) {
    process.env.CLAWDEV_SECRETS_PROVIDER = config.secretsProvider;
  }
  if (process.env.CLAWDEV_SECRETS_STRICT_MODE === undefined) {
    process.env.CLAWDEV_SECRETS_STRICT_MODE = config.secretsStrictMode ? "true" : "false";
  }
  if (process.env.CLAWDEV_SECRETS_MASTER_KEY_FILE === undefined) {
    process.env.CLAWDEV_SECRETS_MASTER_KEY_FILE = config.secretsMasterKeyFilePath;
  }
  
  type MigrationSummary =
    | "skipped"
    | "already applied"
    | "applied (empty database)"
    | "applied (pending migrations)"
    | "applied (pglite)";
  
  function formatPendingMigrationSummary(migrations: string[]): string {
    if (migrations.length === 0) return "none";
    return migrations.length > 3
      ? `${migrations.slice(0, 3).join(", ")} (+${migrations.length - 3} more)`
      : migrations.join(", ");
  }
  
  async function promptApplyMigrations(migrations: string[]): Promise<boolean> {
    if (process.env.CLAWDEV_MIGRATION_AUTO_APPLY === "true") return true;
    if (process.env.CLAWDEV_MIGRATION_PROMPT === "never") return false;
    if (!stdin.isTTY || !stdout.isTTY) return true;
  
    const prompt = createInterface({ input: stdin, output: stdout });
    try {
      const answer = (await prompt.question(
        `Apply pending migrations (${formatPendingMigrationSummary(migrations)}) now? (y/N): `,
      )).trim().toLowerCase();
      return answer === "y" || answer === "yes";
    } finally {
      prompt.close();
    }
  }
  
  type EnsureMigrationsOptions = {
    autoApply?: boolean;
  };
  
  async function ensureMigrations(
    connectionString: string,
    label: string,
    opts?: EnsureMigrationsOptions,
  ): Promise<MigrationSummary> {
    const autoApply = opts?.autoApply === true;
    let state = await inspectMigrations(connectionString);
    if (state.status === "needsMigrations" && state.reason === "pending-migrations") {
      const repair = await reconcilePendingMigrationHistory(connectionString);
      if (repair.repairedMigrations.length > 0) {
        logger.warn(
          { repairedMigrations: repair.repairedMigrations },
          `${label} had drifted migration history; repaired migration journal entries from existing schema state.`,
        );
        state = await inspectMigrations(connectionString);
        if (state.status === "upToDate") return "already applied";
      }
    }
    if (state.status === "upToDate") return "already applied";
    if (state.status === "needsMigrations" && state.reason === "no-migration-journal-non-empty-db") {
      logger.warn(
        { tableCount: state.tableCount },
        `${label} has existing tables but no migration journal. Run migrations manually to sync schema.`,
      );
      const apply = autoApply ? true : await promptApplyMigrations(state.pendingMigrations);
      if (!apply) {
        throw new Error(
          `${label} has pending migrations (${formatPendingMigrationSummary(state.pendingMigrations)}). ` +
            "Refusing to start against a stale schema. Run pnpm db:migrate or set CLAWDEV_MIGRATION_AUTO_APPLY=true.",
        );
      }
  
      logger.info({ pendingMigrations: state.pendingMigrations }, `Applying ${state.pendingMigrations.length} pending migrations for ${label}`);
      await applyPendingMigrations(connectionString);
      return "applied (pending migrations)";
    }
  
    const apply = autoApply ? true : await promptApplyMigrations(state.pendingMigrations);
    if (!apply) {
      throw new Error(
        `${label} has pending migrations (${formatPendingMigrationSummary(state.pendingMigrations)}). ` +
          "Refusing to start against a stale schema. Run pnpm db:migrate or set CLAWDEV_MIGRATION_AUTO_APPLY=true.",
      );
    }
  
    logger.info({ pendingMigrations: state.pendingMigrations }, `Applying ${state.pendingMigrations.length} pending migrations for ${label}`);
    await applyPendingMigrations(connectionString);
    return "applied (pending migrations)";
  }
  
  function isLoopbackHost(host: string): boolean {
    const normalized = host.trim().toLowerCase();
    return normalized === "127.0.0.1" || normalized === "localhost" || normalized === "::1";
  }

  const usePGliteRuntime = process.env.CLAWDEV_DB_RUNTIME?.trim().toLowerCase() === "pglite";

  function isPortInUseError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const anyErr = err as Error & { code?: string; syscall?: string };
    return anyErr.code === "EADDRINUSE" || anyErr.syscall === "listen";
  }

  function rewriteLocalUrlPort(rawUrl: string | undefined, port: number): string | undefined {
    if (!rawUrl) return undefined;
    try {
      const parsed = new URL(rawUrl);
      if (!isLoopbackHost(parsed.hostname)) return rawUrl;
      parsed.port = String(port);
      return parsed.toString();
    } catch {
      return rawUrl;
    }
  }
  
  const LOCAL_BOARD_USER_ID = "local-board";
  const LOCAL_BOARD_USER_EMAIL = "local@clawdev.local";
  const LOCAL_BOARD_USER_NAME = "Board";
  
  async function ensureLocalTrustedBoardPrincipal(db: any): Promise<void> {
    const now = new Date();
    const existingUser = await db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.id, LOCAL_BOARD_USER_ID))
      .then((rows: Array<{ id: string }>) => rows[0] ?? null);
  
    if (!existingUser) {
      await db.insert(authUsers).values({
        id: LOCAL_BOARD_USER_ID,
        name: LOCAL_BOARD_USER_NAME,
        email: LOCAL_BOARD_USER_EMAIL,
        emailVerified: true,
        image: null,
        createdAt: now,
        updatedAt: now,
      });
    }
  
    const role = await db
      .select({ id: instanceUserRoles.id })
      .from(instanceUserRoles)
      .where(and(eq(instanceUserRoles.userId, LOCAL_BOARD_USER_ID), eq(instanceUserRoles.role, "instance_admin")))
      .then((rows: Array<{ id: string }>) => rows[0] ?? null);
    if (!role) {
      await db.insert(instanceUserRoles).values({
        userId: LOCAL_BOARD_USER_ID,
        role: "instance_admin",
      });
    }
  
    const companyRows = await db.select({ id: companies.id }).from(companies);
    for (const company of companyRows) {
      const membership = await db
        .select({ id: companyMemberships.id })
        .from(companyMemberships)
        .where(
          and(
            eq(companyMemberships.companyId, company.id),
            eq(companyMemberships.principalType, "user"),
            eq(companyMemberships.principalId, LOCAL_BOARD_USER_ID),
          ),
        )
        .then((rows: Array<{ id: string }>) => rows[0] ?? null);
      if (membership) continue;
      await db.insert(companyMemberships).values({
        companyId: company.id,
        principalType: "user",
        principalId: LOCAL_BOARD_USER_ID,
        status: "active",
        membershipRole: "owner",
      });
    }
  }
  
  let db;
  let embeddedPostgres: EmbeddedPostgresInstance | null = null;
  let pgliteDatabase: PGliteDatabaseInstance | null = null;
  let embeddedPostgresStartedByThisProcess = false;
  let migrationSummary: MigrationSummary = "skipped";
  let activeDatabaseConnectionString: string;
  let resolvedEmbeddedPostgresPort: number | null = null;
  let startupDbInfo:
    | { mode: "external-postgres"; connectionString: string }
    | { mode: "embedded-postgres"; dataDir: string; port: number }
    | { mode: "pglite"; dataDir: string };
  if (config.databaseUrl) {
    const pgliteDataDir = decodePGliteUrl(config.databaseUrl);
    if (pgliteDataDir) {
      logger.info("Startup: using PGlite");
      db = createDb(config.databaseUrl);
      activeDatabaseConnectionString = config.databaseUrl;
      migrationSummary = "applied (pglite)";
      startupDbInfo = { mode: "pglite", dataDir: pgliteDataDir };
      config.databaseBackupEnabled = false;
    } else {
      logger.info("Startup: using external PostgreSQL");
      migrationSummary = await ensureMigrations(config.databaseUrl, "PostgreSQL");

      db = createDb(config.databaseUrl);
      logger.info("Using external PostgreSQL via DATABASE_URL/config");
      activeDatabaseConnectionString = config.databaseUrl;
      startupDbInfo = { mode: "external-postgres", connectionString: config.databaseUrl };
    }
  } else if (usePGliteRuntime) {
    logger.info("Startup: using PGlite");
    const pgliteDataDir = resolve(repoRoot, "data", "pglite");
    pgliteDatabase = await openPGliteDatabase(pgliteDataDir);
    db = pgliteDatabase.db;
    activeDatabaseConnectionString = encodePGliteUrl(pgliteDataDir);
    migrationSummary = "applied (pglite)";
    startupDbInfo = { mode: "pglite", dataDir: pgliteDataDir };
    config.databaseBackupEnabled = false;
  } else {
    logger.info("Startup: using embedded PostgreSQL");
    const moduleName = "embedded-postgres";
    let EmbeddedPostgres: EmbeddedPostgresCtor;
    try {
      const mod = await import(moduleName);
      EmbeddedPostgres = mod.default as EmbeddedPostgresCtor;
    } catch {
      throw new Error(
        "Embedded PostgreSQL mode requires dependency `embedded-postgres`. Reinstall dependencies (without omitting required packages), or set DATABASE_URL for external Postgres.",
      );
    }
  
    const dataDir = resolve(config.embeddedPostgresDataDir);
    const configuredPort = config.embeddedPostgresPort;
    let port = configuredPort;
    const logBuffer = createEmbeddedPostgresLogBuffer(120);
    const verboseEmbeddedPostgresLogs = process.env.CLAWDEV_EMBEDDED_POSTGRES_VERBOSE === "true";
    const appendEmbeddedPostgresLog = (message: unknown) => {
      logBuffer.append(message);
      if (!verboseEmbeddedPostgresLogs) {
        return;
      }
      const lines = typeof message === "string"
        ? message.split(/\r?\n/)
        : message instanceof Error
          ? [message.message]
          : [String(message ?? "")];
      for (const lineRaw of lines) {
        const line = lineRaw.trim();
        if (!line) continue;
        logger.info({ embeddedPostgresLog: line }, "embedded-postgres");
      }
    };
    const logEmbeddedPostgresFailure = (phase: "initialise" | "start", err: unknown) => {
      const recentLogs = logBuffer.getRecentLogs();
      if (recentLogs.length > 0) {
        logger.error(
          {
            phase,
            recentLogs,
            err,
          },
          "Embedded PostgreSQL failed; showing buffered startup logs",
        );
      }
    };
  
    if (config.databaseMode === "postgres") {
      logger.warn("Database mode is postgres but no connection string was set; falling back to embedded PostgreSQL");
    }
  
    const clusterVersionFile = resolve(dataDir, "PG_VERSION");
    const clusterAlreadyInitialized = existsSync(clusterVersionFile);
    const postmasterPidFile = resolve(dataDir, "postmaster.pid");
    const isPidRunning = (pid: number): boolean => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    };

    const readPostmasterPid = (): number | null => {
      if (!existsSync(postmasterPidFile)) return null;
      try {
        const pidLine = readFileSync(postmasterPidFile, "utf8").split("\n")[0]?.trim();
        const pid = Number(pidLine);
        if (!Number.isInteger(pid) || pid <= 0) return null;
        return pid;
      } catch {
        return null;
      }
    };

    const getRunningPid = (): number | null => {
      const pid = readPostmasterPid();
      if (pid === null) return null;
      if (!isPidRunning(pid)) return null;
      return pid;
    };

    const waitForPidExit = async (pid: number, timeoutMs = 5000): Promise<boolean> => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (!isPidRunning(pid)) return true;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return !isPidRunning(pid);
    };

    const terminateEmbeddedPostgresProcess = async (pid: number): Promise<void> => {
      logger.warn({ pid, dataDir }, "Terminating stale embedded PostgreSQL process");
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // Ignore if the process already exited or we lack permission.
      }
      if (await waitForPidExit(pid)) {
        return;
      }
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // Ignore if the process already exited or we lack permission.
      }
      await waitForPidExit(pid, 2000);
    };

    const cleanupStaleEmbeddedPostgresProcess = async (stalePidHint: number | null = null): Promise<void> => {
      const pidsToTerminate = new Set<number>();
      if (typeof stalePidHint === "number" && Number.isInteger(stalePidHint) && stalePidHint > 0) {
        pidsToTerminate.add(stalePidHint);
      }
      const pidFromFile = readPostmasterPid();
      if (pidFromFile !== null) {
        pidsToTerminate.add(pidFromFile);
      }
      for (const pid of pidsToTerminate) {
        if (isPidRunning(pid)) {
          await terminateEmbeddedPostgresProcess(pid);
        }
      }
      if (existsSync(postmasterPidFile)) {
        try {
          unlinkSync(postmasterPidFile);
        } catch {
          // Ignore if Bun/Postgres already removed it or it vanished between checks.
        }
      }
    };

    const startFreshEmbeddedPostgres = async (reason: string, level: "info" | "warn" = "warn"): Promise<number> => {
      logger[level](reason);
      logger.info({ configuredPort, dataDir }, "Startup: starting fresh embedded PostgreSQL");
      const detectedPort = await detectFreePort(configuredPort, "127.0.0.1");
      if (detectedPort !== configuredPort) {
        logger.warn(`Embedded PostgreSQL port is in use; using next free port (requestedPort=${configuredPort}, selectedPort=${detectedPort})`);
      }
      port = detectedPort;
      logger.info(`Using embedded PostgreSQL because no DATABASE_URL set (dataDir=${dataDir}, port=${port})`);
      embeddedPostgres = new EmbeddedPostgres({
        databaseDir: dataDir,
        user: "clawdev",
        password: "clawdev",
        port,
        persistent: true,
        initdbFlags: ["--encoding=UTF8", "--locale=C", "--lc-messages=C"],
        onLog: appendEmbeddedPostgresLog,
        onError: appendEmbeddedPostgresLog,
      });

      if (!clusterAlreadyInitialized) {
        try {
          await embeddedPostgres.initialise();
        } catch (err) {
          logEmbeddedPostgresFailure("initialise", err);
          throw formatEmbeddedPostgresError(err, {
            fallbackMessage: `Failed to initialize embedded PostgreSQL cluster in ${dataDir} on port ${port}`,
            recentLogs: logBuffer.getRecentLogs(),
          });
        }
      } else {
        logger.info(`Embedded PostgreSQL cluster already exists (${clusterVersionFile}); skipping init`);
      }

      const stalePidHint = readPostmasterPid();
      if (existsSync(postmasterPidFile)) {
        logger.warn("Removing stale embedded PostgreSQL lock file");
        try {
          unlinkSync(postmasterPidFile);
        } catch {
          // Ignore if Bun/Postgres already removed it or it vanished between checks.
        }
      }
      try {
        await embeddedPostgres.start();
      } catch (err) {
        const errorText = err instanceof Error ? err.message : String(err ?? "");
        const recentLogs = logBuffer.getRecentLogs().join(" | ");
        const sharedMemoryStale =
          /shared memory block.*still in use|could not create shared memory segment|could not attach to shared memory segment/i.test(errorText) ||
          /shared memory block.*still in use|could not create shared memory segment|could not attach to shared memory segment/i.test(recentLogs);
        if (sharedMemoryStale) {
          logger.warn(
            { err, dataDir, port },
            "Embedded PostgreSQL start failed because a stale process is still holding shared memory; cleaning it up and retrying",
          );
          await cleanupStaleEmbeddedPostgresProcess(stalePidHint);
          await new Promise((resolve) => setTimeout(resolve, 5000));
          try {
            await embeddedPostgres.start();
          } catch (retryErr) {
            logEmbeddedPostgresFailure("start", retryErr);
            throw formatEmbeddedPostgresError(retryErr, {
              fallbackMessage: `Failed to start embedded PostgreSQL on port ${port} after cleaning up stale processes`,
              recentLogs: logBuffer.getRecentLogs(),
            });
          }
          embeddedPostgresStartedByThisProcess = true;
          return port;
        }
        logEmbeddedPostgresFailure("start", err);
        throw formatEmbeddedPostgresError(err, {
          fallbackMessage: `Failed to start embedded PostgreSQL on port ${port}`,
          recentLogs: logBuffer.getRecentLogs(),
        });
      }
      embeddedPostgresStartedByThisProcess = true;
      return port;
    };

    const verifyExistingEmbeddedPostgres = async (): Promise<void> => {
      const configuredAdminConnectionString = `postgres://clawdev:clawdev@127.0.0.1:${configuredPort}/postgres`;
      const actualDataDir = await getPostgresDataDirectory(configuredAdminConnectionString);
      if (typeof actualDataDir !== "string") {
        throw new Error(`no postgres reachable on port ${configuredPort}`);
      }
      if (resolve(actualDataDir) !== resolve(dataDir)) {
        throw new Error(`reachable postgres uses data directory "${actualDataDir}" but expected "${dataDir}"`);
      }
      await ensurePostgresDatabase(configuredAdminConnectionString, "clawdev");
    };

    const runningPid = getRunningPid();
    if (runningPid) {
      try {
        logger.info({ pid: runningPid, port: configuredPort }, "Startup: verifying existing embedded PostgreSQL");
        await verifyExistingEmbeddedPostgres();
        logger.info(`Embedded PostgreSQL already running; reusing existing process (pid=${runningPid}, port=${port})`);
      } catch (err) {
        logger.warn(
          { err, pid: runningPid },
          "Embedded PostgreSQL pid file points to an unavailable server; starting a fresh local cluster",
        );
        if (existsSync(postmasterPidFile)) {
          try {
            unlinkSync(postmasterPidFile);
          } catch {
            // Ignore stale lock cleanup failures and continue startup.
          }
        }
        port = await startFreshEmbeddedPostgres(
          `Using embedded PostgreSQL because the existing cluster on port ${configuredPort} was unavailable`,
        );
      }
    } else {
      try {
        logger.info({ port: configuredPort }, "Startup: probing existing embedded PostgreSQL");
        await verifyExistingEmbeddedPostgres();
        logger.warn(
          `Embedded PostgreSQL appears to already be reachable without a pid file; reusing existing server on configured port ${configuredPort}`,
        );
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        const isUnreachable = reason.includes("no postgres reachable");
        if (isUnreachable) {
          port = await startFreshEmbeddedPostgres(
            `Using embedded PostgreSQL because no DATABASE_URL set`,
            "info",
          );
        } else {
          port = await startFreshEmbeddedPostgres(
            `Using embedded PostgreSQL because no DATABASE_URL set and the configured cluster was not reusable: ${reason}`,
          );
        }
      }
    }
  
    const embeddedAdminConnectionString = `postgres://clawdev:clawdev@127.0.0.1:${port}/postgres`;
    const dbStatus = await ensurePostgresDatabase(embeddedAdminConnectionString, "clawdev");
    if (dbStatus === "created") {
      logger.info("Created embedded PostgreSQL database: clawdev");
    }
  
    const embeddedConnectionString = `postgres://clawdev:clawdev@127.0.0.1:${port}/clawdev`;
    const shouldAutoApplyFirstRunMigrations = !clusterAlreadyInitialized || dbStatus === "created";
    if (shouldAutoApplyFirstRunMigrations) {
      logger.info("Detected first-run embedded PostgreSQL setup; applying pending migrations automatically");
    }
    logger.info("Startup: ensuring embedded PostgreSQL migrations");
    migrationSummary = await ensureMigrations(embeddedConnectionString, "Embedded PostgreSQL", {
      autoApply: shouldAutoApplyFirstRunMigrations,
    });

    db = createDb(embeddedConnectionString);
    logger.info("Embedded PostgreSQL ready");
    activeDatabaseConnectionString = embeddedConnectionString;
    resolvedEmbeddedPostgresPort = port;
    startupDbInfo = { mode: "embedded-postgres", dataDir, port };
  }
  
  if (config.deploymentMode === "local_trusted" && !isLoopbackHost(config.host)) {
    throw new Error(
      `local_trusted mode requires loopback host binding (received: ${config.host}). ` +
        "Use authenticated mode for non-loopback deployments.",
    );
  }
  
  if (config.deploymentMode === "local_trusted" && config.deploymentExposure !== "private") {
    throw new Error("local_trusted mode only supports private exposure");
  }
  
  if (config.deploymentMode === "authenticated") {
    if (config.authBaseUrlMode === "explicit" && !config.authPublicBaseUrl) {
      throw new Error("auth.baseUrlMode=explicit requires auth.publicBaseUrl");
    }
    if (config.deploymentExposure === "public") {
      if (config.authBaseUrlMode !== "explicit") {
        throw new Error("authenticated public exposure requires auth.baseUrlMode=explicit");
      }
      if (!config.authPublicBaseUrl) {
        throw new Error("authenticated public exposure requires auth.publicBaseUrl");
      }
    }
  }
  
  logger.info("Startup: post-db checks");
  let authReady = config.deploymentMode === "local_trusted";
  let resolveSessionFromHeaders:
    | ((headers: Headers) => Promise<BetterAuthSessionResult | null>)
    | undefined;
  if (config.deploymentMode === "local_trusted") {
    logger.info("Startup: ensuring board principal");
    await ensureLocalTrustedBoardPrincipal(db as any);
    logger.info("Startup: board principal ready");
  }
  logger.info("Startup: importing auth module");
  const {
    createBetterAuthInstance,
    deriveAuthTrustedOrigins,
    resolveBetterAuthSessionFromHeaders,
  } = await import("./auth/better-auth.js");
  logger.info("Startup: auth module imported");
  const betterAuthSecret =
    process.env.BETTER_AUTH_SECRET?.trim() ?? process.env.CLAWDEV_AGENT_JWT_SECRET?.trim();
  if (config.deploymentMode === "authenticated" && !betterAuthSecret) {
    throw new Error(
      "authenticated mode requires BETTER_AUTH_SECRET (or CLAWDEV_AGENT_JWT_SECRET) to be set",
    );
  }
  const derivedTrustedOrigins = deriveAuthTrustedOrigins(config);
  const envTrustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const effectiveTrustedOrigins = Array.from(new Set([...derivedTrustedOrigins, ...envTrustedOrigins]));
  if (config.deploymentMode === "authenticated") {
    logger.info(
      {
        authBaseUrlMode: config.authBaseUrlMode,
        authPublicBaseUrl: config.authPublicBaseUrl ?? null,
        trustedOrigins: effectiveTrustedOrigins,
        trustedOriginsSource: {
          derived: derivedTrustedOrigins.length,
          env: envTrustedOrigins.length,
        },
      },
      "Authenticated mode auth origin configuration",
    );
  }
  logger.info("Startup: creating auth instance");
  const auth = createBetterAuthInstance(db as any, config, effectiveTrustedOrigins);
  resolveSessionFromHeaders = (headers) => resolveBetterAuthSessionFromHeaders(auth, headers);
  if (config.deploymentMode === "authenticated") {
    await initializeBoardClaimChallenge(db as any, { deploymentMode: config.deploymentMode });
  }
  authReady = true;
  logger.info("Startup: auth ready");

  logger.info("Startup: detecting free port");
  let listenPort: number;
  try {
    listenPort = await Promise.race([
      detectFreePort(config.port, config.host),
      new Promise<number>((_, reject) => setTimeout(() => reject(new Error("detectFreePort timeout")), 5000)),
    ]);
  } catch {
    logger.warn("detectFreePort timed out, using configured port directly");
    listenPort = config.port;
  }
  logger.info({ listenPort, requestedPort: config.port }, "Startup: preparing to listen");
  if (listenPort !== config.port) {
    config.port = listenPort;
  }
  if (resolvedEmbeddedPostgresPort !== null && resolvedEmbeddedPostgresPort !== config.embeddedPostgresPort) {
    config.embeddedPostgresPort = resolvedEmbeddedPostgresPort;
  }
  if (config.authBaseUrlMode === "explicit" && config.authPublicBaseUrl) {
    config.authPublicBaseUrl = rewriteLocalUrlPort(config.authPublicBaseUrl, listenPort);
  }
  maybePersistWorktreeRuntimePorts({
    serverPort: listenPort,
    databasePort: resolvedEmbeddedPostgresPort,
  });
  // ── TimescaleDB migrations ────────────────────────────────────────────────
  // Runs automatically when TIMESCALEDB_ENABLED=true (or by default with
  // external postgres). Gracefully skipped when TimescaleDB is not installed
  // (e.g. embedded-postgres which is vanilla PostgreSQL).
  const timescaleEnabled =
    process.env.TIMESCALEDB_ENABLED === "true" ||
    (process.env.TIMESCALEDB_ENABLED !== "false" && !!config.databaseUrl);

  if (timescaleEnabled) {
    try {
      const tsResult = await applyTimescaleMigrations(activeDatabaseConnectionString);
      if (tsResult.skipped) {
        logger.warn({ reason: tsResult.skipReason }, "TimescaleDB migrations skipped");
      } else if (tsResult.applied > 0) {
        logger.info({ applied: tsResult.applied }, "TimescaleDB migrations applied");
      } else {
        logger.debug("TimescaleDB migrations already up to date");
      }
    } catch (err) {
      logger.error({ err }, "TimescaleDB migrations failed — continuing without hypertables");
    }
  }

  // ── Plugin deps (BullMQ scheduler + worker manager) ───────────────────────
  const jobStore = pluginJobStore(db as any);
  const workerManager = createPluginWorkerManager();
  const streamBus = createPluginStreamBus();
  const toolDispatcher = createPluginToolDispatcher({ workerManager, db: db as any });

  let jobScheduler: ReturnType<typeof createBullMQJobScheduler> | ReturnType<typeof createPluginJobScheduler>;
  const redisAvailable = usePGliteRuntime ? false : await isRedisAvailable().catch(() => false);

  if (redisAvailable) {
    logger.info("Redis available — using BullMQ job scheduler");
    jobScheduler = createBullMQJobScheduler({ db: db as any, jobStore, workerManager });
  } else {
    logger.warn(
      "Redis not available (REDIS_URL not set or unreachable) — using in-process tick-based scheduler. " +
        "Set REDIS_URL to enable BullMQ for reliable job scheduling.",
    );
    jobScheduler = createPluginJobScheduler({ db: db as any, jobStore, workerManager });
  }
  jobScheduler.start();

  // ── Embedding provider (pgvector semantic search) ─────────────────────────
  //
  // Resolution order:
  //   1. EMBEDDING_PROVIDER=local  → local llama.cpp / Ollama endpoint
  //   2. EMBEDDING_PROVIDER=openai → OpenAI API (needs OPENAI_API_KEY)
  //   3. EMBEDDING_BASE_URL set    → auto-select local
  //   4. OPENAI_API_KEY set        → auto-select openai
  //   5. Neither set               → disabled (returns empty search results)
  //
  // Env vars:
  //   EMBEDDING_PROVIDER    = "openai" | "local"   (optional, auto-detected)
  //   OPENAI_API_KEY        = sk-...               (required for openai)
  //   EMBEDDING_BASE_URL    = http://localhost:8080 (required for local)
  //   EMBEDDING_MODEL       = model name            (optional, provider default)
  //   EMBEDDING_DIMENSIONS  = 1536                  (optional, default 1536)
  //
  // Recommended local models (via llama.cpp or Ollama):
  //   Qwen/Qwen3-Embedding   — best quality, supports Matryoshka dims
  //   nomic-embed-text       — fast, solid quality
  //   mxbai-embed-large      — high quality
  //
  const embeddingDimensions = parseInt(process.env.EMBEDDING_DIMENSIONS ?? "1536", 10) || 1536;
  const embeddingProviderEnv = process.env.EMBEDDING_PROVIDER?.trim().toLowerCase();
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim() || undefined;
  const embeddingBaseUrl = process.env.EMBEDDING_BASE_URL?.trim() || undefined;
  const embeddingModel = process.env.EMBEDDING_MODEL?.trim() || undefined;

  let embeddingConfig: EmbeddingProviderConfig = null;

  const useLocal =
    embeddingProviderEnv === "local" ||
    (embeddingProviderEnv !== "openai" && !!embeddingBaseUrl);
  const useOpenAI =
    embeddingProviderEnv === "openai" ||
    (embeddingProviderEnv !== "local" && !!openaiApiKey && !embeddingBaseUrl);

  if (useLocal && embeddingBaseUrl) {
    const model = embeddingModel ?? "qwen3-embedding";
    embeddingConfig = { type: "local", baseUrl: embeddingBaseUrl, model, dimensions: embeddingDimensions };
    logger.info(
      { provider: "local", baseUrl: embeddingBaseUrl, model, dimensions: embeddingDimensions },
      "Embedding provider: local (llama.cpp / Ollama compatible)",
    );
  } else if (useOpenAI && openaiApiKey) {
    const model = embeddingModel ?? "text-embedding-3-small";
    embeddingConfig = { type: "openai", apiKey: openaiApiKey, model, dimensions: embeddingDimensions };
    logger.info(
      { provider: "openai", model, dimensions: embeddingDimensions },
      "Embedding provider: OpenAI",
    );
  } else {
    logger.warn(
      "Semantic search (pgvector) disabled. To enable, set one of:\n" +
        "  • OPENAI_API_KEY=sk-...          (uses OpenAI text-embedding-3-small)\n" +
        "  • EMBEDDING_BASE_URL=http://...  (uses local llama.cpp / Ollama)\n" +
        "Optionally set EMBEDDING_MODEL and EMBEDDING_DIMENSIONS.",
    );
  }

  // Auto-migrate embedding column dimensions if they changed
  if (embeddingConfig) {
    try {
      const dimResult = await ensureEmbeddingDimensions(db as any, embeddingDimensions);
      if (dimResult.migrated) {
        logger.info(
          { from: dimResult.previousDimensions, to: embeddingDimensions },
          "Embedding column migrated to new dimensions — all embeddings cleared, will regenerate on next access",
        );
      }
    } catch (err) {
      logger.warn({ err }, "Could not check embedding dimensions — pgvector may not be installed yet");
    }
  }

  const storageService = createStorageServiceFromConfig(config);
  const uiMode = config.uiDevMiddleware ? "vite-dev" as const : config.serveUi ? "static" as const : "none" as const;
  const app = createElysiaApp({
    db: db as any,
    deploymentMode: config.deploymentMode,
    deploymentExposure: config.deploymentExposure,
    authReady,
    authHandler: auth.handler,
    companyDeletionEnabled: config.companyDeletionEnabled,
    storage: storageService,
    serveUi: config.serveUi,
    uiMode,
    resolveSessionFromHeaders,
    embeddingConfig,
    pluginDeps: { jobScheduler, jobStore, workerManager, streamBus, toolDispatcher },
  });

  logger.info(
    {
      hasPluginDetailRoute: Boolean((app as any)?.router?.history?.some?.((route: any) => route?.path === "/api/plugins/*" || route?.path === "/api/plugins/:pluginId")),
    },
    "Startup: plugin detail route registered",
  );

  if (listenPort !== config.port) {
    logger.warn(`Requested port is busy; using next free port (requestedPort=${config.port}, selectedPort=${listenPort})`);
  }
  
  const runtimeListenHost = config.host;
  const runtimeApiHost =
    runtimeListenHost === "0.0.0.0" || runtimeListenHost === "::"
      ? "localhost"
      : runtimeListenHost;
  process.env.CLAWDEV_LISTEN_HOST = runtimeListenHost;
  process.env.CLAWDEV_LISTEN_PORT = String(listenPort);
  process.env.CLAWDEV_API_URL = `http://${runtimeApiHost}:${listenPort}`;
  
  // WebSocket is now handled natively by Elysia via liveEventsElysiaWs in elysia-app.ts

  void reconcilePersistedRuntimeServicesOnStartup(db as any)
    .then((result) => {
      if (result.reconciled > 0) {
        logger.warn(
          { reconciled: result.reconciled },
          "reconciled persisted runtime services from a previous server process",
        );
      }
    })
    .catch((err) => {
      logger.error({ err }, "startup reconciliation of persisted runtime services failed");
    });
  void restartDesiredRuntimeServicesOnStartup(db as any)
    .then((result) => {
      if (result.restarted > 0) {
        logger.warn(
          { restarted: result.restarted },
          "restarted desired runtime services from persisted workspace config",
        );
      }
      if (result.failed > 0) {
        logger.warn(
          { failed: result.failed },
          "some desired runtime services could not be restarted on startup",
        );
      }
    })
    .catch((err) => {
      logger.error({ err }, "startup restart of desired runtime services failed");
    });

  // Reconcile: ensure all agents are members of their company's #general channel
  void (async () => {
    try {
      const { channelService } = await import("./services/channels.js");
      const { agents: agentsTable } = await import("@clawdev/db");
      const allAgents = await (db as any).select({ id: agentsTable.id, companyId: agentsTable.companyId, status: agentsTable.status }).from(agentsTable);
      const companiesSeen = new Map<string, string>(); // companyId → generalChannelId
      const ch = channelService(db as any);
      let joined = 0;
      for (const agent of allAgents) {
        if (agent.status === "terminated") continue;
        let generalId = companiesSeen.get(agent.companyId);
        if (!generalId) {
          try {
            const general = await ch.getOrCreateGeneral(agent.companyId);
            generalId = general.id;
            companiesSeen.set(agent.companyId, generalId);
          } catch { continue; }
        }
        try {
          await ch.join(generalId, { agentId: agent.id, role: "member" });
          joined++;
        } catch { /* already a member or other conflict */ }
      }
      if (joined > 0) {
        logger.info({ joined }, "reconciled agent channel memberships on startup");
      }
    } catch (err) {
      logger.warn({ err }, "startup channel membership reconciliation failed");
    }
  })();

  if (config.heartbeatSchedulerEnabled) {
    const heartbeat = heartbeatService(db as any);
    const routines = routineService(db as any);
  
    // Reap orphaned running runs at startup while in-memory execution state is empty,
    // then resume any persisted queued runs that were waiting on the previous process.
    void heartbeat
      .reapOrphanedRuns()
      .then(() => heartbeat.resumeQueuedRuns())
      .catch((err) => {
        logger.error({ err }, "startup heartbeat recovery failed");
      });
    setInterval(() => {
      void heartbeat
        .tickTimers(new Date())
        .then((result) => {
          if (result.enqueued > 0) {
            logger.info({ ...result }, "heartbeat timer tick enqueued runs");
          }
        })
        .catch((err) => {
          logger.error({ err }, "heartbeat timer tick failed");
        });

      void routines
        .tickScheduledTriggers(new Date())
        .then((result) => {
          if (result.triggered > 0) {
            logger.info({ ...result }, "routine scheduler tick enqueued runs");
          }
        })
        .catch((err) => {
          logger.error({ err }, "routine scheduler tick failed");
        });
  
      // Periodically reap orphaned runs (5-min staleness threshold) and make sure
      // persisted queued work is still being driven forward.
      void heartbeat
        .reapOrphanedRuns({ staleThresholdMs: 5 * 60 * 1000 })
        .then(() => heartbeat.resumeQueuedRuns())
        .catch((err) => {
          logger.error({ err }, "periodic heartbeat recovery failed");
        });
    }, config.heartbeatSchedulerIntervalMs);
  }
  
  if (config.databaseBackupEnabled) {
    const backupIntervalMs = config.databaseBackupIntervalMinutes * 60 * 1000;
    let backupInFlight = false;
  
    const runScheduledBackup = async () => {
      if (backupInFlight) {
        logger.warn("Skipping scheduled database backup because a previous backup is still running");
        return;
      }
  
      backupInFlight = true;
      try {
        const result = await runDatabaseBackup({
          connectionString: activeDatabaseConnectionString,
          backupDir: config.databaseBackupDir,
          retentionDays: config.databaseBackupRetentionDays,
          filenamePrefix: "clawdev",
        });
        logger.info(
          {
            backupFile: result.backupFile,
            sizeBytes: result.sizeBytes,
            prunedCount: result.prunedCount,
            backupDir: config.databaseBackupDir,
            retentionDays: config.databaseBackupRetentionDays,
          },
          `Automatic database backup complete: ${formatDatabaseBackupResult(result)}`,
        );
      } catch (err) {
        logger.error({ err, backupDir: config.databaseBackupDir }, "Automatic database backup failed");
      } finally {
        backupInFlight = false;
      }
    };
  
    logger.info(
      {
        intervalMinutes: config.databaseBackupIntervalMinutes,
        retentionDays: config.databaseBackupRetentionDays,
        backupDir: config.databaseBackupDir,
      },
      "Automatic database backups enabled",
    );
    setInterval(() => {
      void runScheduledBackup();
    }, backupIntervalMs);
  }
  
  // ── Hourly model discovery / probe cycle ──────────────────────────────
  {
    const { createModelCatalogService } = await import("./services/model-catalog.js");
    const { createProviderStatusService } = await import("./services/provider-status.js");
    const { createModelDiscoveryService } = await import("./services/model-discovery.js");
    const catalog = createModelCatalogService(db as any);
    const providerStatus = createProviderStatusService(db as any);
    const discovery = createModelDiscoveryService(db as any, catalog, providerStatus);

    const MODEL_DISCOVERY_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
    let discoveryInFlight = false;

    const runScheduledDiscovery = async () => {
      if (discoveryInFlight) return;
      discoveryInFlight = true;
      try {
        const result = await discovery.runDiscoveryCycle();
        logger.info(
          { adaptersProbed: result.adaptersProbed, modelsDiscovered: result.modelsDiscovered, added: result.added, updated: result.updated },
          "Scheduled model discovery cycle complete",
        );
      } catch (err) {
        logger.error({ err }, "Scheduled model discovery cycle failed");
      } finally {
        discoveryInFlight = false;
      }
    };

    // Run once at startup (after a short delay to let the server settle)
    setTimeout(() => { void runScheduledDiscovery(); }, 10_000);
    // Then repeat hourly
    setInterval(() => { void runScheduledDiscovery(); }, MODEL_DISCOVERY_INTERVAL_MS);
    logger.info("Model discovery scheduled every 1 hour");
  }

  // ── CEO auto-approval timer ─────────────────────────────────────────────
  // When the owner does not approve a new hire within 1 minute, the CEO agent
  // (or system) auto-approves the pending approval.
  {
    const { approvalAutoApproveService } = await import("./services/approval-auto-approve.js");
    const autoApprove = approvalAutoApproveService(db as any);
    autoApprove.start();
  }

  // Start Elysia server (Bun native HTTP + WebSocket)
  const listenAttemptLimit = usePGliteRuntime ? 10 : 3;
  for (let attempt = 1; attempt <= listenAttemptLimit; attempt += 1) {
    try {
      app.listen({ port: listenPort, hostname: config.host });
      break;
    } catch (err) {
      if (!isPortInUseError(err) || attempt === listenAttemptLimit) {
        throw err;
      }
      const nextPort = await detectFreePort(listenPort + 1, config.host);
      if (nextPort !== listenPort) {
        logger.warn(
          { attempt, listenPort, nextPort, host: config.host },
          "Listen failed with EADDRINUSE; switching to a free port and retrying",
        );
        listenPort = nextPort;
        config.port = nextPort;
      } else {
        logger.warn(
          { attempt, listenPort, host: config.host },
          "Listen failed with EADDRINUSE; retrying after a short delay",
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  logger.info(`Server listening on ${config.host}:${listenPort}`);

  if (process.env.CLAWDEV_OPEN_ON_LISTEN === "true") {
    const openHost = config.host === "0.0.0.0" || config.host === "::" ? "127.0.0.1" : config.host;
    const url = `http://${openHost}:${listenPort}`;
    void import("open")
      .then((mod) => mod.default(url))
      .then(() => {
        logger.info(`Opened browser at ${url}`);
      })
      .catch((err) => {
        logger.warn({ err, url }, "Failed to open browser on startup");
      });
  }

  await printStartupBanner({
    host: config.host,
    deploymentMode: config.deploymentMode,
    deploymentExposure: config.deploymentExposure,
    authReady,
    requestedPort: config.port,
    listenPort,
    uiMode,
    db: startupDbInfo,
    migrationSummary,
    heartbeatSchedulerEnabled: config.heartbeatSchedulerEnabled,
    heartbeatSchedulerIntervalMs: config.heartbeatSchedulerIntervalMs,
    databaseBackupEnabled: config.databaseBackupEnabled,
    databaseBackupIntervalMinutes: config.databaseBackupIntervalMinutes,
    databaseBackupRetentionDays: config.databaseBackupRetentionDays,
    databaseBackupDir: config.databaseBackupDir,
  });

  const boardClaimUrl = getBoardClaimWarningUrl(config.host, listenPort);
  if (boardClaimUrl) {
    const red = "\x1b[41m\x1b[30m";
    const yellow = "\x1b[33m";
    const reset = "\x1b[0m";
    console.log(
      [
        `${red}  BOARD CLAIM REQUIRED  ${reset}`,
        `${yellow}This instance was previously local_trusted and still has local-board as the only admin.${reset}`,
        `${yellow}Sign in with a real user and open this one-time URL to claim ownership:${reset}`,
        `${yellow}${boardClaimUrl}${reset}`,
        `${yellow}If you are connecting over Tailscale, replace the host in this URL with your Tailscale IP/MagicDNS name.${reset}`,
      ].join("\n"),
    );
  }
  
  const shutdown = async (signal: "SIGINT" | "SIGTERM") => {
    logger.info({ signal }, "Graceful shutdown initiated");

    // Stop job scheduler (flushes active BullMQ jobs)
    try {
      jobScheduler.stop();
    } catch (err) {
      logger.error({ err }, "Error stopping job scheduler");
    }

    // Disconnect Redis
    try {
      await disconnectRedis();
    } catch (err) {
      logger.error({ err }, "Error disconnecting Redis");
    }

    if (embeddedPostgres && embeddedPostgresStartedByThisProcess) {
      logger.info({ signal }, "Stopping embedded PostgreSQL");
      try {
        await embeddedPostgres?.stop();
      } catch (err) {
        logger.error({ err }, "Failed to stop embedded PostgreSQL cleanly");
      }
    }

    if (pgliteDatabase) {
      logger.info({ signal }, "Stopping PGlite database");
      try {
        await pgliteDatabase.stop();
      } catch (err) {
        logger.error({ err }, "Failed to stop PGlite cleanly");
      }
    }

    process.exit(0);
  };

  process.once("SIGINT", () => { void shutdown("SIGINT"); });
  process.once("SIGTERM", () => { void shutdown("SIGTERM"); });

  // Catch unhandled exceptions and rejections
  process.on("uncaughtException", (err) => {
    logger.fatal(
      { category: "system", err, stack: (err as any)?.stack },
      "Uncaught exception — shutting down"
    );
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.fatal(
      { category: "system", reason },
      "Unhandled rejection — shutting down"
    );
    process.exit(1);
  });

  return {
    host: config.host,
    listenPort,
    apiUrl: process.env.CLAWDEV_API_URL ?? `http://${runtimeApiHost}:${listenPort}`,
    databaseUrl: activeDatabaseConnectionString,
  };
}

function isMainModule(metaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return pathToFileURL(resolve(entry)).href === metaUrl;
  } catch {
    return false;
  }
}

if (isMainModule(import.meta.url)) {
  void startServer().catch((err) => {
    logger.error({ err }, "ClawDev server failed to start");
    process.exit(1);
  });
}
