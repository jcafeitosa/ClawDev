/**
 * Elysia logger middleware — equivalent to pino-http for Express.
 *
 * Logs request method, path, status, and duration for each request.
 */

import { Elysia } from "elysia";
import { logger as pinoLogger } from "./logger.js";

const log = pinoLogger.child({ service: "http" });

export const elysiaLogger = new Elysia({ name: "logger" })
  .derive(({ request }) => {
    return { requestStartedAt: Date.now(), requestId: crypto.randomUUID() };
  })
  .onAfterResponse(({ request, requestStartedAt, requestId, set }) => {
    const duration = Date.now() - (requestStartedAt ?? Date.now());
    const url = new URL(request.url);
    log.info(
      {
        reqId: requestId,
        method: request.method,
        path: url.pathname,
        status: (set as { status?: number }).status ?? 200,
        durationMs: duration,
      },
      `${request.method} ${url.pathname}`,
    );
  })
  .onError(({ error, request }) => {
    const url = new URL(request.url);
    log.error(
      { method: request.method, path: url.pathname, err: error.message },
      `Error: ${request.method} ${url.pathname}`,
    );
  });
