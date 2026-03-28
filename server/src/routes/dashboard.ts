import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import { dashboardService } from "../services/dashboard.js";
import { assertCompanyAccess } from "./authz.js";
import { authPlugin } from "../plugins/auth.js";
import type { DeploymentMode } from "@clawdev/shared";

export function dashboardRoutes(db: Db, authPlugin: ReturnType<typeof authPlugin>) {
  const svc = dashboardService(db);

  return new Elysia()
    .use(authPlugin)
    .get("/companies/:companyId/dashboard", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      return svc.summary(params.companyId);
    });
}
