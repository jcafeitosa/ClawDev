import { and, desc, eq, gte, isNotNull, lt, lte, sql } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { activityLog, agents, companies, costEvents, issues, projects } from "@clawdev/db";
import { notFound, unprocessable } from "../errors.js";
import { budgetService, type BudgetServiceHooks } from "./budgets.js";

export interface CostDateRange {
  from?: Date;
  to?: Date;
}

const METERED_BILLING_TYPE = "metered_api";
const SUBSCRIPTION_BILLING_TYPES = ["subscription_included", "subscription_overage"] as const;

/**
 * Continuous aggregate view references for raw SQL queries.
 * These materialized views are defined in the TimescaleDB migrations
 * (005_cost_continuous_aggregates.sql, 006_summary_continuous_aggregates.sql)
 * and are not part of the Drizzle schema.
 */
const CAGG = {
  /** Daily costs by company + agent + provider + biller (006) */
  costsDailyView: sql.raw("costs_daily"),
  /** Monthly costs by company + provider + biller (006) */
  costsMonthlyView: sql.raw("costs_monthly"),
  /** Daily costs by company (005) - lightweight, no agent/provider breakdown */
  costDailyByCompanyView: sql.raw("cost_daily_by_company"),
  /** Daily costs by company + provider + biller + billing_type + model (005) */
  costDailyByProviderView: sql.raw("cost_daily_by_provider"),
  /** Hourly costs by company + agent + provider + biller + billing_type + model (005) */
  costHourlyByAgentView: sql.raw("cost_hourly_by_agent"),
} as const;

/**
 * The continuous aggregate refresh policies leave a gap for recent data:
 * - costs_monthly: end_offset = 1 day
 * - costs_daily / cost_daily_by_*: end_offset = 1 hour
 * - cost_hourly_by_agent: end_offset = 2 hours
 *
 * For queries that require up-to-the-minute accuracy (e.g. budget enforcement
 * after inserting a cost event), we use a "materialized + recent" strategy:
 * query the aggregate for the materialized window, then UNION ALL with the
 * base table for the recent unmaterialized tail.
 *
 * When TimescaleDB is not available (e.g. embedded Postgres), queries fall back
 * to the base cost_events table directly.
 */
const AGGREGATE_LAG = {
  monthly: { hours: 24 },
  daily: { hours: 1 },
  hourly: { hours: 2 },
} as const;

// ---------------------------------------------------------------------------
// TimescaleDB availability detection
// ---------------------------------------------------------------------------

let _timescaleAvailable: boolean | null = null;

/**
 * Check (once, lazily) whether TimescaleDB continuous aggregates are available.
 * When running embedded Postgres without TimescaleDB extension, the materialized
 * views won't exist, and queries must fall back to the base table.
 */
async function isTimescaleAvailable(db: Db): Promise<boolean> {
  if (_timescaleAvailable !== null) return _timescaleAvailable;
  try {
    await db.execute(sql`SELECT 1 FROM costs_monthly LIMIT 0`);
    _timescaleAvailable = true;
  } catch {
    _timescaleAvailable = false;
  }
  return _timescaleAvailable;
}

function currentUtcMonthWindow(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0)),
  };
}

/**
 * Returns the current month spend using costs_monthly aggregate for the
 * materialized portion and the base table for the recent unmaterialized tail.
 *
 * When an agentId is provided, falls back entirely to the base table because
 * costs_monthly does not include the agent_id dimension.
 */
async function getMonthlySpendTotal(
  db: Db,
  scope: { companyId: string; agentId?: string | null },
) {
  const { start, end } = currentUtcMonthWindow();

  // costs_monthly does not have agent_id - fall back to base table for agent-scoped queries
  if (scope.agentId) {
    const [row] = await db
      .select({
        total: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
      })
      .from(costEvents)
      .where(
        and(
          eq(costEvents.companyId, scope.companyId),
          eq(costEvents.agentId, scope.agentId),
          gte(costEvents.occurredAt, start),
          lt(costEvents.occurredAt, end),
        ),
      );
    return Number(row?.total ?? 0);
  }

  const hasTimescale = await isTimescaleAvailable(db);

  // Without TimescaleDB, query the base table directly
  if (!hasTimescale) {
    const [row] = await db
      .select({
        total: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
      })
      .from(costEvents)
      .where(
        and(
          eq(costEvents.companyId, scope.companyId),
          gte(costEvents.occurredAt, start),
          lt(costEvents.occurredAt, end),
        ),
      );
    return Number(row?.total ?? 0);
  }

  // Combine materialized aggregate + recent unmaterialized data from base table.
  // The aggregate lag boundary ensures no double-counting.
  const lagBoundary = new Date(Date.now() - AGGREGATE_LAG.monthly.hours * 60 * 60 * 1000);

  const [row] = await db.execute<{ total: number }>(sql`
    SELECT coalesce(agg.total, 0) + coalesce(recent.total, 0) AS total
    FROM (
      SELECT sum(total_cost_cents)::int AS total
      FROM ${CAGG.costsMonthlyView}
      WHERE company_id = ${scope.companyId}
        AND bucket >= ${start}
        AND bucket < ${end}
    ) agg,
    (
      SELECT coalesce(sum(cost_cents), 0)::int AS total
      FROM cost_events
      WHERE company_id = ${scope.companyId}
        AND occurred_at >= ${lagBoundary}
        AND occurred_at < ${end}
    ) recent
  `);
  return Number(row?.total ?? 0);
}

