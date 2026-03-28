import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import {
  createCostEventSchema,
  createFinanceEventSchema,
  resolveBudgetIncidentSchema,
  updateBudgetSchema,
  upsertBudgetPolicySchema,
} from "@clawdev/shared";
import { badRequest, forbidden, notFound } from "../errors.js";
import {
  budgetService,
  costService,
  financeService,
  companyService,
  agentService,
  heartbeatService,
  logActivity,
} from "../services/index.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { fetchAllQuotaWindows } from "../services/quota-windows.js";
import { authPlugin } from "../plugins/auth.js";

function parseDateRange(query: Record<string, string>) {
  const from = query.from ? new Date(query.from) : undefined;
  const to = query.to ? new Date(query.to) : undefined;
  if (from && isNaN(from.getTime())) throw badRequest("invalid 'from' date");
  if (to && isNaN(to.getTime())) throw badRequest("invalid 'to' date");
  return from || to ? { from, to } : undefined;
}

function parseLimit(query: Record<string, string>) {
  const raw = query.limit;
  if (raw == null || raw === "") return 100;
  const limit = Number.parseInt(raw, 10);
  if (!Number.isFinite(limit) || limit <= 0 || limit > 500) throw badRequest("invalid 'limit' value");
  return limit;
}

export function costRoutes(db: Db, authPlugin: ReturnType<typeof authPlugin>) {
  const heartbeat = heartbeatService(db);
  const budgetHooks = { cancelWorkForScope: heartbeat.cancelBudgetScopeWork };
  const costs = costService(db, budgetHooks);
  const finance = financeService(db);
  const budgets = budgetService(db, budgetHooks);
  const companies = companyService(db);
  const agents = agentService(db);

  return new Elysia()
    .use(authPlugin)
    .post("/companies/:companyId/cost-events", async ({ params, body, actor, set }) => {
      assertCompanyAccess(actor, params.companyId);
      const parsed = createCostEventSchema.parse(body);
      if (actor.type === "agent" && actor.agentId !== parsed.agentId) {
        throw forbidden("Agent can only report its own costs");
      }
      const event = await costs.createEvent(params.companyId, { ...parsed, occurredAt: new Date(parsed.occurredAt) });
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: params.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        action: "cost.reported",
        entityType: "cost_event",
        entityId: event.id,
        details: { costCents: event.costCents, model: event.model },
      });
      set.status = 201;
      return event;
    })
    .post("/companies/:companyId/finance-events", async ({ params, body, actor, set }) => {
      assertCompanyAccess(actor, params.companyId);
      assertBoard(actor);
      const parsed = createFinanceEventSchema.parse(body);
      const event = await finance.createEvent(params.companyId, { ...parsed, occurredAt: new Date(parsed.occurredAt) });
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: params.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        action: "finance_event.reported",
        entityType: "finance_event",
        entityId: event.id,
        details: { amountCents: event.amountCents, biller: event.biller, eventKind: event.eventKind, direction: event.direction },
      });
      set.status = 201;
      return event;
    })
    .get("/companies/:companyId/costs/summary", async ({ params, query, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      return costs.summary(params.companyId, parseDateRange(query as Record<string, string>));
    })
    .get("/companies/:companyId/costs/by-agent", async ({ params, query, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      return costs.byAgent(params.companyId, parseDateRange(query as Record<string, string>));
    })
    .get("/companies/:companyId/costs/by-agent-model", async ({ params, query, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      return costs.byAgentModel(params.companyId, parseDateRange(query as Record<string, string>));
    })
    .get("/companies/:companyId/costs/by-provider", async ({ params, query, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      return costs.byProvider(params.companyId, parseDateRange(query as Record<string, string>));
    })
    .get("/companies/:companyId/costs/by-biller", async ({ params, query, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      return costs.byBiller(params.companyId, parseDateRange(query as Record<string, string>));
    })
    .get("/companies/:companyId/costs/finance-summary", async ({ params, query, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      return finance.summary(params.companyId, parseDateRange(query as Record<string, string>));
    })
    .get("/companies/:companyId/costs/finance-by-biller", async ({ params, query, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      return finance.byBiller(params.companyId, parseDateRange(query as Record<string, string>));
    })
    .get("/companies/:companyId/costs/finance-by-kind", async ({ params, query, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      return finance.byKind(params.companyId, parseDateRange(query as Record<string, string>));
    })
    .get("/companies/:companyId/costs/finance-events", async ({ params, query, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      const q = query as Record<string, string>;
      return finance.list(params.companyId, parseDateRange(q), parseLimit(q));
    })
    .get("/companies/:companyId/costs/window-spend", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      return costs.windowSpend(params.companyId);
    })
    .get("/companies/:companyId/costs/quota-windows", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      assertBoard(actor);
      const company = await companies.getById(params.companyId);
      if (!company) throw notFound("Company not found");
      return fetchAllQuotaWindows();
    })
    .get("/companies/:companyId/budgets/overview", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      return budgets.overview(params.companyId);
    })
    .post("/companies/:companyId/budgets/policies", async ({ params, body, actor }) => {
      assertBoard(actor);
      assertCompanyAccess(actor, params.companyId);
      const parsed = upsertBudgetPolicySchema.parse(body);
      return budgets.upsertPolicy(params.companyId, parsed, actor.userId ?? "board");
    })
    .post("/companies/:companyId/budget-incidents/:incidentId/resolve", async ({ params, body, actor }) => {
      assertBoard(actor);
      assertCompanyAccess(actor, params.companyId);
      const parsed = resolveBudgetIncidentSchema.parse(body);
      return budgets.resolveIncident(params.companyId, params.incidentId, parsed, actor.userId ?? "board");
    })
    .get("/companies/:companyId/costs/by-project", async ({ params, query, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      return costs.byProject(params.companyId, parseDateRange(query as Record<string, string>));
    })
    .patch("/companies/:companyId/budgets", async ({ params, body, actor }) => {
      assertBoard(actor);
      assertCompanyAccess(actor, params.companyId);
      const parsed = updateBudgetSchema.parse(body);
      const company = await companies.update(params.companyId, { budgetMonthlyCents: parsed.budgetMonthlyCents });
      if (!company) throw notFound("Company not found");
      await logActivity(db, {
        companyId: params.companyId,
        actorType: "user",
        actorId: actor.userId ?? "board",
        action: "company.budget_updated",
        entityType: "company",
        entityId: params.companyId,
        details: { budgetMonthlyCents: parsed.budgetMonthlyCents },
      });
      await budgets.upsertPolicy(params.companyId, {
        scopeType: "company",
        scopeId: params.companyId,
        amount: parsed.budgetMonthlyCents,
        windowKind: "calendar_month_utc",
      }, actor.userId ?? "board");
      return company;
    })
    .patch("/agents/:id/budgets", async ({ params, body, actor }) => {
      const parsed = updateBudgetSchema.parse(body);
      const agent = await agents.getById(params.id);
      if (!agent) throw notFound("Agent not found");
      assertCompanyAccess(actor, agent.companyId);
      if (actor.type === "agent" && actor.agentId !== params.id) {
        throw forbidden("Agent can only change its own budget");
      }
      const updated = await agents.update(params.id, { budgetMonthlyCents: parsed.budgetMonthlyCents });
      if (!updated) throw notFound("Agent not found");
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: updated.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        action: "agent.budget_updated",
        entityType: "agent",
        entityId: updated.id,
        details: { budgetMonthlyCents: updated.budgetMonthlyCents },
      });
      await budgets.upsertPolicy(updated.companyId, {
        scopeType: "agent",
        scopeId: updated.id,
        amount: updated.budgetMonthlyCents,
        windowKind: "calendar_month_utc",
      }, actor.type === "board" ? actor.userId ?? "board" : null);
      return updated;
    });
}
