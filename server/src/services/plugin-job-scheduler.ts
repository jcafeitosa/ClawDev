/**
 * PluginJobScheduler — BullMQ-based scheduler for plugin scheduled jobs.
 *
 * The scheduler is the central coordinator for all plugin cron jobs. When
 * Redis is available, it uses a dedicated BullMQ Queue (`clawdev:plugin-jobs`)
 * to enqueue individual job executions with precise delays calculated from
 * each job's cron schedule. A BullMQ Worker processes these jobs, dispatches
 * RPC calls to the appropriate worker processes, records each execution in
 * the `plugin_job_runs` table, and re-enqueues the next occurrence.
 *
 * When Redis is NOT configured, the scheduler falls back to the original
 * setInterval-based tick loop that polls the database for due jobs.
 *
 * ## Responsibilities
 *
 * 1. **BullMQ Queue** — Each due plugin job is enqueued as a delayed BullMQ
 *    job with a delay equal to `nextRunAt - now`. The BullMQ Worker picks
 *    them up at the right time and dispatches the RPC call.
 *
 * 2. **Fallback tick loop** — When Redis is unavailable, a `setInterval`
 *    fires every `tickIntervalMs` (default 30s) and polls the database for
 *    due jobs, preserving the original behavior.
 *
 * 3. **Cron parsing & next-run calculation** — Uses the lightweight built-in
 *    cron parser ({@link parseCron}, {@link nextCronTick}) to compute the
 *    `nextRunAt` timestamp after each run or when a new job is registered.
 *
 * 4. **Overlap prevention** — Before dispatching a job, the scheduler checks
 *    for an existing `running` run for the same job. If one exists, the job
 *    is skipped and re-enqueued for the next cron tick.
 *
 * 5. **Job run recording** — Every execution creates a `plugin_job_runs` row:
 *    `queued` → `running` → `succeeded` | `failed`. Duration and error are
 *    captured.
 *
 * 6. **Lifecycle integration** — The scheduler exposes `registerPlugin()` and
 *    `unregisterPlugin()` so the host lifecycle manager can wire up job
 *    scheduling when plugins start/stop. On registration, the scheduler
 *    enqueues all active jobs that are due.
 *
 * @see PLUGIN_SPEC.md §17 — Scheduled Jobs
 * @see ./plugin-job-store.ts — Persistence layer
 * @see ./cron.ts — Cron parsing utilities
 */

import { Queue, Worker, type Job as BullJob } from "bullmq";
import { and, eq, lte, or } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { pluginJobs, pluginJobRuns } from "@clawdev/db";
import type { PluginJobStore } from "./plugin-job-store.js";
import type { PluginWorkerManager } from "./plugin-worker-manager.js";
import { parseCron, nextCronTick, validateCron } from "./cron.js";
import { logger } from "../middleware/logger.js";
import { isRedisConfigured, getRedis } from "../redis.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Queue name for plugin job executions. */
export const PLUGIN_JOBS_QUEUE_NAME = "clawdev:plugin-jobs";

/** Default interval between scheduler ticks (30 seconds). Fallback only. */
const DEFAULT_TICK_INTERVAL_MS = 30_000;

/** Default timeout for a runJob RPC call (5 minutes). */
const DEFAULT_JOB_TIMEOUT_MS = 5 * 60 * 1_000;

/** Maximum number of concurrent job executions across all plugins. */
const DEFAULT_MAX_CONCURRENT_JOBS = 10;

/** Minimum delay for a BullMQ job (1 second). Prevents near-zero delays. */
const MIN_DELAY_MS = 1_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for creating a PluginJobScheduler.
 */
export interface PluginJobSchedulerOptions {
  /** Drizzle database instance. */
  db: Db;
  /** Persistence layer for jobs and runs. */
  jobStore: PluginJobStore;
  /** Worker process manager for RPC calls. */
  workerManager: PluginWorkerManager;
  /** Interval between scheduler ticks in ms (default: 30s). Fallback only. */
  tickIntervalMs?: number;
  /** Timeout for individual job RPC calls in ms (default: 5min). */
  jobTimeoutMs?: number;
  /** Maximum number of concurrent job executions (default: 10). */
  maxConcurrentJobs?: number;
}

/**
 * Result of a manual job trigger.
 */
