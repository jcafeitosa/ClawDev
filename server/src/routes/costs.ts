/**
 * Cost tracking routes — Elysia port.
 *
 * Provides LLM cost tracking per agent, company, and time period.
 * Also includes budget management endpoints and finance breakdowns.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import {
  agentService,
  budgetService,
  companyService,
  costService,
  financeService,
  heartbeatService,
  logActivity,
} from "../services/index.js";
import { fetchAllQuotaWindows } from "../services/quota-windows.js";
// Note: we use inline t.Object({ companyId: t.String() }) instead of companyIdParam
// because companyIdParam enforces UUID format which some callers don't use.
import { assertBoard, assertCompanyAccess, getActorInfo, type Actor } from "../middleware/authz.js";
import { badRequest, forbidden } from "../errors.js";

export function costRoutes(db: Db) {
  const heartbeat = heartbeatService(db);
  const budgetHooks = {
    cancelWorkForScope: heartbeat.cancelBudgetScopeWork,
  };
  const costs = costService(db, budgetHooks);
  const finance = financeService(db);
  const companies = companyService(db);
  const agents = agentService(db);
  const budgets = budgetService(db, budgetHooks);

  function parseDateParam(value: unknown, label: string): Date | undefined {
    if (!value || typeof value !== "string") return undefined;
    const d = new Date(value);
    if (isNaN(d.getTime())) throw badRequest(`Invalid '${label}' date: ${value}`);
    return d;
  }

  function parseDateRange(query: Record<string, unknown>) {
    const from = parseDateParam(query.from, "from");
    const to = parseDateParam(query.to, "to");
    return from || to ? { from, to } : undefined;
  }

  function parseLimit(query: Record<string, unknown>) {
    const raw = Array.isArray(query.limit) ? query.limit[0] : query.limit;
    if (raw == null || raw === "") return 100;
    const limit = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
    if (!Number.isFinite(limit) || limit <= 0 || limit > 500) {
      throw badRequest("invalid 'limit' value");
    }
    return limit;
  }

  return new Elysia()
    // ── Cost event creation ────────────────────────────────────────
    .post(
      "/companies/:companyId/cost-events",
      async (ctx: any) => {
        const { params, body } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);

        if (actor.type === "agent" && actor.agentId !== body.agentId) {
          throw forbidden("Agent can only report its own costs");
        }

        const event = await costs.createEvent(params.companyId, {
          ...body,
          occurredAt: new Date(body.occurredAt),
        });

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

        return event;
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // ── Finance event creation ─────────────────────────────────────
    .post(
      "/companies/:companyId/finance-events",
      async (ctx: any) => {
        const { params, body } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        assertBoard(actor);

        const event = await finance.createEvent(params.companyId, {
          ...body,
          occurredAt: new Date(body.occurredAt),
        });

        const actorInfo = getActorInfo(actor);
        await logActivity(db, {
          companyId: params.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          action: "finance_event.reported",
          entityType: "finance_event",
          entityId: event.id,
          details: {
            amountCents: event.amountCents,
            biller: event.biller,
            eventKind: event.eventKind,
            direction: event.direction,
          },
        });

        return event;
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // ── Cost summaries ─────────────────────────────────────────────

    // Company cost summary (primary)
    .get(
      "/companies/:companyId/costs",
      async (ctx: any) => {
        const { params, query } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const range = parseDateRange(query);
        return costs.summary(params.companyId, range);
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Cost summary alias (dashboard widgets)
    .get(
      "/companies/:companyId/costs/summary",
      async (ctx: any) => {
        const { params, query } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const range = parseDateRange(query);
        return costs.summary(params.companyId, range);
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Agent cost breakdown
    .get(
      "/companies/:companyId/costs/by-agent",
      async (ctx: any) => {
        const { params, query } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const range = parseDateRange(query);
        return costs.byAgent(params.companyId, range);
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Cost by agent + model
    .get(
      "/companies/:companyId/costs/by-agent-model",
      async (ctx: any) => {
        const { params, query } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const range = parseDateRange(query);
        return costs.byAgentModel(params.companyId, range);
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Cost by provider
    .get(
      "/companies/:companyId/costs/by-provider",
      async (ctx: any) => {
        const { params, query } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const range = parseDateRange(query);
        return costs.byProvider(params.companyId, range);
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Cost by biller
    .get(
      "/companies/:companyId/costs/by-biller",
      async (ctx: any) => {
        const { params, query } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const range = parseDateRange(query);
        return costs.byBiller(params.companyId, range);
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Cost by project
    .get(
      "/companies/:companyId/costs/by-project",
      async (ctx: any) => {
        const { params, query } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const range = parseDateRange(query);
        return costs.byProject(params.companyId, range);
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Daily cost trend
    .get(
      "/companies/:companyId/costs/daily",
      async (ctx: any) => {
        const { params, query } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const _days = Number(query.days) || 30;
        return costs.byProvider(params.companyId);
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Window spend
    .get(
      "/companies/:companyId/costs/window-spend",
      async (ctx: any) => {
        const { params } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        return costs.windowSpend(params.companyId);
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Quota windows (provider rate limits)
    .get(
      "/companies/:companyId/costs/quota-windows",
      async (ctx: any) => {
        const { params, set } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        assertBoard(actor);
        const company = await companies.getById(params.companyId);
        if (!company) {
          set.status = 404;
          return { error: "Company not found" };
        }
        return fetchAllQuotaWindows();
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // ── Finance breakdowns ─────────────────────────────────────────

    // Finance summary
    .get(
      "/companies/:companyId/costs/finance-summary",
      async (ctx: any) => {
        const { params, query } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const range = parseDateRange(query);
        return finance.summary(params.companyId, range);
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Finance by biller
    .get(
      "/companies/:companyId/costs/finance-by-biller",
      async (ctx: any) => {
        const { params, query } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const range = parseDateRange(query);
        return finance.byBiller(params.companyId, range);
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Finance by kind
    .get(
      "/companies/:companyId/costs/finance-by-kind",
      async (ctx: any) => {
        const { params, query } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const range = parseDateRange(query);
        return finance.byKind(params.companyId, range);
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Finance events list
    .get(
      "/companies/:companyId/costs/finance-events",
      async (ctx: any) => {
        const { params, query } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const range = parseDateRange(query);
        const limit = parseLimit(query);
        return finance.list(params.companyId, range, limit);
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // ── Budget management ───────────────────────────────────────────

    // Upsert budget policy
    .post(
      "/companies/:companyId/budgets/policies",
      async (ctx: any) => {
        const { params, body } = ctx;
        const actor = ctx.actor as Actor;
        assertBoard(actor);
        assertCompanyAccess(actor, params.companyId);
        return budgets.upsertPolicy(params.companyId, body, actor.userId ?? "board");
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Resolve budget incident
    .post(
      "/companies/:companyId/budget-incidents/:incidentId/resolve",
      async (ctx: any) => {
        const { params, body } = ctx;
        const actor = ctx.actor as Actor;
        assertBoard(actor);
        assertCompanyAccess(actor, params.companyId);
        return budgets.resolveIncident(params.companyId, params.incidentId, body, actor.userId ?? "board");
      },
      { params: t.Object({ companyId: t.String(), incidentId: t.String() }) },
    )

    // Update company budget
    .patch(
      "/companies/:companyId/budgets",
      async (ctx: any) => {
        const { params, body, set } = ctx;
        const actor = ctx.actor as Actor;
        assertBoard(actor);
        assertCompanyAccess(actor, params.companyId);
        const company = await companies.update(params.companyId, { budgetMonthlyCents: body.budgetMonthlyCents });
        if (!company) {
          set.status = 404;
          return { error: "Company not found" };
        }

        await logActivity(db, {
          companyId: params.companyId,
          actorType: "user",
          actorId: actor.userId ?? "board",
          action: "company.budget_updated",
          entityType: "company",
          entityId: params.companyId,
          details: { budgetMonthlyCents: body.budgetMonthlyCents },
        });

        await budgets.upsertPolicy(
          params.companyId,
          {
            scopeType: "company",
            scopeId: params.companyId,
            amount: body.budgetMonthlyCents,
            windowKind: "calendar_month_utc",
          },
          actor.userId ?? "board",
        );

        return company;
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Update agent budget
    .patch(
      "/agents/:id/budgets",
      async (ctx: any) => {
        const { params, body, set } = ctx;
        const actor = ctx.actor as Actor;
        const agent = await agents.getById(params.id);
        if (!agent) {
          set.status = 404;
          return { error: "Agent not found" };
        }

        assertCompanyAccess(actor, agent.companyId);

        if (actor.type === "agent") {
          if (actor.agentId !== params.id) {
            throw forbidden("Agent can only change its own budget");
          }
        }

        const updated = await agents.update(params.id, { budgetMonthlyCents: body.budgetMonthlyCents });
        if (!updated) {
          set.status = 404;
          return { error: "Agent not found" };
        }

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

        await budgets.upsertPolicy(
          updated.companyId,
          {
            scopeType: "agent",
            scopeId: updated.id,
            amount: updated.budgetMonthlyCents,
            windowKind: "calendar_month_utc",
          },
          actor.type === "board" ? actor.userId ?? "board" : null,
        );

        return updated;
      },
      { params: t.Object({ id: t.String() }) },
    );
}
