/**
 * BullMQ-backed Plugin Job Scheduler.
 *
 * Drop-in replacement for the tick-based PluginJobScheduler that uses
 * BullMQ repeatable jobs instead of setInterval polling. The public
 * interface is identical — consumers don't need to change.
 *
 * ## Key differences from the tick-based scheduler:
 *
 * - Jobs are dispatched by BullMQ's internal Redis-based scheduler
 *   instead of a 30s polling loop, giving sub-second scheduling accuracy.
 * - Overlap prevention uses BullMQ's built-in job deduplication (jobId).
 * - Naturally supports horizontal scaling — multiple server instances
 *   can share a single Redis and only one will process each job.
 *
 * @see ./plugin-job-scheduler.ts — Original tick-based implementation
 */

import { Queue, Worker, type Job } from "bullmq";
import type { Db } from "@clawdev/db";
import { pluginJobs, pluginJobRuns } from "@clawdev/db";
import { and, eq, or } from "drizzle-orm";
import type { PluginJobStore } from "./plugin-job-store.js";
import type { PluginWorkerManager } from "./plugin-worker-manager.js";
import type {
  PluginJobScheduler,
  PluginJobSchedulerOptions,
  TriggerJobResult,
  SchedulerDiagnostics,
} from "./plugin-job-scheduler.js";
import { getRedis } from "./redis.js";
import { logger } from "../middleware/logger.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUEUE_NAME = "plugin-jobs";
const DEFAULT_JOB_TIMEOUT_MS = 5 * 60 * 1_000;
const DEFAULT_MAX_CONCURRENT_JOBS = 10;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export interface BullMQJobSchedulerOptions extends PluginJobSchedulerOptions {
  /** Override the queue name (default: "plugin-jobs"). */
  queueName?: string;
}

/**
 * Create a BullMQ-backed plugin job scheduler.
 *
 * Maintains the same public interface as the tick-based scheduler so it
 * can be swapped in without changing any callers.
 */