export interface TriggerJobResult {
  /** The created run ID. */
  runId: string;
  /** The job ID that was triggered. */
  jobId: string;
}

/**
 * Diagnostic information about the scheduler.
 */
export interface SchedulerDiagnostics {
  /** Whether the tick loop is running. */
  running: boolean;
  /** Number of jobs currently executing. */
  activeJobCount: number;
  /** Set of job IDs currently in-flight. */
  activeJobIds: string[];
  /** Total number of ticks executed since start. */
  tickCount: number;
  /** Timestamp of the last tick (ISO 8601). */
  lastTickAt: string | null;
  /** Whether the scheduler is using BullMQ (true) or setInterval fallback (false). */
  mode: "bullmq" | "fallback";
}

// ---------------------------------------------------------------------------
// BullMQ job data shape
// ---------------------------------------------------------------------------

/**
 * Data payload for a BullMQ plugin job.
 */
interface PluginJobData {
  /** UUID of the plugin_jobs row. */
  jobId: string;
  /** UUID of the owning plugin. */
  pluginId: string;
  /** Stable job key from the manifest. */
  jobKey: string;
  /** Cron schedule expression. */
  schedule: string;
  /** ISO 8601 timestamp when this execution was originally scheduled. */
  scheduledAt: string;
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

/**
 * The public interface of the job scheduler.
 */
export interface PluginJobScheduler {
  /**
   * Start the scheduler.
   *
   * When Redis is available, initializes the BullMQ Queue and Worker.
   * Otherwise, starts the fallback setInterval tick loop.
   *
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  start(): void;

  /**
   * Stop the scheduler.
   *
   * In-flight job runs are NOT cancelled — they are allowed to finish
   * naturally. The tick loop / BullMQ worker simply stops accepting new jobs.
   */
  stop(): void;

  /**
   * Register a plugin with the scheduler.
   *
   * Enqueues all active jobs that are due (or computes `nextRunAt` and
   * enqueues with the appropriate delay). Typically called after a plugin's
   * worker process starts and `syncJobDeclarations()` has been called.
   *
   * @param pluginId - UUID of the plugin
   */
  registerPlugin(pluginId: string): Promise<void>;

  /**
   * Unregister a plugin from the scheduler.
   *
   * Cancels any in-flight runs for the plugin and removes tracking state.
   *
   * @param pluginId - UUID of the plugin
   */
  unregisterPlugin(pluginId: string): Promise<void>;

  /**
   * Manually trigger a specific job (outside of the cron schedule).
   *
   * Creates a run with `trigger: "manual"` and dispatches immediately,
   * respecting the overlap prevention check.
   *
   * @param jobId - UUID of the job to trigger
   * @param trigger - What triggered this run (default: "manual")
   * @returns The created run info
   * @throws {Error} if the job is not found, not active, or already running
   */
  triggerJob(jobId: string, trigger?: "manual" | "retry"): Promise<TriggerJobResult>;

  /**
   * Run a single scheduler tick immediately (for testing / fallback mode).
   *
   * @internal
   */
  tick(): Promise<void>;

  /**
   * Get diagnostic information about the scheduler state.
   */
  diagnostics(): SchedulerDiagnostics;

