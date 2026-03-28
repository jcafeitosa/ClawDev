/**
 * Elysia error handler plugin — equivalent to Express errorHandler middleware.
 * Catches HttpError, ZodError, and generic errors.
 */
import { Elysia } from "elysia";
import { ZodError } from "zod";
import { HttpError } from "../errors.js";
import { logger } from "../middleware/logger.js";

export const errorHandler = new Elysia({ name: "error-handler" }).onError(
  ({ error, set, path, request }) => {
    if (error instanceof HttpError) {
      if (error.status >= 500) {
        logger.error(
          { err: error, method: request.method, url: path },
          error.message,
        );
      }
      set.status = error.status;
      return {
        error: error.message,
        ...(error.details ? { details: error.details } : {}),
      };
    }

    if (error instanceof ZodError) {
      set.status = 400;
      return { error: "Validation error", details: error.errors };
    }

    logger.error(
      { err: error, method: request.method, url: path },
      "Unhandled error",
    );
    set.status = 500;
    return { error: "Internal server error" };
  },
);
