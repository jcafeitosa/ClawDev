/**
 * Elysia error handler — equivalent to Express error-handling middleware.
 *
 * Catches all unhandled errors and returns consistent JSON error responses.
 */

import { Elysia } from "elysia";
import { logger } from "../middleware/logger.js";

const log = logger.child({ service: "error-handler" });

export const elysiaErrorHandler = new Elysia({ name: "error-handler" }).onError(
  ({ code, error, set }) => {
    switch (code) {
      case "NOT_FOUND":
        set.status = 404;
        return { error: "Not found" };

      case "VALIDATION":
        set.status = 400;
        return { error: "Validation error", details: error.message };

      case "PARSE":
        set.status = 400;
        return { error: "Invalid request body" };

      default:
        log.error({ code, err: (error as any).message, stack: (error as any).stack }, "Unhandled error");
        set.status = 500;
        return { error: "Internal server error" };
    }
  },
);