  /**
   * Gracefully shut down the BullMQ queue and worker. Called on server exit.
   */
  shutdown(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Create a new PluginJobScheduler.
 *
 * @example
 * ```ts
 * const scheduler = createPluginJobScheduler({
 *   db,
 *   jobStore,
 *   workerManager,
 * });
 *
 * // Start the scheduler
 * scheduler.start();
 *
 * // When a plugin comes online, register it
 * await scheduler.registerPlugin(pluginId);
 *
 * // Manually trigger a job
 * const { runId } = await scheduler.triggerJob(jobId);
 *
 * // On server shutdown
 * await scheduler.shutdown();
 * ```
 */
export function createPluginJobScheduler(
  options: PluginJobSchedulerOptions,
): PluginJobScheduler {
  const {
    db,
    jobStore,
    workerManager,
    tickIntervalMs = DEFAULT_TICK_INTERVAL_MS,
    jobTimeoutMs = DEFAULT_JOB_TIMEOUT_MS,
    maxConcurrentJobs = DEFAULT_MAX_CONCURRENT_JOBS,
  } = options;

  const log = logger.child({ service: "plugin-job-scheduler" });

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  /** BullMQ queue instance (only when Redis is configured). */
  let bullQueue: Queue | null = null;

  /** BullMQ worker instance (only when Redis is configured). */
  let bullWorker: Worker | null = null;

  /** Timer handle for the fallback tick loop. */
  let tickTimer: ReturnType<typeof setInterval> | null = null;

  /** Whether the scheduler is running. */
  let running = false;

  /** Whether we are using BullMQ or fallback. */
  let mode: "bullmq" | "fallback" = "fallback";

  /** Set of job IDs currently being executed (for overlap prevention). */
  const activeJobs = new Set<string>();

  /** Total number of ticks / job processing cycles since start. */
  let tickCount = 0;

  /** Timestamp of the last tick / processing cycle. */
  let lastTickAt: Date | null = null;

  /** Guard against concurrent tick execution (fallback mode only). */
  let tickInProgress = false;

  // -----------------------------------------------------------------------
  // BullMQ: Queue & Worker setup
  // -----------------------------------------------------------------------

  /**
   * Initialize the BullMQ Queue for plugin jobs.
   */
  function initBullQueue(): Queue {
    if (bullQueue) return bullQueue;

    const connection = getRedis();
    bullQueue = new Queue(PLUGIN_JOBS_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
        attempts: 1, // Retries are managed by cron re-enqueue, not BullMQ
      },
    });

    return bullQueue;
  }

  /**
   * Initialize the BullMQ Worker that processes plugin job executions.
   */
  function initBullWorker(): Worker {
    if (bullWorker) return bullWorker;

    const connection = getRedis();
    bullWorker = new Worker<PluginJobData>(
      PLUGIN_JOBS_QUEUE_NAME,
      async (job: BullJob<PluginJobData>) => {
        await processPluginJob(job.data);
      },
      {
        connection,
        concurrency: maxConcurrentJobs,
      },
    );

    bullWorker.on("failed", (job: BullJob | undefined, err: Error) => {
      log.error(
        { err: err.message, jobName: job?.name, jobId: job?.data?.jobId },
        "BullMQ plugin job processing failed",
      );
    });

    bullWorker.on("completed", (job: BullJob) => {
      log.debug(
        { jobName: job.name, jobId: job.data?.jobId },
        "BullMQ plugin job processing completed",
      );
    });

    return bullWorker;
  }

  /**
   * Enqueue a plugin job onto the BullMQ queue with the appropriate delay.
   *
   * @param job - The plugin_jobs row to enqueue
   * @param delayMs - Delay in ms before the job should be processed (0 = immediate)
   */
  async function enqueueJob(
    job: typeof pluginJobs.$inferSelect,
    delayMs: number = 0,
  ): Promise<void> {
    const queue = initBullQueue();
    const safeDelay = Math.max(0, delayMs);

    const data: PluginJobData = {
      jobId: job.id,
      pluginId: job.pluginId,
      jobKey: job.jobKey,
      schedule: job.schedule ?? "",
      scheduledAt: (job.nextRunAt ?? new Date()).toISOString(),
    };

    // Use a unique job ID per execution to allow repeated enqueues for the
    // same plugin job. The format ensures deduplication within a single
    // scheduled tick window.
    const bullJobId = `pj:${job.id}:${Date.now()}`;

    await queue.add(job.jobKey, data, {
      jobId: bullJobId,
      delay: safeDelay,
    });

    log.debug(
      { jobId: job.id, jobKey: job.jobKey, delayMs: safeDelay, bullJobId },
      "enqueued plugin job on BullMQ",
    );
  }

