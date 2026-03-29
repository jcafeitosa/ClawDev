/**
 * Elysia validation utilities — common validation schemas.
 *
 * Elysia uses TypeBox (t.*) for built-in validation, replacing
 * the manual Zod/AJV validation from Express middleware.
 */

import { t } from "elysia";

/** Common UUID parameter schema. */
export const uuidParam = t.Object({
  id: t.String({ format: "uuid" }),
});

/** Common company ID parameter schema. */
export const companyIdParam = t.Object({
  companyId: t.String({ format: "uuid" }),
});

/** Pagination query schema. */
export const paginationQuery = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 50 })),
});

/** Common error response. */
export const errorResponse = t.Object({
  error: t.String(),
  details: t.Optional(t.String()),
});
