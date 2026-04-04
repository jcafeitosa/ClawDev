/**
 * Error handlers — Elysia (production) and Express (test compatibility).
 *
 * The Elysia handler is used in the actual app via elysia-app.ts.
 * The Express handler is kept for backward-compatible test suites that
 * still use supertest + Express to exercise route logic.
 */

import { Elysia } from "elysia";
import { HttpError } from "../errors.js";
import { logger } from "../middleware/logger.js";

const log = logger.child({ service: "error-handler" });

// ── Elysia handler (production) ─────────────────────────────────────────

export const elysiaErrorHandler = new Elysia({ name: "error-handler" }).onError(
  ({ code, error, set, request }) => {
    switch (code) {
      case "NOT_FOUND":
        set.status = 404;
        return new URL(request.url).pathname.startsWith("/api/")
          ? { error: "API route not found" }
          : { error: "Not found" };

      case "VALIDATION":
        set.status = 400;
        return { error: "Validation error", details: error.message };

      case "PARSE":
        set.status = 400;
        return { error: "Invalid request body" };

      default: {
        if (error instanceof HttpError) {
          set.status = error.status;
          return error.details
            ? { error: error.message, details: error.details }
            : { error: error.message };
        }
        const msg = (error as any)?.message ?? String(error);
        log.error({ code, err: msg, stack: (error as any)?.stack }, "Unhandled error");
        set.status = 500;
        // Never leak internal error details (DB errors, stack traces) to clients
        return { error: "Internal server error" };
      }
    }
  },
);

// ── Express handler (test compatibility) ────────────────────────────────

export function errorHandler(err: unknown, req: any, res: any, _next: any) {
  const r = res as any;

  if (err instanceof HttpError) {
    r.err = err;
    if (err.status >= 500) {
      r.__errorContext = { error: { message: err.message } };
    }
    res.status(err.status).json(
      err.details ? { error: err.message, details: err.details } : { error: err.message },
    );
    return;
  }

  if (err && typeof err === "object" && "issues" in err) {
    // ZodError
    res.status(400).json({ error: "Validation error", details: (err as any).issues });
    return;
  }

  r.err = err;
  r.__errorContext = { error: { message: (err as Error).message } };
  res.status(500).json({ error: "Internal server error" });
}
