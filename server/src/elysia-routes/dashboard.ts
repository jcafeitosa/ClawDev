import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import { dashboardService } from "../services/dashboard.js";
import { assertCompanyAccess } from "./authz.js";
import { elysiaAuth } from "../elysia-plugins/auth.js";
import type { DeploymentMode } from "@clawdev/shared";

export function elysiaDashboardRoutes(db: Db, authPlugin: ReturnType<typeof elysiaAuth>) {
  const svc = dashboardService(db);

  return new Elysia()
    .use(authPlugin)
    .get("/companies/:companyId/dashboard", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      return svc.summary(params.companyId);
    });
}
