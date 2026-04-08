/**
 * Model and provider management routes — Elysia port.
 *
 * Provides model catalog browsing, provider status monitoring,
 * discovery/probe triggers, company model preferences, and
 * routing resolution preview with audit logging.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { companyModelPreferences, providerModelStatus } from "@clawdev/db";
import { modelRoutingPolicies } from "@clawdev/db";
import { and, eq } from "drizzle-orm";
import { createModelCatalogService } from "../services/model-catalog.js";
import { createProviderStatusService, getCooldownDuration } from "../services/provider-status.js";
import { createModelDiscoveryService } from "../services/model-discovery.js";
import { createModelRouterService } from "../services/model-router.js";
import { inferProviderBillingType } from "../services/provider-billing.js";
import { checkAdapterReadiness, remediateAdapterReadiness } from "../services/adapter-readiness.js";
import { listServerAdapters, listAdapterModels } from "../adapters/registry.js";
import { assertCompanyAccess, assertInstanceAdmin, getActorInfo, type Actor } from "../middleware/authz.js";
import { badRequest, notFound } from "../errors.js";
import { logger } from "../middleware/logger.js";
import { modelRoutingPolicyInputSchema } from "@clawdev/shared";
import { logActivity } from "../services/activity-log.js";

const log = logger.child({ service: "models-routes" });

function parseDateParam(value: unknown, label: string): Date | undefined {
  if (!value || typeof value !== "string") return undefined;
  const d = new Date(value);
  if (isNaN(d.getTime())) throw badRequest(`Invalid '${label}' date: ${value}`);
  return d;
}

export function modelRoutes(db: Db) {
  const catalog = createModelCatalogService(db);
  const providerStatus = createProviderStatusService(db);
  const discovery = createModelDiscoveryService(db, catalog, providerStatus);
  const router = createModelRouterService(db, providerStatus);

  return new Elysia()

    // ═══════════════════════════════════════════════════════════════════
    // MODEL CATALOG
    // ═══════════════════════════════════════════════════════════════════

    // ── Adapter readiness snapshot ────────────────────────────────────
    .get(
      "/adapters/readiness",
      async () => {
        try {
          const adapters = await checkAdapterReadiness();
          return { adapters };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get adapter readiness");
          throw err;
        }
      },
    )

    // ── Routing policies ─────────────────────────────────────────────
    .get(
      "/companies/:companyId/model-routing-policies",
      async (ctx: any) => {
        const { params } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        return {
          policies: await db
            .select()
            .from(modelRoutingPolicies)
            .where(eq(modelRoutingPolicies.companyId, params.companyId))
            .orderBy(modelRoutingPolicies.priority),
        };
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    .put(
      "/companies/:companyId/model-routing-policies",
      async (ctx: any) => {
        const { params, body } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const actorInfo = getActorInfo(actor);
        const input = modelRoutingPolicyInputSchema.parse({ ...(body ?? {}), companyId: params.companyId });
        const conditions = [eq(modelRoutingPolicies.companyId, params.companyId)];
        if (input.agentId) conditions.push(eq(modelRoutingPolicies.agentId, input.agentId));
        if (input.role) conditions.push(eq(modelRoutingPolicies.role, input.role));
        if (input.complexity) conditions.push(eq(modelRoutingPolicies.complexity, input.complexity));
        const existing = await db
          .select({ id: modelRoutingPolicies.id })
          .from(modelRoutingPolicies)
          .where(and(...conditions))
          .limit(1);
        const payload = {
          ...input,
          updatedAt: new Date(),
        };
        if (existing[0]) {
          const rows = await db
            .update(modelRoutingPolicies)
            .set(payload as any)
            .where(eq(modelRoutingPolicies.id, existing[0].id))
            .returning();
          await logActivity(db, {
            companyId: params.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: "model_routing_policy.updated",
            entityType: "model_routing_policy",
            entityId: rows[0]!.id,
            details: {
              name: rows[0]!.name,
              routingStrategy: rows[0]!.routingStrategy,
              agentId: rows[0]!.agentId ?? null,
              role: rows[0]!.role ?? null,
              complexity: rows[0]!.complexity,
            },
          });
          return rows[0]!;
        }
        const rows = await db.insert(modelRoutingPolicies).values(payload as any).returning();
        await logActivity(db, {
          companyId: params.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          runId: actorInfo.runId,
          action: "model_routing_policy.created",
          entityType: "model_routing_policy",
          entityId: rows[0]!.id,
          details: {
            name: rows[0]!.name,
            routingStrategy: rows[0]!.routingStrategy,
            agentId: rows[0]!.agentId ?? null,
            role: rows[0]!.role ?? null,
            complexity: rows[0]!.complexity,
          },
        });
        return rows[0]!;
      },
      { params: t.Object({ companyId: t.String() }), body: t.Any() },
    )

    .post(
      "/adapters/:adapterType/readiness/remediate",
      async (ctx: any) => {
        try {
          const { params, body } = ctx;
          const mode = body?.mode ?? "install";
          const result = await remediateAdapterReadiness(params.adapterType, mode);
          return result;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to remediate adapter readiness");
          throw err;
        }
      },
      {
        params: t.Object({ adapterType: t.String() }),
        body: t.Object({
          mode: t.Optional(t.Union([t.Literal("install"), t.Literal("update"), t.Literal("version")])),
        }),
      },
    )

    // ── List all models with filters ───────────────────────────────────
    .get(
      "/models",
      async ({ query }) => {
        try {
          const isFree =
            query.isFree === "true" ? true : query.isFree === "false" ? false : undefined;
          const isLocal =
            query.isLocal === "true" ? true : query.isLocal === "false" ? false : undefined;

          const catalogModels = await catalog.listModels({
            adapterType: query.adapterType as string | undefined,
            provider: query.provider as string | undefined,
            tier: query.tier as string | undefined,
            capability: query.capability as string | undefined,
            isFree,
            isLocal,
            search: query.search as string | undefined,
          });

          // Fetch all live status rows and build a lookup map
          const statusRows = await db.select().from(providerModelStatus);
          const statusMap = new Map(
            statusRows.map((s) => [`${s.adapterType}::${s.modelId}`, s]),
          );

          // Enrich catalog models with live status data
          const models = catalogModels.map((m) => {
            const status = statusMap.get(`${m.adapterType}::${m.modelId}`);
            return {
              ...m,
              // Live status fields
              circuitState: status?.status ?? "unknown",
              avgLatencyMs: status?.avgLatencyMs ?? null,
              p95LatencyMs: status?.p95LatencyMs ?? null,
              errorRatePercent: status?.errorRatePercent ?? null,
              consecutiveFailures: status?.consecutiveFailures ?? 0,
              cooldownUntil: status?.cooldownUntil ?? null,
              cooldownReason: status?.cooldownReason ?? null,
              lastProbeStatus: status?.lastProbeStatus ?? null,
              lastProbeAt: status?.lastProbeAt ?? m.lastProbedAt ?? null,
              lastHealthCheck: status?.lastProbeAt ?? m.lastProbedAt ?? null,
            };
          });

          return { models };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list models");
          throw err;
        }
      },
      {
        query: t.Object({
          adapterType: t.Optional(t.String()),
          provider: t.Optional(t.String()),
          tier: t.Optional(t.String()),
          capability: t.Optional(t.String()),
          isFree: t.Optional(t.String()),
          isLocal: t.Optional(t.String()),
          search: t.Optional(t.String()),
        }),
      },
    )

    // ── Single model detail ────────────────────────────────────────────
    .get(
      "/models/:adapterType/:modelId",
      async ({ params, set }) => {
        try {
          const model = await catalog.getModel(params.adapterType, params.modelId);
          if (!model) {
            set.status = 404;
            return { error: "Model not found in catalog" };
          }
          return model;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get model detail");
          throw err;
        }
      },
      {
        params: t.Object({
          adapterType: t.String(),
          modelId: t.String(),
        }),
      },
    )

    // ── Manual enrichment ──────────────────────────────────────────────
    .put(
      "/models/:adapterType/:modelId",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;
          assertInstanceAdmin(actor);
          const enriched = await catalog.enrichModel(
            params.adapterType,
            params.modelId,
            body as any,
          );
          return enriched;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (err instanceof Error && err.message.includes("not found")) {
            const { set } = arguments[0];
            set.status = 404;
            return { error: err.message };
          }
          log.error({ category: "http.error", err: errMsg }, "Failed to enrich model");
          throw err;
        }
      },
      {
        params: t.Object({
          adapterType: t.String(),
          modelId: t.String(),
        }),
        body: t.Object({
          tier: t.Optional(t.String()),
          capabilities: t.Optional(t.Array(t.String())),
          contextWindow: t.Optional(t.Number()),
          maxOutputTokens: t.Optional(t.Number()),
          inputPriceMicro: t.Optional(t.Number()),
          outputPriceMicro: t.Optional(t.Number()),
          isFree: t.Optional(t.Boolean()),
          freeQuotaDetail: t.Optional(t.String()),
          family: t.Optional(t.String()),
        }),
      },
    )

    // ── Trigger full discovery cycle ───────────────────────────────────
    .post(
      "/models/sync",
      async (ctx: any) => {
        try {
          const actor = ctx.actor as Actor;
          assertInstanceAdmin(actor);
          const result = await discovery.runDiscoveryCycle();
          return result;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to run discovery cycle");
          throw err;
        }
      },
    )

    // ═══════════════════════════════════════════════════════════════════
    // PROVIDER STATUS
    // ═══════════════════════════════════════════════════════════════════

    // ── Aggregated status per provider/adapter ─────────────────────────
    .get(
      "/providers/summary",
      async () => {
        try {
          const adapters = listServerAdapters();
          const statusSummary = await providerStatus.getProviderSummary();

          // Build a lookup from the status summary keyed by adapterType
          const statusByAdapter = new Map(
            statusSummary.map((s) => [s.provider, s]),
          );

          // Gather catalog models per adapter (for total count and model labels)
          const catalogModels = await catalog.listModels();
          const catalogByAdapter = new Map<string, typeof catalogModels>();
          for (const m of catalogModels) {
            const list = catalogByAdapter.get(m.adapterType) ?? [];
            list.push(m);
            catalogByAdapter.set(m.adapterType, list);
          }

          // Fetch all live status rows for per-model detail
          const allStatusRows = await db.select().from(providerModelStatus);
          const statusRowsByAdapter = new Map<string, typeof allStatusRows>();
          for (const row of allStatusRows) {
            const list = statusRowsByAdapter.get(row.adapterType) ?? [];
            list.push(row);
            statusRowsByAdapter.set(row.adapterType, list);
          }

          const summary = adapters.map((adapter) => {
            const status = statusByAdapter.get(adapter.type);
            const adapterCatalog = catalogByAdapter.get(adapter.type) ?? [];
            const adapterStatuses = statusRowsByAdapter.get(adapter.type) ?? [];
            const catalogTotal = adapterCatalog.length;

            // Build a status lookup by modelId for this adapter
            const statusByModelId = new Map(
              adapterStatuses.map((s) => [s.modelId, s]),
            );

            // Per-model details: merge catalog info with live status
            const models = adapterCatalog.map((cm) => {
              const ms = statusByModelId.get(cm.modelId);
              return {
                id: cm.modelId,
                modelId: cm.modelId,
                name: cm.label ?? cm.modelId,
                circuitState: ms?.status ?? "unknown",
                status: ms?.status ?? "unknown",
                statusDetail: ms?.statusDetail ?? null,
                avgLatencyMs: ms?.avgLatencyMs ?? null,
                errorRate: ms?.errorRatePercent ?? null,
                failureCount: ms?.consecutiveFailures ?? 0,
                cooldownEndsAt: ms?.cooldownUntil ?? null,
                cooldownReason: ms?.cooldownReason ?? null,
                lastProbed: ms?.lastProbeAt ?? cm.lastProbedAt ?? null,
                lastHealthCheck: ms?.lastProbeAt ?? cm.lastProbedAt ?? null,
              };
            });

            // When provider_model_status has no rows for this adapter,
            // keep availability at zero so untested models are not shown as ready.
            const hasStatusRows = status && status.total > 0;
            const billingType = inferProviderBillingType(adapter.authMethods ?? []);

            return {
              adapterType: adapter.type,
              label:
                adapter.type === "openai_compatible_local"
                  ? "Local Models"
                  : adapter.agentConfigurationDoc
                    ? adapter.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                    : adapter.type,
              provider: adapter.type,
              authMethods: adapter.authMethods ?? [],
              billingType,
              authConfigurable: (adapter.authMethods ?? []).length > 1,
              totalCatalog: catalogTotal,
              total: hasStatusRows ? status.total : catalogTotal,
              free: adapterCatalog.filter((model) => model.isFree).length,
              available: hasStatusRows ? status.available : 0,
              cooldown: status?.cooldown ?? 0,
              unavailable: status?.unavailable ?? 0,
              models,
            };
          });

          return { providers: summary };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get provider summary");
          throw err;
        }
      },
    )

    // ── All model statuses for one adapter ─────────────────────────────
    .get(
      "/providers/:adapterType/status",
      async ({ params }) => {
        try {
          const rows = await db
            .select()
            .from(providerModelStatus)
            .where(eq(providerModelStatus.adapterType, params.adapterType));

          return { models: rows };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get adapter status");
          throw err;
        }
      },
      {
        params: t.Object({ adapterType: t.String() }),
      },
    )

    // ── Live models from adapter (bypasses catalog) ────────────────────
    .get(
      "/providers/:adapterType/models",
      async ({ params, set }) => {
        try {
          const models = await listAdapterModels(params.adapterType);
          return { adapterType: params.adapterType, models };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list adapter models");
          set.status = 502;
          const message = err instanceof Error ? err.message : String(err);
          return { error: `Failed to list models from adapter: ${message}` };
        }
      },
      {
        params: t.Object({ adapterType: t.String() }),
      },
    )

    // ── Trigger probe for single adapter ───────────────────────────────
    .post(
      "/providers/:adapterType/probe",
      async (ctx: any) => {
        try {
          const { params } = ctx;
          const actor = ctx.actor as Actor;
          assertInstanceAdmin(actor);
          const result = await discovery.probeAdapter(params.adapterType);
          return result;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to probe adapter");
          throw err;
        }
      },
      {
        params: t.Object({ adapterType: t.String() }),
      },
    )

    // ═══════════════════════════════════════════════════════════════════
    // COOLDOWN MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════

    // ── Manually place a model into cooldown ──────────────────────────
    .post(
      "/providers/:adapterType/models/:modelId/cooldown",
      async (ctx: any) => {
        try {
          const { params, body } = ctx;
          const actor = ctx.actor as Actor;
          assertInstanceAdmin(actor);
          const durationMs = body.durationMinutes
            ? body.durationMinutes * 60 * 1000
            : getCooldownDuration(params.adapterType);
          const until = new Date(Date.now() + durationMs);
          const reason = body.reason ?? "manual_cooldown";

          await providerStatus.markCooldown(
            params.adapterType,
            params.modelId,
            until,
            reason,
          );

          return {
            adapterType: params.adapterType,
            modelId: params.modelId,
            status: "cooldown",
            cooldownUntil: until.toISOString(),
            reason,
          };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to mark model cooldown");
          throw err;
        }
      },
      {
        params: t.Object({
          adapterType: t.String(),
          modelId: t.String(),
        }),
        body: t.Object({
          durationMinutes: t.Optional(t.Number()),
          reason: t.Optional(t.String()),
        }),
      },
    )

    // ── Clear cooldown for a specific model ───────────────────────────
    .delete(
      "/providers/:adapterType/models/:modelId/cooldown",
      async (ctx: any) => {
        try {
          const { params } = ctx;
          const actor = ctx.actor as Actor;
          assertInstanceAdmin(actor);
          await providerStatus.updateStatus(
            params.adapterType,
            params.modelId,
            "available",
            "cooldown cleared manually",
          );

          // Also clear the cooldown fields
          await db
            .update(providerModelStatus)
            .set({
              cooldownUntil: null,
              cooldownReason: null,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(providerModelStatus.adapterType, params.adapterType),
                eq(providerModelStatus.modelId, params.modelId),
              ),
            );

          return {
            adapterType: params.adapterType,
            modelId: params.modelId,
            status: "available",
            cooldownUntil: null,
          };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to clear model cooldown");
          throw err;
        }
      },
      {
        params: t.Object({
          adapterType: t.String(),
          modelId: t.String(),
        }),
      },
    )

    // ── Clear all expired cooldowns across all providers ──────────────
    .post(
      "/providers/clear-expired-cooldowns",
      async (ctx: any) => {
        try {
          const actor = ctx.actor as Actor;
          assertInstanceAdmin(actor);
          const count = await providerStatus.clearExpiredCooldowns();
          return { cleared: count };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to clear expired cooldowns");
          throw err;
        }
      },
    )

    // ═══════════════════════════════════════════════════════════════════
    // COMPANY MODEL PREFERENCES
    // ═══════════════════════════════════════════════════════════════════

    // ── Get company model preferences ──────────────────────────────────
    .get(
      "/companies/:companyId/model-preferences",
      async (ctx: any) => {
        try {
          const { params } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);

          const rows = await db
            .select()
            .from(companyModelPreferences)
            .where(eq(companyModelPreferences.companyId, params.companyId))
            .limit(1);

          if (!rows[0]) {
            return {
              companyId: params.companyId,
              defaultAdapterType: null,
              defaultModelId: null,
              fallbackChain: [],
              routingStrategy: "pinned",
              allowCrossProviderFallback: true,
              preferFreeModels: false,
              preferLocalModels: false,
              maxCostPerRequestMicro: null,
            };
          }

          return rows[0];
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get company model preferences");
          throw err;
        }
      },
      {
        params: t.Object({ companyId: t.String() }),
      },
    )

    // ── Update company model preferences ───────────────────────────────
    .put(
      "/companies/:companyId/model-preferences",
      async (ctx: any) => {
        try {
          const { params, body } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);

          const input = body as Record<string, unknown>;
          const setClauses: Record<string, unknown> = {
            updatedAt: new Date(),
          };

          if (input.defaultAdapterType !== undefined) {
            setClauses.defaultAdapterType = input.defaultAdapterType;
          }
          if (input.defaultModelId !== undefined) {
            setClauses.defaultModelId = input.defaultModelId;
          } else if (input.defaultModel !== undefined) {
            setClauses.defaultModelId = input.defaultModel;
          }
          if (input.fallbackChain !== undefined) {
            setClauses.fallbackChain = input.fallbackChain;
          }
          if (input.routingStrategy !== undefined) {
            setClauses.routingStrategy = input.routingStrategy;
          }
          if (input.allowCrossProviderFallback !== undefined) {
            setClauses.allowCrossProviderFallback = input.allowCrossProviderFallback;
          }
          if (input.preferFreeModels !== undefined) {
            setClauses.preferFreeModels = input.preferFreeModels;
          }
          if (input.preferLocalModels !== undefined) {
            setClauses.preferLocalModels = input.preferLocalModels;
          }
          if (input.maxCostPerRequestMicro !== undefined) {
            setClauses.maxCostPerRequestMicro = input.maxCostPerRequestMicro;
          }

          // Upsert: insert if not exists, update if exists
          const existing = await db
            .select({ id: companyModelPreferences.id })
            .from(companyModelPreferences)
            .where(eq(companyModelPreferences.companyId, params.companyId))
            .limit(1);

          if (existing[0]) {
            const rows = await db
              .update(companyModelPreferences)
              .set(setClauses as any)
              .where(eq(companyModelPreferences.companyId, params.companyId))
              .returning();
            return rows[0]!;
          }

          const rows = await db
            .insert(companyModelPreferences)
            .values({
              companyId: params.companyId,
              ...setClauses,
            } as any)
            .returning();
          return rows[0]!;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to update company model preferences");
          throw err;
        }
      },
      {
        params: t.Object({ companyId: t.String() }),
        body: t.Object({
          defaultAdapterType: t.Optional(t.Union([t.String(), t.Null()])),
          defaultModelId: t.Optional(t.Union([t.String(), t.Null()])),
          defaultModel: t.Optional(t.Union([t.String(), t.Null()])),
          fallbackChain: t.Optional(
            t.Array(
              t.Object({
                adapterType: t.String(),
                modelId: t.String(),
              }),
            ),
          ),
          routingStrategy: t.Optional(t.String()),
          allowCrossProviderFallback: t.Optional(t.Boolean()),
          preferFreeModels: t.Optional(t.Boolean()),
          preferLocalModels: t.Optional(t.Boolean()),
          maxCostPerRequestMicro: t.Optional(t.Union([t.Number(), t.Null()])),
        }),
      },
    )

    // ═══════════════════════════════════════════════════════════════════
    // ROUTING
    // ═══════════════════════════════════════════════════════════════════

    // ── Preview routing decision ───────────────────────────────────────
    .post(
      "/companies/:companyId/model-resolve",
      async (ctx: any) => {
        try {
          const { params, body } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);

          const input = body as {
            agentId: string;
            adapterType: string;
            modelId?: string;
            role?: string;
            taskComplexity?: string;
            taskPriority?: string;
            requiredCapabilities?: string[];
          };
          const resolution = await router.resolveModel(
            params.companyId,
            input.agentId,
            input.adapterType,
            input.modelId,
            {
              routingContext: {
                role: input.role,
                complexity: input.taskComplexity as any,
                taskPriority: input.taskPriority as any,
                requiredCapabilities: input.requiredCapabilities,
              },
            },
          );

          return resolution;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to resolve model");
          throw err;
        }
      },
      {
        params: t.Object({ companyId: t.String() }),
        body: t.Object({
          agentId: t.String(),
          adapterType: t.String(),
          modelId: t.Optional(t.String()),
          role: t.Optional(t.String()),
          taskComplexity: t.Optional(t.String()),
          taskPriority: t.Optional(t.String()),
          requiredCapabilities: t.Optional(t.Array(t.String())),
        }),
      },
    )

    // ── Routing audit log ──────────────────────────────────────────────
    .get(
      "/companies/:companyId/model-routing-log",
      async (ctx: any) => {
        try {
          const { params, query } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);

          const from = parseDateParam(query.from, "from");
          const to = parseDateParam(query.to, "to");
          const limit = query.limit ? Math.min(Number(query.limit), 500) : 100;
          if (query.limit && isNaN(Number(query.limit))) {
            throw badRequest("Invalid 'limit': must be a number");
          }

          const entries = await router.getRoutingLog(params.companyId, {
            agentId: query.agentId as string | undefined,
            from,
            to,
            limit,
          });

          return { entries };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get routing log");
          throw err;
        }
      },
      {
        params: t.Object({ companyId: t.String() }),
        query: t.Object({
          agentId: t.Optional(t.String()),
          from: t.Optional(t.String()),
          to: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
      },
    );
}