export function costService(db: Db, budgetHooks: BudgetServiceHooks = {}) {
  const budgets = budgetService(db, budgetHooks);
  return {
    createEvent: async (companyId: string, data: Omit<typeof costEvents.$inferInsert, "companyId">) => {
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, data.agentId))
        .then((rows) => rows[0] ?? null);

      if (!agent) throw notFound("Agent not found");
      if (agent.companyId !== companyId) {
        throw unprocessable("Agent does not belong to company");
      }

      const event = await db
        .insert(costEvents)
        .values({
          ...data,
          companyId,
          biller: data.biller ?? data.provider,
          billingType: data.billingType ?? "unknown",
          cachedInputTokens: data.cachedInputTokens ?? 0,
        })
        .returning()
        .then((rows) => rows[0]);

      const [agentMonthSpend, companyMonthSpend] = await Promise.all([
        getMonthlySpendTotal(db, { companyId, agentId: event.agentId }),
        getMonthlySpendTotal(db, { companyId }),
      ]);

      await db
        .update(agents)
        .set({
          spentMonthlyCents: agentMonthSpend,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, event.agentId));

      await db
        .update(companies)
        .set({
          spentMonthlyCents: companyMonthSpend,
          updatedAt: new Date(),
        })
        .where(eq(companies.id, companyId));

      await budgets.evaluateCostEvent(event);

      return event;
    },

    summary: async (companyId: string, range?: CostDateRange) => {
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      if (!company) throw notFound("Company not found");

      // Use cost_daily_by_company aggregate when available (TimescaleDB),
      // otherwise fall back to querying the base cost_events table directly.
      const from = range?.from ?? null;
      const to = range?.to ?? null;

      let spendRow: { total: number } | undefined;
      try {
        const lagBoundary = new Date(Date.now() - AGGREGATE_LAG.daily.hours * 60 * 60 * 1000);
        const [row] = await db.execute<{ total: number }>(sql`
          SELECT coalesce(agg.total, 0) + coalesce(recent.total, 0) AS total
          FROM (
            SELECT sum(total_cost_cents)::int AS total
            FROM ${CAGG.costDailyByCompanyView}
            WHERE company_id = ${companyId}
              ${from ? sql`AND bucket >= ${from}` : sql``}
              ${to ? sql`AND bucket <= ${to}` : sql``}
              AND bucket < ${lagBoundary}
          ) agg,
          (
            SELECT coalesce(sum(cost_cents), 0)::int AS total
            FROM cost_events
            WHERE company_id = ${companyId}
              AND occurred_at >= ${lagBoundary}
              ${from ? sql`AND occurred_at >= ${from}` : sql``}
              ${to ? sql`AND occurred_at <= ${to}` : sql``}
          ) recent
        `);
        spendRow = row;
      } catch {
        // Fallback: aggregate view not available (no TimescaleDB) — query base table
        const [row] = await db.execute<{ total: number }>(sql`
          SELECT coalesce(sum(cost_cents), 0)::int AS total
          FROM cost_events
          WHERE company_id = ${companyId}
            ${from ? sql`AND occurred_at >= ${from}` : sql``}
            ${to ? sql`AND occurred_at <= ${to}` : sql``}
        `);
        spendRow = row;
      }
      const row = spendRow;

      const spendCents = Number(row?.total ?? 0);
      const utilization =
        company.budgetMonthlyCents > 0
          ? (spendCents / company.budgetMonthlyCents) * 100
          : 0;

      return {
        companyId,
        spendCents,
        budgetCents: company.budgetMonthlyCents,
        utilizationPercent: Number(utilization.toFixed(2)),
      };
    },

    byAgent: async (companyId: string, range?: CostDateRange) => {
      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      return db
        .select({
          agentId: costEvents.agentId,
          agentName: agents.name,
          agentStatus: agents.status,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
          apiRunCount:
            sql<number>`count(distinct case when ${costEvents.billingType} = ${METERED_BILLING_TYPE} then ${costEvents.heartbeatRunId} end)::int`,
          subscriptionRunCount:
            sql<number>`count(distinct case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.heartbeatRunId} end)::int`,
          subscriptionCachedInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.cachedInputTokens} else 0 end), 0)::int`,
          subscriptionInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.inputTokens} else 0 end), 0)::int`,
          subscriptionOutputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.outputTokens} else 0 end), 0)::int`,
        })
        .from(costEvents)
        .leftJoin(agents, eq(costEvents.agentId, agents.id))
        .where(and(...conditions))
        .groupBy(costEvents.agentId, agents.name, agents.status)
        .orderBy(desc(sql`coalesce(sum(${costEvents.costCents}), 0)::int`));
    },

    byProvider: async (companyId: string, range?: CostDateRange) => {
      const from = range?.from ?? null;
      const to = range?.to ?? null;

      const subscriptionTypes = sql.join(
        SUBSCRIPTION_BILLING_TYPES.map((v) => sql`${v}`),
        sql`, `,
      );

      type ByProviderRow = {
        provider: string;
        biller: string;
        billingType: string;
        model: string;
        costCents: number;
        inputTokens: number;
        cachedInputTokens: number;
        outputTokens: number;
        apiRunCount: number;
        subscriptionRunCount: number;
        subscriptionCachedInputTokens: number;
        subscriptionInputTokens: number;
        subscriptionOutputTokens: number;
      };

      const hasTs = await isTimescaleAvailable(db);

      if (hasTs) {
        // cost_daily_by_provider aggregate + recent base-table tail
        const lagBoundary = new Date(Date.now() - AGGREGATE_LAG.daily.hours * 60 * 60 * 1000);
        return db.execute<ByProviderRow>(sql`
          WITH combined AS (
            SELECT
              provider, biller, billing_type, model,
              total_cost_cents AS cost_cents,
              total_input_tokens AS input_tokens,
              total_cached_input_tokens AS cached_input_tokens,
              total_output_tokens AS output_tokens,
              NULL::uuid AS heartbeat_run_id
            FROM ${CAGG.costDailyByProviderView}
            WHERE company_id = ${companyId}
              AND bucket < ${lagBoundary}
              ${from ? sql`AND bucket >= ${from}` : sql``}
              ${to ? sql`AND bucket <= ${to}` : sql``}
            UNION ALL
            SELECT
              provider, biller, billing_type, model,
              cost_cents, input_tokens, cached_input_tokens, output_tokens, heartbeat_run_id
            FROM cost_events
            WHERE company_id = ${companyId}
              AND occurred_at >= ${lagBoundary}
              ${from ? sql`AND occurred_at >= ${from}` : sql``}
              ${to ? sql`AND occurred_at <= ${to}` : sql``}
          )
          SELECT
            provider AS "provider", biller AS "biller", billing_type AS "billingType", model AS "model",
            coalesce(sum(cost_cents), 0)::int AS "costCents",
            coalesce(sum(input_tokens), 0)::int AS "inputTokens",
            coalesce(sum(cached_input_tokens), 0)::int AS "cachedInputTokens",
            coalesce(sum(output_tokens), 0)::int AS "outputTokens",
            count(distinct case when billing_type = ${METERED_BILLING_TYPE} then heartbeat_run_id end)::int AS "apiRunCount",
            count(distinct case when billing_type in (${subscriptionTypes}) then heartbeat_run_id end)::int AS "subscriptionRunCount",
            coalesce(sum(case when billing_type in (${subscriptionTypes}) then cached_input_tokens else 0 end), 0)::int AS "subscriptionCachedInputTokens",
            coalesce(sum(case when billing_type in (${subscriptionTypes}) then input_tokens else 0 end), 0)::int AS "subscriptionInputTokens",
            coalesce(sum(case when billing_type in (${subscriptionTypes}) then output_tokens else 0 end), 0)::int AS "subscriptionOutputTokens"
          FROM combined
          GROUP BY provider, biller, billing_type, model
          ORDER BY coalesce(sum(cost_cents), 0)::int DESC
        `);
      }

      // Fallback: query base table directly (no TimescaleDB)
      return db.execute<ByProviderRow>(sql`
        SELECT
          provider AS "provider", biller AS "biller", billing_type AS "billingType", model AS "model",
          coalesce(sum(cost_cents), 0)::int AS "costCents",
          coalesce(sum(input_tokens), 0)::int AS "inputTokens",
          coalesce(sum(cached_input_tokens), 0)::int AS "cachedInputTokens",
          coalesce(sum(output_tokens), 0)::int AS "outputTokens",
          count(distinct case when billing_type = ${METERED_BILLING_TYPE} then heartbeat_run_id end)::int AS "apiRunCount",
          count(distinct case when billing_type in (${subscriptionTypes}) then heartbeat_run_id end)::int AS "subscriptionRunCount",
          coalesce(sum(case when billing_type in (${subscriptionTypes}) then cached_input_tokens else 0 end), 0)::int AS "subscriptionCachedInputTokens",
          coalesce(sum(case when billing_type in (${subscriptionTypes}) then input_tokens else 0 end), 0)::int AS "subscriptionInputTokens",
          coalesce(sum(case when billing_type in (${subscriptionTypes}) then output_tokens else 0 end), 0)::int AS "subscriptionOutputTokens"
        FROM cost_events
        WHERE company_id = ${companyId}
          ${from ? sql`AND occurred_at >= ${from}` : sql``}
          ${to ? sql`AND occurred_at <= ${to}` : sql``}
        GROUP BY provider, biller, billing_type, model
        ORDER BY coalesce(sum(cost_cents), 0)::int DESC
      `);
    },

    byBiller: async (companyId: string, range?: CostDateRange) => {
      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      return db
        .select({
          biller: costEvents.biller,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
          apiRunCount:
            sql<number>`count(distinct case when ${costEvents.billingType} = ${METERED_BILLING_TYPE} then ${costEvents.heartbeatRunId} end)::int`,
          subscriptionRunCount:
            sql<number>`count(distinct case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.heartbeatRunId} end)::int`,
          subscriptionCachedInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.cachedInputTokens} else 0 end), 0)::int`,
          subscriptionInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.inputTokens} else 0 end), 0)::int`,
          subscriptionOutputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.outputTokens} else 0 end), 0)::int`,
          providerCount: sql<number>`count(distinct ${costEvents.provider})::int`,
          modelCount: sql<number>`count(distinct ${costEvents.model})::int`,
        })
        .from(costEvents)
        .where(and(...conditions))
        .groupBy(costEvents.biller)
        .orderBy(desc(sql`coalesce(sum(${costEvents.costCents}), 0)::int`));
    },

    /**
     * Aggregates cost_events by provider for each of three rolling windows:
     * last 5 hours, last 24 hours, last 7 days.
     * Purely internal consumption data, no external rate-limit sources.
     *
     * For the 7-day window, uses cost_hourly_by_agent aggregate (grouped by
     * provider) for the materialized portion, with a base-table tail for the
     * 2-hour unmaterialized lag. Shorter windows (5h, 24h) query the base
     * table directly since the aggregate lag is a significant portion.
     */
    windowSpend: async (companyId: string) => {
      const windows = [
        { label: "5h", hours: 5, useAggregate: false },
        { label: "24h", hours: 24, useAggregate: false },
        { label: "7d", hours: 168, useAggregate: true },
      ] as const;

      const lagBoundary = new Date(Date.now() - AGGREGATE_LAG.hourly.hours * 60 * 60 * 1000);

      const results = await Promise.all(
        windows.map(async ({ label, hours, useAggregate }) => {
          const since = new Date(Date.now() - hours * 60 * 60 * 1000);

          if (useAggregate && await isTimescaleAvailable(db)) {
            // Combine hourly aggregate + recent base-table tail
            const rows = await db.execute<{
              provider: string;
              biller: string;
              costCents: number;
              inputTokens: number;
              cachedInputTokens: number;
              outputTokens: number;
            }>(sql`
              WITH combined AS (
                SELECT
                  provider,
                  biller,
                  total_cost_cents AS cost_cents,
                  total_input_tokens AS input_tokens,
                  total_cached_input_tokens AS cached_input_tokens,
                  total_output_tokens AS output_tokens
                FROM ${CAGG.costHourlyByAgentView}
                WHERE company_id = ${companyId}
                  AND bucket >= ${since}
                  AND bucket < ${lagBoundary}

                UNION ALL

                SELECT
                  provider,
                  biller,
                  cost_cents,
                  input_tokens,
                  cached_input_tokens,
                  output_tokens
                FROM cost_events
                WHERE company_id = ${companyId}
                  AND occurred_at >= ${lagBoundary}
              )
              SELECT
                provider AS "provider",
                case when count(distinct biller) = 1 then min(biller) else 'mixed' end AS "biller",
                coalesce(sum(cost_cents), 0)::int AS "costCents",
                coalesce(sum(input_tokens), 0)::int AS "inputTokens",
                coalesce(sum(cached_input_tokens), 0)::int AS "cachedInputTokens",
                coalesce(sum(output_tokens), 0)::int AS "outputTokens"
              FROM combined
              GROUP BY provider
              ORDER BY coalesce(sum(cost_cents), 0)::int DESC
            `);

            return rows.map((row) => ({
              provider: row.provider,
              biller: row.biller,
              window: label as string,
              windowHours: hours,
              costCents: row.costCents,
              inputTokens: row.inputTokens,
              cachedInputTokens: row.cachedInputTokens,
              outputTokens: row.outputTokens,
            }));
          }

          // Short windows: query the base table directly
          const rows = await db
            .select({
              provider: costEvents.provider,
              biller: sql<string>`case when count(distinct ${costEvents.biller}) = 1 then min(${costEvents.biller}) else 'mixed' end`,
              costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
              inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
              cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
              outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
            })
            .from(costEvents)
            .where(
              and(
                eq(costEvents.companyId, companyId),
                gte(costEvents.occurredAt, since),
              ),
            )
            .groupBy(costEvents.provider)
            .orderBy(desc(sql`coalesce(sum(${costEvents.costCents}), 0)::int`));

          return rows.map((row) => ({
            provider: row.provider,
            biller: row.biller,
            window: label as string,
            windowHours: hours,
            costCents: row.costCents,
            inputTokens: row.inputTokens,
            cachedInputTokens: row.cachedInputTokens,
            outputTokens: row.outputTokens,
          }));
        }),
      );

      return results.flat();
    },

    byAgentModel: async (companyId: string, range?: CostDateRange) => {
      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      // single query: group by agent + provider + model.
      // the (companyId, agentId, occurredAt) composite index covers this well.
      // order by provider + model for stable db-level ordering; cost-desc sort
      // within each agent's sub-rows is done client-side in the ui memo.
      return db
        .select({
          agentId: costEvents.agentId,
          agentName: agents.name,
          provider: costEvents.provider,
          biller: costEvents.biller,
          billingType: costEvents.billingType,
          model: costEvents.model,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
        })
        .from(costEvents)
        .leftJoin(agents, eq(costEvents.agentId, agents.id))
        .where(and(...conditions))
        .groupBy(
          costEvents.agentId,
          agents.name,
          costEvents.provider,
          costEvents.biller,
          costEvents.billingType,
          costEvents.model,
        )
        .orderBy(costEvents.provider, costEvents.biller, costEvents.billingType, costEvents.model);
    },

    byProject: async (companyId: string, range?: CostDateRange) => {
      const issueIdAsText = sql<string>`${issues.id}::text`;
      const runProjectLinks = db
        .selectDistinctOn([activityLog.runId, issues.projectId], {
          runId: activityLog.runId,
          projectId: issues.projectId,
        })
        .from(activityLog)
        .innerJoin(
          issues,
          and(
            eq(activityLog.entityType, "issue"),
            eq(activityLog.entityId, issueIdAsText),
          ),
        )
        .where(
          and(
            eq(activityLog.companyId, companyId),
            eq(issues.companyId, companyId),
            isNotNull(activityLog.runId),
            isNotNull(issues.projectId),
          ),
        )
        .orderBy(activityLog.runId, issues.projectId, desc(activityLog.createdAt))
        .as("run_project_links");

      const effectiveProjectId = sql<string | null>`coalesce(${costEvents.projectId}, ${runProjectLinks.projectId})`;
      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      const costCentsExpr = sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`;

      return db
        .select({
          projectId: effectiveProjectId,
          projectName: projects.name,
          costCents: costCentsExpr,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
        })
        .from(costEvents)
        .leftJoin(runProjectLinks, eq(costEvents.heartbeatRunId, runProjectLinks.runId))
        .innerJoin(projects, sql`${projects.id} = ${effectiveProjectId}`)
        .where(and(...conditions, sql`${effectiveProjectId} is not null`))
        .groupBy(effectiveProjectId, projects.name)
        .orderBy(desc(costCentsExpr));
    },
  };
}