export function createBullMQJobScheduler(
  options: BullMQJobSchedulerOptions,
): PluginJobScheduler {
  const {
    db,
    jobStore,
    workerManager,
    jobTimeoutMs = DEFAULT_JOB_TIMEOUT_MS,
    maxConcurrentJobs = DEFAULT_MAX_CONCURRENT_JOBS,
    queueName = QUEUE_NAME,
  } = options;

  const log = logger.child({ service: "bullmq-job-scheduler" });
  const redis = getRedis();

  // -----------------------------------------------------------------------
  // Queue & Worker
  // -----------------------------------------------------------------------

  const queue = new Queue(queueName, { connection: redis });

  let worker: Worker | null = null;
  let running = false;
  let tickCount = 0;
  let lastTickAt: Date | null = null;
  const activeJobs = new Set<string>();

  /**
   * Process a BullMQ job — called by the Worker for each dispatched job.
   */
  async function processJob(bullJob: Job): Promise<void> {
    const { jobId: pluginJobId, pluginId, jobKey, trigger } = bullJob.data as {
      jobId: string;
      pluginId: string;
      jobKey: string;
      trigger: "schedule" | "manual" | "retry";
    };

    const jobLog = log.child({ jobId: pluginJobId, pluginId, jobKey });
    tickCount++;
    lastTickAt = new Date();

    // Overlap prevention
    if (activeJobs.has(pluginJobId)) {
      jobLog.debug("skipping — already running (overlap prevention)");
      return;
    }

    // Check worker availability
    if (!workerManager.isRunning(pluginId)) {
      jobLog.debug("skipping — worker not running");
      return;
    }

    activeJobs.add(pluginJobId);
    let runId: string | undefined;
    const startedAt = Date.now();

    try {
      // Create run record
      const run = await jobStore.createRun({ jobId: pluginJobId, pluginId, trigger });
      runId = run.id;

      await jobStore.markRunning(runId);

      jobLog.info({ runId }, "dispatching job via BullMQ");

      // Call the plugin worker via RPC
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
      await jobStore.completeRun(runId, { status: "succeeded", durationMs });
      jobLog.info({ runId, durationMs }, "job completed successfully");
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const errorMessage = err instanceof Error ? err.message : String(err);
      jobLog.error({ runId, durationMs, err: errorMessage }, "job failed");

      if (runId) {
        try {
          await jobStore.completeRun(runId, { status: "failed", error: errorMessage, durationMs });
        } catch (completeErr) {
          jobLog.error({ err: (completeErr as Error).message }, "failed to record job failure");
        }
      }
    } finally {
      activeJobs.delete(pluginJobId);
    }
  }

  // -----------------------------------------------------------------------
  // Plugin registration — add/remove repeatable jobs in BullMQ
  // -----------------------------------------------------------------------

  async function registerPlugin(pluginId: string): Promise<void> {
    log.info({ pluginId }, "registering plugin with BullMQ scheduler");

    const jobs = await jobStore.listJobs(pluginId, "active");

    for (const job of jobs) {
      if (!job.schedule) continue;

      await queue.upsertJobScheduler(
        `plugin-job:${job.id}`,
        { pattern: job.schedule },
        {
          name: job.jobKey,
          data: {
            jobId: job.id,
            pluginId: job.pluginId,
            jobKey: job.jobKey,
            trigger: "schedule",
          },
        },
      );

      log.debug({ jobId: job.id, jobKey: job.jobKey, schedule: job.schedule }, "registered repeatable job");
    }
  }

  async function unregisterPlugin(pluginId: string): Promise<void> {
    log.info({ pluginId }, "unregistering plugin from BullMQ scheduler");

    const jobs = await jobStore.listJobs(pluginId);

    for (const job of jobs) {
      try {
        await queue.removeJobScheduler(`plugin-job:${job.id}`);
      } catch {
        // Ignore — may not exist
      }
      activeJobs.delete(job.id);
    }

    // Cancel in-flight runs
    try {
      const runningRuns = await db
        .select()
        .from(pluginJobRuns)
        .where(
          and(
            eq(pluginJobRuns.pluginId, pluginId),
            or(eq(pluginJobRuns.status, "running"), eq(pluginJobRuns.status, "queued")),
          ),
        );

      for (const run of runningRuns) {
        await jobStore.completeRun(run.id, {
          status: "cancelled",
          error: "Plugin unregistered",
          durationMs: run.startedAt ? Date.now() - run.startedAt.getTime() : null,
        });
      }
    } catch (err) {
      log.error({ pluginId, err: (err as Error).message }, "error cancelling runs during unregister");
    }
  }

  // -----------------------------------------------------------------------
  // Manual trigger
  // -----------------------------------------------------------------------

  async function triggerJob(
    jobId: string,
    trigger: "manual" | "retry" = "manual",
  ): Promise<TriggerJobResult> {
    const job = await jobStore.getJobById(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    if (job.status !== "active") throw new Error(`Job "${job.jobKey}" is not active (status: ${job.status})`);
    if (activeJobs.has(jobId)) throw new Error(`Job "${job.jobKey}" is already running`);

    // Add a one-off job to the queue
    await queue.add(`manual:${job.jobKey}`, {
      jobId: job.id,
      pluginId: job.pluginId,
      jobKey: job.jobKey,
      trigger,
    });

    // Create run record
    const run = await jobStore.createRun({ jobId, pluginId: job.pluginId, trigger });

    return { runId: run.id, jobId };
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  function start(): void {
    if (running) return;
    running = true;

    worker = new Worker(queueName, processJob, {
      connection: redis,
      concurrency: maxConcurrentJobs,
    });

    worker.on("failed", (job, err) => {
      log.error({ jobName: job?.name, err: err.message }, "BullMQ worker job failed");
    });

    log.info({ queueName, maxConcurrentJobs }, "BullMQ job scheduler started");
  }

  function stop(): void {
    if (!running) return;
    running = false;

    void worker?.close();
    worker = null;

    log.info({ activeJobCount: activeJobs.size }, "BullMQ job scheduler stopped");
  }

  async function tick(): Promise<void> {
    // No-op for BullMQ — scheduling is handled by Redis
    log.debug("tick() called on BullMQ scheduler — no-op");
  }

  function diagnostics(): SchedulerDiagnostics {
    return {
      running,
      activeJobCount: activeJobs.size,
      activeJobIds: [...activeJobs],
      tickCount,
      lastTickAt: lastTickAt?.toISOString() ?? null,
    };
  }

  return {
    start,
    stop,
    registerPlugin,
    unregisterPlugin,
    triggerJob,
    tick,
    diagnostics,
  };
}
