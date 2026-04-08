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
    return { requestStartedAt: Date.now() };
  })
  .onAfterResponse(({ request, requestStartedAt, set }) => {
    const duration = Date.now() - (requestStartedAt ?? Date.now());
    const url = new URL(request.url);
    log.info(
      {
        category: "http",
        method: request.method,
        path: url.pathname,
        status: (set as { status?: number }).status ?? 200,
        durationMs: duration,
      },
      `→ ${request.method} ${url.pathname} ${(set as { status?: number }).status ?? 200}`,
    );
  })
  .onError(({ error, request }) => {
    const url = new URL(request.url);
    log.error(
      {
        category: "http.error",
        method: request.method,
        path: url.pathname,
        err: (error as any).message
      },
      `← ${request.method} ${url.pathname} error`,
    );
  });
