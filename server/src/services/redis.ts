/**
 * Redis connection singleton.
 *
 * Provides a shared IORedis connection for BullMQ queues, quota-window
 * caching, and any future Redis-backed features.
 *
 * Connection string is read from `REDIS_URL` env var, falling back to
 * `redis://localhost:6379` for local development.
 */

import Redis from "ioredis";
import { logger } from "../middleware/logger.js";

const log = logger.child({ service: "redis" });

let connection: Redis | null = null;

/**
 * Get or create the shared Redis connection.
 *
 * Subsequent calls return the same instance. The connection is configured
 * with `maxRetriesPerRequest: null` as required by BullMQ.
 */
export function getRedis(): Redis {
  if (connection) return connection;

  const url = process.env.REDIS_URL ?? "redis://localhost:6379";

  connection = new Redis(url, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: true,
    lazyConnect: false,
  });

  connection.on("connect", () => {
    log.info({ url: url.replace(/\/\/.*@/, "//<redacted>@") }, "Redis connected");
  });

  connection.on("error", (err) => {
    log.error({ err: err.message }, "Redis connection error");
  });

  connection.on("close", () => {
    log.info("Redis connection closed");
  });

  return connection;
}

/**
 * Check if Redis is available by sending a PING.
 * Returns true if connected, false otherwise.
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const redis = getRedis();
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

/**
 * Gracefully disconnect Redis on server shutdown.
 */
export async function disconnectRedis(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
    log.info("Redis disconnected");
  }
}
