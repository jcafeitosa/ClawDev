import { EventEmitter } from "node:events";
import type { LiveEvent, LiveEventType } from "@clawdev/shared";
import { isRedisConfigured, getRedis } from "../redis.js";
import { logger } from "../middleware/logger.js";

type LiveEventPayload = Record<string, unknown>;
type LiveEventListener = (event: LiveEvent) => void;

// In-memory fallback when Redis is not configured
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

let nextEventId = 0;

function toLiveEvent(input: {
  companyId: string;
  type: LiveEventType;
  payload?: LiveEventPayload;
}): LiveEvent {
  nextEventId += 1;
  return {
    id: nextEventId,
    companyId: input.companyId,
    type: input.type,
    createdAt: new Date().toISOString(),
    payload: input.payload ?? {},
  };
}

export function publishLiveEvent(input: {
  companyId: string;
  type: LiveEventType;
  payload?: LiveEventPayload;
}) {
  const event = toLiveEvent(input);

  if (isRedisConfigured()) {
    const redis = getRedis();
    const channel = `clawdev:events:${input.companyId}`;
    const data = JSON.stringify(event);

    // Publish for real-time subscribers
    redis.publish(channel, data).catch((err: unknown) => {
      logger.error({ err, channel }, "Failed to publish live event to Redis");
    });

    // Append to stream for replay on reconnect (keep last 1000 events per company)
    redis
      .xadd(
        `clawdev:stream:${input.companyId}`,
        "MAXLEN",
        "~",
        "1000",
        "*",
        "data",
        data,
      )
      .catch((err: unknown) => {
        logger.error({ err }, "Failed to append live event to Redis stream");
      });
  } else {
    emitter.emit(input.companyId, event);
  }

  return event;
}

export function publishGlobalLiveEvent(input: {
  type: LiveEventType;
  payload?: LiveEventPayload;
}) {
  const event = toLiveEvent({ companyId: "*", type: input.type, payload: input.payload });

  if (isRedisConfigured()) {
    const redis = getRedis();
    const data = JSON.stringify(event);

    redis.publish("clawdev:events:*", data).catch((err: unknown) => {
      logger.error({ err }, "Failed to publish global live event to Redis");
    });
  } else {
    emitter.emit("*", event);
  }

  return event;
}

export function subscribeCompanyLiveEvents(companyId: string, listener: LiveEventListener) {
  if (isRedisConfigured()) {
    const sub = getRedis().duplicate();
    const channel = `clawdev:events:${companyId}`;

    sub.subscribe(channel).catch((err: unknown) => {
      logger.error({ err, channel }, "Failed to subscribe to Redis channel");
    });

    sub.on("message", (_ch: string, msg: string) => {
      try {
        listener(JSON.parse(msg) as LiveEvent);
      } catch (err: unknown) {
        logger.error({ err }, "Failed to parse live event from Redis");
      }
    });

    return () => {
      sub.unsubscribe(channel).catch(() => {});
      sub.disconnect();
    };
  }

  emitter.on(companyId, listener);
  return () => emitter.off(companyId, listener);
}

export function subscribeGlobalLiveEvents(listener: LiveEventListener) {
  if (isRedisConfigured()) {
    const sub = getRedis().duplicate();
    const channel = "clawdev:events:*";

    sub.psubscribe(channel).catch((err: unknown) => {
      logger.error({ err, channel }, "Failed to psubscribe to Redis channel");
    });

    sub.on("pmessage", (_pattern: string, _ch: string, msg: string) => {
      try {
        listener(JSON.parse(msg) as LiveEvent);
      } catch (err: unknown) {
        logger.error({ err }, "Failed to parse global live event from Redis");
      }
    });

    return () => {
      sub.punsubscribe(channel).catch(() => {});
      sub.disconnect();
    };
  }

  emitter.on("*", listener);
  return () => emitter.off("*", listener);
}

/**
 * Replay missed events from Redis stream since a given event ID.
 * Returns events the client missed while disconnected.
 */
export async function replayEvents(
  companyId: string,
  lastEventId: string,
): Promise<LiveEvent[]> {
  if (!isRedisConfigured()) return [];

  const redis = getRedis();
  const streamKey = `clawdev:stream:${companyId}`;

  const results = await redis.xrange(streamKey, lastEventId, "+");
  return results.map(([_id, fields]: [string, string[]]) => {
    const dataIdx = fields.indexOf("data");
    if (dataIdx === -1 || dataIdx + 1 >= fields.length) return null;
    return JSON.parse(fields[dataIdx + 1]!) as LiveEvent;
  }).filter(Boolean) as LiveEvent[];
}