  /**
   * Process a single plugin job from the BullMQ queue.
   * This is the BullMQ Worker's processor function.
   */
  async function processPluginJob(data: PluginJobData): Promise<void> {
    const { jobId, pluginId, jobKey, scheduledAt } = data;
    const jobLog = log.child({ jobId, pluginId, jobKey });

    tickCount++;
    lastTickAt = new Date();

    // Re-fetch the job from DB to get current state (it may have been
    // paused or deleted since enqueue time)
    const job = await jobStore.getJobById(jobId);
    if (!job) {
      jobLog.warn("job no longer exists — skipping");
      return;
    }

    if (job.status !== "active") {
      jobLog.debug({ status: job.status }, "job is not active — skipping");
      return;
    }

    // Overlap prevention: skip if this job is already running
    if (activeJobs.has(jobId)) {
      jobLog.debug("skipping job — already running (overlap prevention)");
      await enqueueNextOccurrence(job);
      return;
    }

    // Check if the worker is available
    if (!workerManager.isRunning(pluginId)) {
      jobLog.debug("skipping job — worker not running");
      await enqueueNextOccurrence(job);
      return;
    }

    // Validate schedule
    if (!job.schedule) {
      jobLog.warn("skipping job — no schedule defined");
      return;
    }

    // Execute the job
    activeJobs.add(jobId);
    let runId: string | undefined;
    const startedAt = Date.now();

    try {
      // 1. Create run record
      const run = await jobStore.createRun({
        jobId,
        pluginId,
        trigger: "schedule",
      });
      runId = run.id;

      jobLog.info({ runId }, "dispatching scheduled job");

      // 2. Mark run as running
      await jobStore.markRunning(runId);

      // 3. Call worker via RPC
      await workerManager.call(
        pluginId,
        "runJob",
        {
          job: {
            jobKey,
            runId,
            trigger: "schedule" as const,
            scheduledAt,
          },
        },
        jobTimeoutMs,
      );

      // 4. Mark run as succeeded
      const durationMs = Date.now() - startedAt;
      await jobStore.completeRun(runId, {
        status: "succeeded",
        durationMs,
      });

      jobLog.info({ runId, durationMs }, "job completed successfully");
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const errorMessage = err instanceof Error ? err.message : String(err);

      jobLog.error(
        { runId, durationMs, err: errorMessage },
        "job execution failed",
      );

      // Record the failure
      if (runId) {
        try {
          await jobStore.completeRun(runId, {
            status: "failed",
            error: errorMessage,
            durationMs,
          });
        } catch (completeErr) {
          jobLog.error(
            {
              runId,
              err: completeErr instanceof Error ? completeErr.message : String(completeErr),
            },
            "failed to record job failure",
          );
        }
      }
    } finally {
      // Remove from active set
      activeJobs.delete(jobId);

      // Always advance the schedule pointer and enqueue next occurrence
      try {
        await advanceSchedulePointer(job);
        await enqueueNextOccurrence(job);
      } catch (err) {
        jobLog.error(
          { err: err instanceof Error ? err.message : String(err) },
          "failed to advance schedule pointer or enqueue next occurrence",
        );
      }
    }
  }

  /**
   * Enqueue the next occurrence of a job based on its cron schedule.
   */
  async function enqueueNextOccurrence(
    job: typeof pluginJobs.$inferSelect,
  ): Promise<void> {
    if (!job.schedule) return;

    const validationError = validateCron(job.schedule);
    if (validationError) {
      log.warn(
        { jobId: job.id, schedule: job.schedule, error: validationError },
        "invalid cron schedule — cannot enqueue next occurrence",
      );
      return;
    }

    const cron = parseCron(job.schedule);
    const now = new Date();
    const nextRunAt = nextCronTick(cron, now);

    if (!nextRunAt) return;

    const delayMs = Math.max(MIN_DELAY_MS, nextRunAt.getTime() - now.getTime());

    await enqueueJob(job, delayMs);
  }

  // -----------------------------------------------------------------------
  // Fallback: tick-based polling (no Redis)
  // -----------------------------------------------------------------------

