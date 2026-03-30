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
import { and, eq } from "drizzle-orm";
import { createModelCatalogService } from "../services/model-catalog.js";
import { createProviderStatusService } from "../services/provider-status.js";
import { createModelDiscoveryService } from "../services/model-discovery.js";
import { createModelRouterService } from "../services/model-router.js";
import { listServerAdapters, listAdapterModels } from "../adapters/registry.js";
import { assertCompanyAccess, type Actor } from "../middleware/authz.js";
import { badRequest, notFound } from "../errors.js";

function parseDateParam(value: unknown, label: string): Date | undefined {
  if (!value || typeof value !== "string") return undefined;
  const d = new Date(value);
  if (isNaN(d.getTime())) throw badRequest(`Invalid '${label}' date: ${value}`);
  return d;
}

export function modelRoutes(db: Db) {
  const catalog = createModelCatalogService(db);
  const providerStatus = createProviderStatusService(db);
  const discovery = createModelDiscoveryService(db, catalog);
  const router = createModelRouterService(db, providerStatus);

  return new Elysia()

    // ═══════════════════════════════════════════════════════════════════
    // MODEL CATALOG
    // ═══════════════════════════════════════════════════════════════════

    // ── List all models with filters ───────────────────────────────────
    .get(
      "/models",
      async ({ query }) => {
        const isFree =
          query.isFree === "true" ? true : query.isFree === "false" ? false : undefined;
        const isLocal =
          query.isLocal === "true" ? true : query.isLocal === "false" ? false : undefined;

        const models = await catalog.listModels({
          adapterType: query.adapterType as string | undefined,
          provider: query.provider as string | undefined,
          tier: query.tier as string | undefined,
          capability: query.capability as string | undefined,
          isFree,
          isLocal,
          search: query.search as string | undefined,
        });

        return { models };
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
        const model = await catalog.getModel(params.adapterType, params.modelId);
        if (!model) {
          set.status = 404;
          return { error: "Model not found in catalog" };
        }
        return model;
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
      async ({ params, body, set }) => {
        try {
          const enriched = await catalog.enrichModel(
            params.adapterType,
            params.modelId,
            body as any,
          );
          return enriched;
        } catch (err) {
          if (err instanceof Error && err.message.includes("not found")) {
            set.status = 404;
            return { error: err.message };
          }
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
      async () => {
        const result = await discovery.runDiscoveryCycle();
        return result;
      },
    )

    // ═══════════════════════════════════════════════════════════════════
    // PROVIDER STATUS
    // ═══════════════════════════════════════════════════════════════════

    // ── Aggregated status per provider/adapter ─────────────────────────
    .get(
      "/providers/summary",
      async () => {
        const adapters = listServerAdapters();
        const statusSummary = await providerStatus.getProviderSummary();

        // Build a lookup from the status summary keyed by adapterType
        const statusByAdapter = new Map(
          statusSummary.map((s) => [s.provider, s]),
        );

        // Also gather catalog counts per adapter to include total catalog models
        const catalogModels = await catalog.listModels();
        const catalogCountByAdapter = new Map<string, number>();
        for (const m of catalogModels) {
          catalogCountByAdapter.set(
            m.adapterType,
            (catalogCountByAdapter.get(m.adapterType) ?? 0) + 1,
          );
        }

        const summary = adapters.map((adapter) => {
          const status = statusByAdapter.get(adapter.type);
          const catalogTotal = catalogCountByAdapter.get(adapter.type) ?? 0;

          return {
            adapterType: adapter.type,
            label: adapter.agentConfigurationDoc
              ? adapter.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
              : adapter.type,
            provider: adapter.type,
            totalCatalog: catalogTotal,
            total: status?.total ?? 0,
            available: status?.available ?? 0,
            cooldown: status?.cooldown ?? 0,
            unavailable: status?.unavailable ?? 0,
          };
        });

        return { providers: summary };
      },
    )

    // ── All model statuses for one adapter ─────────────────────────────
    .get(
      "/providers/:adapterType/status",
      async ({ params }) => {
        const rows = await db
          .select()
          .from(providerModelStatus)
          .where(eq(providerModelStatus.adapterType, params.adapterType));

        return { models: rows };
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
      async ({ params }) => {
        const result = await discovery.probeAdapter(params.adapterType);
        return result;
      },
      {
        params: t.Object({ adapterType: t.String() }),
      },
    )

    // ═══════════════════════════════════════════════════════════════════
    // COMPANY MODEL PREFERENCES
    // ═══════════════════════════════════════════════════════════════════

    // ── Get company model preferences ──────────────────────────────────
    .get(
      "/companies/:companyId/model-preferences",
      async (ctx: any) => {
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
      },
      {
        params: t.Object({ companyId: t.String() }),
      },
    )

    // ── Update company model preferences ───────────────────────────────
    .put(
      "/companies/:companyId/model-preferences",
      async (ctx: any) => {
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
      },
      {
        params: t.Object({ companyId: t.String() }),
        body: t.Object({
          defaultAdapterType: t.Optional(t.Union([t.String(), t.Null()])),
          defaultModelId: t.Optional(t.Union([t.String(), t.Null()])),
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
        const { params, body } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);

        const input = body as { agentId: string; adapterType: string; modelId?: string };
        const resolution = await router.resolveModel(
          params.companyId,
          input.agentId,
          input.adapterType,
          input.modelId,
        );

        return resolution;
      },
      {
        params: t.Object({ companyId: t.String() }),
        body: t.Object({
          agentId: t.String(),
          adapterType: t.String(),
          modelId: t.Optional(t.String()),
        }),
      },
    )

    // ── Routing audit log ──────────────────────────────────────────────
    .get(
      "/companies/:companyId/model-routing-log",
      async (ctx: any) => {
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
