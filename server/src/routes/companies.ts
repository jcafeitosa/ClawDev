/**
 * Company routes — full CRUD, portability (export/import), branding, archive.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import {
  companyPortabilityExportSchema,
  companyPortabilityImportSchema,
  companyPortabilityPreviewSchema,
  createCompanySchema,
  updateCompanyBrandingSchema,
  updateCompanySchema,
} from "@clawdev/shared";
import { forbidden, notFound } from "../errors.js";
import {
  accessService,
  agentService,
  budgetService,
  companyPortabilityService,
  companyService,
  logActivity,
} from "../services/index.js";
import type { StorageService } from "../storage/types.js";
import { assertBoard, assertCompanyAccess, assertInstanceAdmin, getActorInfo, type Actor } from "../middleware/authz.js";
import { isLevelCAgentRole } from "@clawdev/shared";
import { logger } from "../middleware/logger.js";

const log = logger.child({ service: "companies-routes" });

export function companyRoutes(db: Db, storage?: StorageService) {
  const svc = companyService(db);
  const agentSvc = agentService(db);
  const portability = companyPortabilityService(db, storage);
  const access = accessService(db);
  const budgets = budgetService(db);

  async function assertCanUpdateBranding(actor: Actor, companyId: string) {
    assertCompanyAccess(actor, companyId);
    if (actor.type === "board") return;
    if (!actor.agentId) throw forbidden("Agent authentication required");
    const actorAgent = await agentSvc.getById(actor.agentId);
    if (!actorAgent || actorAgent.companyId !== companyId) throw forbidden("Agent key cannot access another company");
    if (!isLevelCAgentRole(actorAgent.role)) throw forbidden("Only level C agents can update company branding");
  }

  async function assertCanManagePortability(actor: Actor, companyId: string, capability: "imports" | "exports") {
    assertCompanyAccess(actor, companyId);
    if (actor.type === "board") return;
    if (!actor.agentId) throw forbidden("Agent authentication required");
    const actorAgent = await agentSvc.getById(actor.agentId);
    if (!actorAgent || actorAgent.companyId !== companyId) throw forbidden("Agent key cannot access another company");
    if (!isLevelCAgentRole(actorAgent.role)) throw forbidden(`Only level C agents can manage company ${capability}`);
  }

  return new Elysia({ prefix: "/companies" })

    .get("/", async (ctx: any) => {
      try {
        const actor: Actor = ctx.actor;
        assertBoard(actor);
        const result = await svc.list();
        if (actor.source === "local_implicit" || actor.isInstanceAdmin) return result;
        const allowed = new Set(actor.companyIds ?? []);
        return result.filter((c) => allowed.has(c.id));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to list companies");
        throw err;
      }
    })

    .get("/stats", async (ctx: any) => {
      try {
        const actor: Actor = ctx.actor;
        assertBoard(actor);
        const allowed = actor.source === "local_implicit" || actor.isInstanceAdmin ? null : new Set(actor.companyIds ?? []);
        const stats = await svc.stats();
        if (!allowed) return stats;
        return Object.fromEntries(Object.entries(stats).filter(([id]) => allowed.has(id)));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to get company stats");
        throw err;
      }
    })

    .get("/issues", ({ set }: any) => {
      set.status = 400;
      return { error: "Missing companyId in path. Use /api/companies/{companyId}/issues." };
    })

    .get("/:companyId", async (ctx: any) => {
      try {
        const actor: Actor = ctx.actor;
        assertCompanyAccess(actor, ctx.params.companyId);
        if (actor.type !== "agent") assertBoard(actor);
        const company = await svc.getById(ctx.params.companyId);
        if (!company) throw notFound("Company not found");
        return company;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to get company");
        throw err;
      }
    }, { params: t.Object({ companyId: t.String() }) })

    .post("/", async (ctx: any) => {
      try {
        const actor: Actor = ctx.actor;
        assertBoard(actor);
        assertInstanceAdmin(actor);
        const parsed = createCompanySchema.safeParse(ctx.body);
        if (!parsed.success) {
          ctx.set.status = 400;
          return { error: "Validation error", details: parsed.error.issues };
        }
        const company = await svc.create(parsed.data);
        await access.ensureMembership(company.id, "user", actor.userId ?? "local-board", "owner", "active");
        await logActivity(db, {
          companyId: company.id, actorType: "user", actorId: actor.userId ?? "board",
          action: "company.created", entityType: "company", entityId: company.id,
          details: { name: company.name },
        });
        if (company.budgetMonthlyCents > 0) {
          await budgets.upsertPolicy(company.id, {
            scopeType: "company", scopeId: company.id,
            amount: company.budgetMonthlyCents, windowKind: "calendar_month_utc",
          }, actor.userId ?? "board");
        }
        ctx.set.status = 201;
        return company;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to create company");
        throw err;
      }
    })

    .patch("/:companyId", async (ctx: any) => {
      try {
        const actor: Actor = ctx.actor;
        const { companyId } = ctx.params;
        assertCompanyAccess(actor, companyId);
        const actorInfo = getActorInfo(actor);
        let parsed: Record<string, unknown>;
        if (actor.type === "agent") {
          const actorAgent = actor.agentId ? await agentSvc.getById(actor.agentId) : null;
          if (!actorAgent || !isLevelCAgentRole(actorAgent.role)) throw forbidden("Only level C agents or board users may update company settings");
          if (actorAgent.companyId !== companyId) throw forbidden("Agent key cannot access another company");
          parsed = updateCompanyBrandingSchema.parse(ctx.body);
        } else {
          assertBoard(actor);
          parsed = updateCompanySchema.parse(ctx.body);
        }
        const company = await svc.update(companyId, parsed);
        if (!company) throw notFound("Company not found");
        await logActivity(db, {
          companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId,
          agentId: actorInfo.agentId, runId: actorInfo.runId,
          action: "company.updated", entityType: "company", entityId: companyId, details: parsed,
        });
        return company;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to update company");
        throw err;
      }
    }, { params: t.Object({ companyId: t.String() }) })

    .patch("/:companyId/branding", async (ctx: any) => {
      try {
        const actor: Actor = ctx.actor;
        const { companyId } = ctx.params;
        const parsed = updateCompanyBrandingSchema.parse(ctx.body);
        await assertCanUpdateBranding(actor, companyId);
        const company = await svc.update(companyId, parsed);
        if (!company) throw notFound("Company not found");
        const actorInfo = getActorInfo(actor);
        await logActivity(db, {
          companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId,
          agentId: actorInfo.agentId, runId: actorInfo.runId,
          action: "company.branding_updated", entityType: "company", entityId: companyId, details: parsed,
        });
        return company;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to update company branding");
        throw err;
      }
    }, { params: t.Object({ companyId: t.String() }) })

    .post("/:companyId/archive", async (ctx: any) => {
      try {
        const actor: Actor = ctx.actor;
        const { companyId } = ctx.params;
        assertBoard(actor);
        assertCompanyAccess(actor, companyId);
        const company = await svc.archive(companyId);
        if (!company) throw notFound("Company not found");
        await logActivity(db, {
          companyId, actorType: "user", actorId: actor.userId ?? "board",
          action: "company.archived", entityType: "company", entityId: companyId,
        });
        return company;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to archive company");
        throw err;
      }
    }, { params: t.Object({ companyId: t.String() }) })

    .delete("/:companyId", async (ctx: any) => {
      try {
        const actor: Actor = ctx.actor;
        assertBoard(actor);
        assertCompanyAccess(actor, ctx.params.companyId);
        const company = await svc.remove(ctx.params.companyId);
        if (!company) throw notFound("Company not found");
        return { ok: true };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to delete company");
        throw err;
      }
    }, { params: t.Object({ companyId: t.String() }) })

    .post("/:companyId/export", async (ctx: any) => {
      try {
        const actor: Actor = ctx.actor;
        assertCompanyAccess(actor, ctx.params.companyId);
        const parsed = companyPortabilityExportSchema.parse(ctx.body);
        return portability.exportBundle(ctx.params.companyId, parsed);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to export company");
        throw err;
      }
    }, { params: t.Object({ companyId: t.String() }) })

    .post("/:companyId/exports/preview", async (ctx: any) => {
      try {
        const actor: Actor = ctx.actor;
        await assertCanManagePortability(actor, ctx.params.companyId, "exports");
        const parsed = companyPortabilityExportSchema.parse(ctx.body);
        return portability.previewExport(ctx.params.companyId, parsed);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to preview export");
        throw err;
      }
    }, { params: t.Object({ companyId: t.String() }) })

    .post("/:companyId/exports", async (ctx: any) => {
      try {
        const actor: Actor = ctx.actor;
        await assertCanManagePortability(actor, ctx.params.companyId, "exports");
        const parsed = companyPortabilityExportSchema.parse(ctx.body);
        return portability.exportBundle(ctx.params.companyId, parsed);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to export company bundle");
        throw err;
      }
    }, { params: t.Object({ companyId: t.String() }) })

    .post("/import/preview", async (ctx: any) => {
      try {
        const actor: Actor = ctx.actor;
        assertBoard(actor);
        const parsed = companyPortabilityPreviewSchema.parse(ctx.body);
        if (parsed.target.mode === "existing_company") {
          assertCompanyAccess(actor, (parsed.target as any).companyId);
        }
        return portability.previewImport(parsed);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to preview import");
        throw err;
      }
    })

    .post("/import", async (ctx: any) => {
      try {
        const actor: Actor = ctx.actor;
        assertBoard(actor);
        const parsed = companyPortabilityImportSchema.parse(ctx.body);
        if (parsed.target.mode === "existing_company") {
          assertCompanyAccess(actor, (parsed.target as any).companyId);
        }
        const actorInfo = getActorInfo(actor);
        const result = await portability.importBundle(parsed, actor.type === "board" ? actor.userId ?? null : null);
        await logActivity(db, {
          companyId: result.company.id, actorType: actorInfo.actorType, actorId: actorInfo.actorId,
          action: "company.imported", entityType: "company", entityId: result.company.id,
          agentId: actorInfo.agentId, runId: actorInfo.runId,
          details: {
            include: parsed.include ?? null, agentCount: result.agents.length,
            warningCount: result.warnings.length, companyAction: result.company.action,
          },
        });
        return result;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to import company");
        throw err;
      }
    })

    .post("/:companyId/imports/preview", async (ctx: any) => {
      try {
        const actor: Actor = ctx.actor;
        const { companyId } = ctx.params;
        await assertCanManagePortability(actor, companyId, "imports");
        const parsed = companyPortabilityPreviewSchema.parse(ctx.body);
        if (parsed.target.mode === "existing_company" && (parsed.target as any).companyId !== companyId) {
          throw forbidden("Safe import route can only target the route company");
        }
        if ((parsed as any).collisionStrategy === "replace") {
          throw forbidden("Safe import route does not allow replace collision strategy");
        }
        return portability.previewImport(parsed, { mode: "agent_safe", sourceCompanyId: companyId });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to preview safe import");
        throw err;
      }
    }, { params: t.Object({ companyId: t.String() }) })

    .post("/:companyId/imports/apply", async (ctx: any) => {
      try {
        const actor: Actor = ctx.actor;
        const { companyId } = ctx.params;
        await assertCanManagePortability(actor, companyId, "imports");
        const parsed = companyPortabilityImportSchema.parse(ctx.body);
        if (parsed.target.mode === "existing_company" && (parsed.target as any).companyId !== companyId) {
          throw forbidden("Safe import route can only target the route company");
        }
        if ((parsed as any).collisionStrategy === "replace") {
          throw forbidden("Safe import route does not allow replace collision strategy");
        }
        const actorInfo = getActorInfo(actor);
        const result = await portability.importBundle(parsed, actor.type === "board" ? actor.userId ?? null : null, {
          mode: "agent_safe", sourceCompanyId: companyId,
        });
        await logActivity(db, {
          companyId: result.company.id, actorType: actorInfo.actorType, actorId: actorInfo.actorId,
          entityType: "company", entityId: result.company.id,
          agentId: actorInfo.agentId, runId: actorInfo.runId,
          action: "company.imported",
          details: {
            include: parsed.include ?? null, agentCount: result.agents.length,
            warningCount: result.warnings.length, companyAction: result.company.action,
            importMode: "agent_safe",
          },
        });
        return result;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to apply safe import");
        throw err;
      }
    }, { params: t.Object({ companyId: t.String() }) });
}