  /**
   * A single scheduler tick. Queries for due jobs and dispatches them.
   * Used only in fallback mode (no Redis).
   */
  async function tick(): Promise<void> {
    // Prevent overlapping ticks (in case a tick takes longer than the interval)
    if (tickInProgress) {
      log.debug("skipping tick — previous tick still in progress");
      return;
    }

    tickInProgress = true;
    tickCount++;
    lastTickAt = new Date();

    try {
      const now = new Date();

      // Query for jobs whose nextRunAt has passed and are active.
      const dueJobs = await db
        .select()
        .from(pluginJobs)
        .where(
          and(
            eq(pluginJobs.status, "active"),
            lte(pluginJobs.nextRunAt, now),
          ),
        );

      if (dueJobs.length === 0) {
        return;
      }

      log.debug({ count: dueJobs.length }, "found due jobs");

      // Dispatch each due job (respecting concurrency limits)
      const dispatches: Promise<void>[] = [];

      for (const job of dueJobs) {
        // Concurrency limit
        if (activeJobs.size >= maxConcurrentJobs) {
          log.warn(
            { maxConcurrentJobs, activeJobCount: activeJobs.size },
            "max concurrent jobs reached, deferring remaining jobs",
          );
          break;
        }

        // Overlap prevention: skip if this job is already running
        if (activeJobs.has(job.id)) {
          log.debug(
            { jobId: job.id, jobKey: job.jobKey, pluginId: job.pluginId },
            "skipping job — already running (overlap prevention)",
          );
          continue;
        }

        // Check if the worker is available
        if (!workerManager.isRunning(job.pluginId)) {
          log.debug(
            { jobId: job.id, pluginId: job.pluginId },
            "skipping job — worker not running",
          );
          continue;
        }

        // Validate cron expression before dispatching
        if (!job.schedule) {
          log.warn(
            { jobId: job.id, jobKey: job.jobKey },
            "skipping job — no schedule defined",
          );
          continue;
        }

        dispatches.push(dispatchJobFallback(job));
      }

      if (dispatches.length > 0) {
        await Promise.allSettled(dispatches);
      }
    } catch (err) {
      log.error(
        { err: err instanceof Error ? err.message : String(err) },
        "scheduler tick error",
      );
    } finally {
      tickInProgress = false;
    }
  }

  /**
   * Dispatch a single job run in fallback mode — create the run record,
   * call the worker, record the result, and advance the schedule pointer.
   */
  async function dispatchJobFallback(
    job: typeof pluginJobs.$inferSelect,
  ): Promise<void> {
    const { id: jobId, pluginId, jobKey, schedule } = job;
    const jobLog = log.child({ jobId, pluginId, jobKey });

    // Mark as active (overlap prevention)
    activeJobs.add(jobId);

    let runId: string | undefined;
    const startedAt = Date.now();

    try {
      // 1. Create run record
      const run = await jobStore.createRun({
        jobId,
        pluginId,
        trigger: "schedule",
      });
      runId = run.id;

      jobLog.info({ runId }, "dispatching scheduled job");

      // 2. Mark run as running
      await jobStore.markRunning(runId);

      // 3. Call worker via RPC
      await workerManager.call(
        pluginId,
        "runJob",
        {
          job: {
            jobKey,
            runId,
            trigger: "schedule" as const,
            scheduledAt: (job.nextRunAt ?? new Date()).toISOString(),
          },
        },
        jobTimeoutMs,
      );

      // 4. Mark run as succeeded
      const durationMs = Date.now() - startedAt;
      await jobStore.completeRun(runId, {
        status: "succeeded",
        durationMs,
      });

      jobLog.info({ runId, durationMs }, "job completed successfully");
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const errorMessage = err instanceof Error ? err.message : String(err);

      jobLog.error(
        { runId, durationMs, err: errorMessage },
        "job execution failed",
      );

      // Record the failure
      if (runId) {
        try {
          await jobStore.completeRun(runId, {
            status: "failed",
            error: errorMessage,
            durationMs,
          });
        } catch (completeErr) {
          jobLog.error(
            {
              runId,
              err: completeErr instanceof Error ? completeErr.message : String(completeErr),
            },
            "failed to record job failure",
          );
        }
      }
    } finally {
      // Remove from active set
      activeJobs.delete(jobId);

      // 5. Always advance the schedule pointer (even on failure)
      try {
        await advanceSchedulePointer(job);
      } catch (err) {
        jobLog.error(
          { err: err instanceof Error ? err.message : String(err) },
          "failed to advance schedule pointer",
        );
      }
    }
  }

  // -----------------------------------------------------------------------
  // Core: manual trigger (works in both modes)
  // -----------------------------------------------------------------------

