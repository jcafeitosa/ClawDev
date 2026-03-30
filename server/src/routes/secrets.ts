/**
 * Secrets routes — Elysia port.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { companyIdParam } from "../middleware/index.js";
import { secretService } from "../services/secrets.js";

export function secretRoutes(db: Db) {
  const svc = secretService(db);

  return new Elysia()
    .get(
      "/companies/:companyId/secrets",
      async ({ params }) => {
        const secrets = await svc.list(params.companyId);
        return secrets;
      },
      { params: companyIdParam },
    );
}
