/**
 * Secrets routes — Elysia port.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { companyIdParam } from "../middleware/index.js";

export function secretRoutes(db: Db) {
  return new Elysia()
    .get(
      "/companies/:companyId/secrets",
      async ({ params }) => {
        // TODO: Wire up secrets service
        return { secrets: [] };
      },
      { params: companyIdParam },
    );
}
