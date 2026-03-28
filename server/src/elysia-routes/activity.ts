import { Elysia } from "elysia";
import { z } from "zod";
import type { Db } from "@clawdev/db";
import { notFound } from "../errors.js";
import { activityService } from "../services/activity.js";
import { issueService } from "../services/index.js";
import { sanitizeRecord } from "../redaction.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { elysiaAuth } from "../elysia-plugins/auth.js";

const createActivitySchema = z.object({
  actorType: z.enum(["agent", "user", "system"]).optional().default("system"),
  actorId: z.string().min(1),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  agentId: z.string().uuid().optional().nullable(),
  details: z.record(z.unknown()).optional().nullable(),
});

export function elysiaActivityRoutes(db: Db, authPlugin: ReturnType<typeof elysiaAuth>) {
  const svc = activityService(db);
  const issueSvc = issueService(db);

  async function resolveIssueByRef(rawId: string) {
    if (/^[A-Z]+-\d+$/i.test(rawId)) {
      return issueSvc.getByIdentifier(rawId);
    }
    return issueSvc.getById(rawId);
  }

  return new Elysia()
    .use(authPlugin)
    .get("/companies/:companyId/activity", async ({ params, query, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      const filters = {
        companyId: params.companyId,
        agentId: (query as Record<string, string>).agentId,
        entityType: (query as Record<string, string>).entityType,
        entityId: (query as Record<string, string>).entityId,
      };
      return svc.list(filters);
    })
    .post("/companies/:companyId/activity", async ({ params, body, actor, set }) => {
      assertBoard(actor);
      const parsed = createActivitySchema.parse(body);
      const event = await svc.create({
        companyId: params.companyId,
        ...parsed,
        details: parsed.details ? sanitizeRecord(parsed.details) : null,
      });
      set.status = 201;
      return event;
    })
    .get("/issues/:id/activity", async ({ params, actor }) => {
      const issue = await resolveIssueByRef(params.id);
      if (!issue) throw notFound("Issue not found");
      assertCompanyAccess(actor, issue.companyId);
      return svc.forIssue(issue.id);
    })
    .get("/issues/:id/runs", async ({ params, actor }) => {
      const issue = await resolveIssueByRef(params.id);
      if (!issue) throw notFound("Issue not found");
      assertCompanyAccess(actor, issue.companyId);
      return svc.runsForIssue(issue.companyId, issue.id);
    })
    .get("/heartbeat-runs/:runId/issues", async ({ params }) => {
      return svc.issuesForRun(params.runId);
    });
}
