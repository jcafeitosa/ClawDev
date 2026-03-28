/**
 * BullMQ-based job scheduler. Replaces setInterval-based scheduling with
 * persistent, retryable, observable repeatable jobs.
 *
 * Falls back to setInterval when Redis is not configured.
 */
import { Queue, Worker, type Job } from "bullmq";
import { isRedisConfigured, getRedis } from "../redis.js";
import { logger } from "../middleware/logger.js";

const QUEUE_NAME = "clawdev-scheduler";

let queue: Queue | null = null;
let worker: Worker | null = null;

type JobHandler = () => Promise<void>;
const handlers = new Map<string, JobHandler>();
const fallbackTimers: ReturnType<typeof setInterval>[] = [];

function getQueue(): Queue {
  if (!queue) {
    const connection = getRedis();
    queue = new Queue(QUEUE_NAME, { connection });
  }
  return queue;
}

function ensureWorker(): void {
  if (worker) return;

  const connection = getRedis();
  worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      const handler = handlers.get(job.name);
      if (!handler) {
        logger.warn({ jobName: job.name }, "No handler registered for scheduled job");
        return;
      }
      await handler();
    },
    {
      connection,
      concurrency: 1,
    },
  );

  worker.on("failed", (job: Job | undefined, err: Error) => {
    logger.error({ err, jobName: job?.name }, "Scheduled job failed");
  });
}

/**
 * Register a repeatable job. If Redis is available, uses BullMQ.
 * Otherwise falls back to setInterval.
 */
export async function registerRepeatingJob(opts: {
  name: string;
  intervalMs: number;
  handler: JobHandler;
}): Promise<void> {
  handlers.set(opts.name, opts.handler);

  if (isRedisConfigured()) {
    ensureWorker();
    const q = getQueue();

    await q.upsertJobScheduler(
      opts.name,
      { every: opts.intervalMs },
      { name: opts.name },
    );

    logger.info(
      { jobName: opts.name, intervalMs: opts.intervalMs },
      "Registered BullMQ repeatable job",
    );
  } else {
    const timer = setInterval(() => {
      void opts.handler().catch((err: unknown) => {
        logger.error({ err, jobName: opts.name }, "Scheduled job (fallback) failed");
      });
    }, opts.intervalMs);

    fallbackTimers.push(timer);

    logger.info(
      { jobName: opts.name, intervalMs: opts.intervalMs },
      "Registered setInterval fallback job (Redis not configured)",
    );
  }
}

/**
 * Gracefully shut down the scheduler.
 */
export async function shutdownScheduler(): Promise<void> {
  for (const timer of fallbackTimers) {
    clearInterval(timer);
  }
  fallbackTimers.length = 0;

  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
}
