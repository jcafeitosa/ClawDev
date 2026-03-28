import * as IORedis from "ioredis";
import { logger } from "./middleware/logger.js";

// ioredis ESM interop
const RedisClass = ((IORedis as Record<string, unknown>).default ?? IORedis) as unknown as new (
  url: string,
  opts?: Record<string, unknown>,
) => IORedis.Redis;

let redisInstance: IORedis.Redis | null = null;

function getRedisUrl(): string {
  return process.env.REDIS_URL ?? process.env.CLAWDEV_REDIS_URL ?? "redis://localhost:6379";
}

export function getRedis(): IORedis.Redis {
  if (redisInstance) return redisInstance;

  const instance = new RedisClass(getRedisUrl(), {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  instance.on("error", (err: unknown) => {
    logger.error({ err }, "Redis connection error");
  });

  instance.on("connect", () => {
    logger.info("Redis connected");
  });

  redisInstance = instance;
  return instance;
}

export async function connectRedis(): Promise<IORedis.Redis> {
  const redis = getRedis();
  // Only connect if not already connected or connecting
  if (redis.status === "wait" || redis.status === "close" || redis.status === "end") {
    await redis.connect();
  }
  return redis;
}

export async function disconnectRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
  }
}

export function isRedisConfigured(): boolean {
  return !!(process.env.REDIS_URL ?? process.env.CLAWDEV_REDIS_URL);
}