  async function triggerJob(
    jobId: string,
    trigger: "manual" | "retry" = "manual",
  ): Promise<TriggerJobResult> {
    const job = await jobStore.getJobById(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status !== "active") {
      throw new Error(
        `Job "${job.jobKey}" is not active (status: ${job.status})`,
      );
    }

    // Overlap prevention
    if (activeJobs.has(jobId)) {
      throw new Error(
        `Job "${job.jobKey}" is already running — cannot trigger while in progress`,
      );
    }

    // Also check DB for running runs (defensive — covers multi-instance)
    const existingRuns = await db
      .select()
      .from(pluginJobRuns)
      .where(
        and(
          eq(pluginJobRuns.jobId, jobId),
          eq(pluginJobRuns.status, "running"),
        ),
      );

    if (existingRuns.length > 0) {
      throw new Error(
        `Job "${job.jobKey}" already has a running execution — cannot trigger while in progress`,
      );
    }

    // Check worker availability
    if (!workerManager.isRunning(job.pluginId)) {
      throw new Error(
        `Worker for plugin "${job.pluginId}" is not running — cannot trigger job`,
      );
    }

    // Create the run and dispatch
    const run = await jobStore.createRun({
      jobId,
      pluginId: job.pluginId,
      trigger,
    });

    // Manual triggers are dispatched directly (both modes) to provide
    // immediate feedback. No need to go through the BullMQ queue since
    // manual runs do not re-enqueue the next cron occurrence.
    void dispatchManualRun(job, run.id, trigger);

    return { runId: run.id, jobId };
  }

  /**
   * Dispatch a manually triggered job run.
   */
  async function dispatchManualRun(
    job: typeof pluginJobs.$inferSelect,
    runId: string,
    trigger: "manual" | "retry",
  ): Promise<void> {
    const { id: jobId, pluginId, jobKey } = job;
    const jobLog = log.child({ jobId, pluginId, jobKey, runId, trigger });

    activeJobs.add(jobId);
    const startedAt = Date.now();

    try {
      await jobStore.markRunning(runId);

      await workerManager.call(
        pluginId,
        "runJob",
        {
          job: {
            jobKey,
            runId,
            trigger,
            scheduledAt: new Date().toISOString(),
          },
        },
        jobTimeoutMs,
      );

      const durationMs = Date.now() - startedAt;
      await jobStore.completeRun(runId, {
        status: "succeeded",
        durationMs,
      });

      jobLog.info({ durationMs }, "manual job completed successfully");
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const errorMessage = err instanceof Error ? err.message : String(err);
      jobLog.error({ durationMs, err: errorMessage }, "manual job failed");

      try {
        await jobStore.completeRun(runId, {
          status: "failed",
          error: errorMessage,
          durationMs,
        });
      } catch (completeErr) {
        jobLog.error(
          {
            err: completeErr instanceof Error ? completeErr.message : String(completeErr),
          },
          "failed to record manual job failure",
        );
      }
    } finally {
      activeJobs.delete(jobId);
    }
  }

  // -----------------------------------------------------------------------
  // Schedule pointer management
  // -----------------------------------------------------------------------

  /**
   * Advance the `lastRunAt` and `nextRunAt` timestamps on a job after a run.
   */
  async function advanceSchedulePointer(
    job: typeof pluginJobs.$inferSelect,
  ): Promise<void> {
    const now = new Date();
    let nextRunAt: Date | null = null;

    if (job.schedule) {
      const validationError = validateCron(job.schedule);
      if (validationError) {
        log.warn(
          { jobId: job.id, schedule: job.schedule, error: validationError },
          "invalid cron schedule — cannot compute next run",
        );
      } else {
        const cron = parseCron(job.schedule);
        nextRunAt = nextCronTick(cron, now);
      }
    }

    await jobStore.updateRunTimestamps(job.id, now, nextRunAt);
  }

