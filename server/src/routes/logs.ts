/**
 * Logs route — /api/logs/stream
 * Server-Sent Events (SSE) endpoint for real-time log streaming.
 * Supports optional filtering by level and category.
 *
 * Usage:
 *   GET /api/logs/stream
 *   GET /api/logs/stream?level=warn,error&category=auth,agent.run
 */

import { Elysia, t } from "elysia";
import { LogTailer } from "../services/log-tail.js";
import { logger } from "../middleware/logger.js";

export function logsRoutes() {
  return new Elysia({ prefix: "/logs" }).get(
    "/stream",
    ({ query, set }) => {
      try {
        const levels = query.level ? query.level.split(",").map((l: string) => l.trim()) : null;
        const categories = query.category ? query.category.split(",").map((c: string) => c.trim()) : null;

        // Map pino level numbers to names
        const levelMap: Record<number, string> = {
          10: "trace",
          20: "debug",
          30: "info",
          40: "warn",
          50: "error",
          60: "fatal",
        };

        // Set SSE headers
        set.headers["Content-Type"] = "text/event-stream";
        set.headers["Cache-Control"] = "no-cache";
        set.headers["Connection"] = "keep-alive";

        // Create encoder for SSE format
        const encoder = new TextEncoder();

        return new ReadableStream({
          async start(controller) {
            try {
              const tailer = new LogTailer();

              // Send initial batch of logs (last 100 lines)
              const allLogs = tailer.readAll();
              const recentLogs = allLogs.slice(-100);

              for (const log of recentLogs) {
                if (shouldEmitLog(log, levels, categories)) {
                  const event = formatSSEEvent(log);
                  controller.enqueue(encoder.encode(event));
                }
              }

              // Listen for new logs
              tailer.on("line", (log) => {
                if (shouldEmitLog(log, levels, categories)) {
                  const event = formatSSEEvent(log);
                  controller.enqueue(encoder.encode(event));
                }
              });

              tailer.start();

              // Handle stream close
              const closeHandler = () => {
                tailer.stop();
                tailer.removeAllListeners();
                controller.close();
              };

              process.on("SIGTERM", closeHandler);
              process.on("SIGINT", closeHandler);
            } catch (error) {
              logger.error({ error }, "Error in SSE stream");
              throw error;
            }
          },
        });
      } catch (error) {
        logger.error({ error }, "Error in /stream handler");
        throw error;
      }
    },
    {
      query: t.Object({
        level: t.Optional(t.String()),
        category: t.Optional(t.String()),
      }),
    },
  );
}

function shouldEmitLog(
  log: any,
  levels: string[] | null,
  categories: string[] | null,
): boolean {
  if (levels && levels.length > 0 && !levels.includes(log.level)) {
    return false;
  }

  if (categories && categories.length > 0) {
    const logCategory = log.category || "default";
    if (!categories.includes(logCategory)) {
      return false;
    }
  }

  return true;
}

function formatSSEEvent(log: any): string {
  const data = JSON.stringify(log);
  return `data: ${data}\n\n`;
}
