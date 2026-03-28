import { Elysia } from "elysia";
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
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { elysiaAuth, type Actor } from "../elysia-plugins/auth.js";

export function elysiaCompanyRoutes(db: Db, authPlugin: ReturnType<typeof elysiaAuth>, storage?: StorageService) {
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
    if (actorAgent.role !== "ceo") throw forbidden("Only CEO agents can update company branding");
  }

  async function assertCanManagePortability(actor: Actor, companyId: string, capability: "imports" | "exports") {
    assertCompanyAccess(actor, companyId);
    if (actor.type === "board") return;
    if (!actor.agentId) throw forbidden("Agent authentication required");
    const actorAgent = await agentSvc.getById(actor.agentId);
    if (!actorAgent || actorAgent.companyId !== companyId) throw forbidden("Agent key cannot access another company");
    if (actorAgent.role !== "ceo") throw forbidden(`Only CEO agents can manage company ${capability}`);
  }

  return new Elysia()
    .use(authPlugin)
    .get("/companies", async ({ actor }) => {
      assertBoard(actor);
      const result = await svc.list();
      if (actor.source === "local_implicit" || actor.isInstanceAdmin) return result;
      const allowed = new Set(actor.companyIds ?? []);
      return result.filter((company) => allowed.has(company.id));
    })
    .get("/companies/stats", async ({ actor }) => {
      assertBoard(actor);
      const allowed = actor.source === "local_implicit" || actor.isInstanceAdmin ? null : new Set(actor.companyIds ?? []);
      const stats = await svc.stats();
      if (!allowed) return stats;
      return Object.fromEntries(Object.entries(stats).filter(([companyId]) => allowed.has(companyId)));
    })
    .get("/companies/issues", ({ set }) => {
      set.status = 400;
      return { error: "Missing companyId in path. Use /api/companies/{companyId}/issues." };
    })
    .get("/companies/:companyId", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      if (actor.type !== "agent") assertBoard(actor);
      const company = await svc.getById(params.companyId);
      if (!company) throw notFound("Company not found");
      return company;
    })
    .post("/companies", async ({ body, actor, set }) => {
      assertBoard(actor);
      if (!(actor.source === "local_implicit" || actor.isInstanceAdmin)) throw forbidden("Instance admin required");
      const parsed = createCompanySchema.parse(body);
      const company = await svc.create(parsed);
      await access.ensureMembership(company.id, "user", actor.userId ?? "local-board", "owner", "active");
      await logActivity(db, {
        companyId: company.id,
        actorType: "user",
        actorId: actor.userId ?? "board",
        action: "company.created",
        entityType: "company",
        entityId: company.id,
        details: { name: company.name },
      });
      if (company.budgetMonthlyCents > 0) {
        await budgets.upsertPolicy(company.id, {
          scopeType: "company",
          scopeId: company.id,
          amount: company.budgetMonthlyCents,
          windowKind: "calendar_month_utc",
        }, actor.userId ?? "board");
      }
      set.status = 201;
      return company;
    })
    .patch("/companies/:companyId", async ({ params, body, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      const actorInfo = getActorInfo(actor);
      let parsed: Record<string, unknown>;
      if (actor.type === "agent") {
        const actorAgent = actor.agentId ? await agentSvc.getById(actor.agentId) : null;
        if (!actorAgent || actorAgent.role !== "ceo") throw forbidden("Only CEO agents or board users may update company settings");
        if (actorAgent.companyId !== params.companyId) throw forbidden("Agent key cannot access another company");
        parsed = updateCompanyBrandingSchema.parse(body);
      } else {
        assertBoard(actor);
        parsed = updateCompanySchema.parse(body);
      }
      const company = await svc.update(params.companyId, parsed);
      if (!company) throw notFound("Company not found");
      await logActivity(db, {
        companyId: params.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        runId: actorInfo.runId,
        action: "company.updated",
        entityType: "company",
        entityId: params.companyId,
        details: parsed,
      });
      return company;
    })
    .patch("/companies/:companyId/branding", async ({ params, body, actor }) => {
      await assertCanUpdateBranding(actor, params.companyId);
      const parsed = updateCompanyBrandingSchema.parse(body);
      const company = await svc.update(params.companyId, parsed);
      if (!company) throw notFound("Company not found");
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: params.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        runId: actorInfo.runId,
        action: "company.branding_updated",
        entityType: "company",
        entityId: params.companyId,
        details: parsed,
      });
      return company;
    })
    .post("/companies/:companyId/archive", async ({ params, actor }) => {
      assertBoard(actor);
      assertCompanyAccess(actor, params.companyId);
      const company = await svc.archive(params.companyId);
      if (!company) throw notFound("Company not found");
      await logActivity(db, {
        companyId: params.companyId,
        actorType: "user",
        actorId: actor.userId ?? "board",
        action: "company.archived",
        entityType: "company",
        entityId: params.companyId,
      });
      return company;
    })
    .delete("/companies/:companyId", async ({ params, actor }) => {
      assertBoard(actor);
      assertCompanyAccess(actor, params.companyId);
      const company = await svc.remove(params.companyId);
      if (!company) throw notFound("Company not found");
      return { ok: true };
    })
    .post("/companies/:companyId/export", async ({ params, body, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      const parsed = companyPortabilityExportSchema.parse(body);
      return portability.exportBundle(params.companyId, parsed);
    })
    .post("/companies/import/preview", async ({ body, actor }) => {
      assertBoard(actor);
      const parsed = companyPortabilityPreviewSchema.parse(body);
      if (parsed.target.mode === "existing_company") {
        assertCompanyAccess(actor, (parsed.target as { companyId: string }).companyId);
      }
      return portability.previewImport(parsed);
    })
    .post("/companies/import", async ({ body, actor }) => {
      assertBoard(actor);
      const parsed = companyPortabilityImportSchema.parse(body);
      if (parsed.target.mode === "existing_company") {
        assertCompanyAccess(actor, (parsed.target as { companyId: string }).companyId);
      }
      const actorInfo = getActorInfo(actor);
      const result = await portability.importBundle(parsed, actor.type === "board" ? actor.userId ?? null : null);
      await logActivity(db, {
        companyId: result.company.id,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        action: "company.imported",
        entityType: "company",
        entityId: result.company.id,
        agentId: actorInfo.agentId,
        runId: actorInfo.runId,
        details: {
          include: parsed.include ?? null,
          agentCount: result.agents.length,
          warningCount: result.warnings.length,
          companyAction: result.company.action,
        },
      });
      return result;
    })
    .post("/companies/:companyId/exports/preview", async ({ params, body, actor }) => {
      await assertCanManagePortability(actor, params.companyId, "exports");
      const parsed = companyPortabilityExportSchema.parse(body);
      return portability.previewExport(params.companyId, parsed);
    })
    .post("/companies/:companyId/exports", async ({ params, body, actor }) => {
      await assertCanManagePortability(actor, params.companyId, "exports");
      const parsed = companyPortabilityExportSchema.parse(body);
      return portability.exportBundle(params.companyId, parsed);
    })
    .post("/companies/:companyId/imports/preview", async ({ params, body, actor }) => {
      await assertCanManagePortability(actor, params.companyId, "imports");
      const parsed = companyPortabilityPreviewSchema.parse(body);
      if (parsed.target.mode === "existing_company" && (parsed.target as { companyId: string }).companyId !== params.companyId) {
        throw forbidden("Safe import route can only target the route company");
      }
      if (parsed.collisionStrategy === "replace") {
        throw forbidden("Safe import route does not allow replace collision strategy");
      }
      return portability.previewImport(parsed, { mode: "agent_safe", sourceCompanyId: params.companyId });
    })
    .post("/companies/:companyId/imports/apply", async ({ params, body, actor }) => {
      await assertCanManagePortability(actor, params.companyId, "imports");
      const parsed = companyPortabilityImportSchema.parse(body);
      if (parsed.target.mode === "existing_company" && (parsed.target as { companyId: string }).companyId !== params.companyId) {
        throw forbidden("Safe import route can only target the route company");
      }
      if (parsed.collisionStrategy === "replace") {
        throw forbidden("Safe import route does not allow replace collision strategy");
      }
      const actorInfo = getActorInfo(actor);
      const result = await portability.importBundle(parsed, actor.type === "board" ? actor.userId ?? null : null, {
        mode: "agent_safe",
        sourceCompanyId: params.companyId,
      });
      await logActivity(db, {
        companyId: result.company.id,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        entityType: "company",
        entityId: result.company.id,
        agentId: actorInfo.agentId,
        runId: actorInfo.runId,
        action: "company.imported",
        details: {
          include: parsed.include ?? null,
          agentCount: result.agents.length,
          warningCount: result.warnings.length,
          companyAction: result.company.action,
          importMode: "agent_safe",
        },
      });
      return result;
    });
}