  /**
   * Ensure all active jobs for a plugin have a `nextRunAt` value, and
   * enqueue them on the BullMQ queue when in BullMQ mode.
   *
   * Called when a plugin is registered with the scheduler.
   */
  async function ensureNextRunTimestamps(pluginId: string): Promise<void> {
    const jobs = await jobStore.listJobs(pluginId, "active");

    for (const job of jobs) {
      // Skip jobs without a schedule
      if (!job.schedule) {
        continue;
      }

      const validationError = validateCron(job.schedule);
      if (validationError) {
        log.warn(
          { jobId: job.id, jobKey: job.jobKey, schedule: job.schedule, error: validationError },
          "skipping job with invalid cron schedule",
        );
        continue;
      }

      const cron = parseCron(job.schedule);
      const now = new Date();
      let nextRunAt = job.nextRunAt;

      // Compute nextRunAt if missing or in the past
      if (!nextRunAt || nextRunAt.getTime() <= now.getTime()) {
        nextRunAt = nextCronTick(cron, now);

        if (nextRunAt) {
          await jobStore.updateRunTimestamps(
            job.id,
            job.lastRunAt ?? new Date(0),
            nextRunAt,
          );
          log.debug(
            { jobId: job.id, jobKey: job.jobKey, nextRunAt: nextRunAt.toISOString() },
            "computed nextRunAt for job",
          );
        }
      }

      // In BullMQ mode, enqueue the job with the appropriate delay
      if (mode === "bullmq" && nextRunAt) {
        const delayMs = Math.max(MIN_DELAY_MS, nextRunAt.getTime() - now.getTime());
        await enqueueJob(job, delayMs);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Plugin registration
  // -----------------------------------------------------------------------

  async function registerPlugin(pluginId: string): Promise<void> {
    log.info({ pluginId }, "registering plugin with job scheduler");
    await ensureNextRunTimestamps(pluginId);
  }

  async function unregisterPlugin(pluginId: string): Promise<void> {
    log.info({ pluginId }, "unregistering plugin from job scheduler");

    // Cancel any in-flight run records for this plugin that are still
    // queued or running. Active jobs in-memory will finish naturally.
    try {
      const runningRuns = await db
        .select()
        .from(pluginJobRuns)
        .where(
          and(
            eq(pluginJobRuns.pluginId, pluginId),
            or(
              eq(pluginJobRuns.status, "running"),
              eq(pluginJobRuns.status, "queued"),
            ),
          ),
        );

      for (const run of runningRuns) {
        await jobStore.completeRun(run.id, {
          status: "cancelled",
          error: "Plugin unregistered",
          durationMs: run.startedAt
            ? Date.now() - run.startedAt.getTime()
            : null,
        });
      }
    } catch (err) {
      log.error(
        {
          pluginId,
          err: err instanceof Error ? err.message : String(err),
        },
        "error cancelling in-flight runs during unregister",
      );
    }

    // Remove any active tracking for jobs owned by this plugin
    const jobs = await jobStore.listJobs(pluginId);
    for (const job of jobs) {
      activeJobs.delete(job.id);
    }
  }

  // -----------------------------------------------------------------------
  // Lifecycle: start / stop / shutdown
  // -----------------------------------------------------------------------

  function start(): void {
    if (running) {
      log.debug("scheduler already running");
      return;
    }

    running = true;

    if (isRedisConfigured()) {
      mode = "bullmq";

      // Initialize BullMQ Queue and Worker
      initBullQueue();
      initBullWorker();

      log.info(
        { maxConcurrentJobs, mode: "bullmq" },
        "plugin job scheduler started (BullMQ mode)",
      );
    } else {
      mode = "fallback";

      // Fallback: use setInterval-based polling
      tickTimer = setInterval(() => {
        void tick().catch((err: unknown) => {
          log.error(
            { err: err instanceof Error ? (err as Error).message : String(err) },
            "scheduler tick (fallback) failed",
          );
        });
      }, tickIntervalMs);

      log.info(
        { tickIntervalMs, maxConcurrentJobs, mode: "fallback" },
        "plugin job scheduler started (setInterval fallback — Redis not configured)",
      );
    }
  }

  function stop(): void {
    // Always clear the fallback timer defensively
    if (tickTimer !== null) {
      clearInterval(tickTimer);
      tickTimer = null;
    }

    if (!running) return;
    running = false;

    log.info(
      { activeJobCount: activeJobs.size, mode },
      "plugin job scheduler stopped",
    );
  }

  async function shutdown(): Promise<void> {
    stop();

    if (bullWorker) {
      await bullWorker.close();
      bullWorker = null;
    }

    if (bullQueue) {
      await bullQueue.close();
      bullQueue = null;
    }

    log.info("plugin job scheduler shut down");
  }

  // -----------------------------------------------------------------------
  // Diagnostics
  // -----------------------------------------------------------------------

  function diagnostics(): SchedulerDiagnostics {
    return {
      running,
      activeJobCount: activeJobs.size,
      activeJobIds: [...activeJobs],
      tickCount,
      lastTickAt: lastTickAt?.toISOString() ?? null,
      mode,
    };
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  return {
    start,
    stop,
    registerPlugin,
    unregisterPlugin,
    triggerJob,
    tick,
    diagnostics,
    shutdown,
  };
}
