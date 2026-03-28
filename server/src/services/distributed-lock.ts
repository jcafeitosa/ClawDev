/**
 * Redis-based distributed lock using SET NX EX pattern.
 * Falls back to no-op when Redis is not configured (single-instance mode).
 */
import { isRedisConfigured, getRedis } from "../redis.js";
import { logger } from "../middleware/logger.js";

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Attempt to acquire a distributed lock.
 * Returns a release function if successful, or null if the lock is held.
 */
export async function acquireLock(
  key: string,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<(() => Promise<void>) | null> {
  if (!isRedisConfigured()) {
    // Single-instance mode: always succeed (local locks handle concurrency)
    return async () => {};
  }

  const redis = getRedis();
  const lockKey = `clawdev:lock:${key}`;
  const lockValue = `${process.pid}:${Date.now()}`;
  const ttlSeconds = Math.ceil(ttlMs / 1000);

  const acquired = await redis.set(lockKey, lockValue, "EX", ttlSeconds, "NX");

  if (acquired !== "OK") {
    return null;
  }

  return async () => {
    // Only release if we still own the lock (compare-and-delete via Lua)
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    try {
      await redis.eval(script, 1, lockKey, lockValue);
    } catch (err: unknown) {
      logger.error({ err, lockKey }, "Failed to release distributed lock");
    }
  };
}

/**
 * Execute a function while holding a distributed lock.
 * Throws if the lock cannot be acquired.
 */
export async function withDistributedLock<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const release = await acquireLock(key, ttlMs);
  if (!release) {
    throw new Error(`Could not acquire lock: ${key}`);
  }

  try {
    return await fn();
  } finally {
    await release();
  }
}
