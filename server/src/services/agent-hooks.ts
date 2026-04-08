const randomUUID = () => crypto.randomUUID();
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import {
  agentHooks,
  agentHookRuns,
  companyHookTemplates,
} from "@clawdev/db";
import type {
  AgentHookEvent,
  AgentHookType,
  AgentHookRunStatus,
} from "@clawdev/db";
import { notFound } from "../errors.js";
import { logger } from "../middleware/logger.js";
import { publishLiveEvent } from "./live-events.js";
import { logActivity } from "./activity-log.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateHookInput {
  name: string;
  description?: string | null;
  event: AgentHookEvent;
  hookType: AgentHookType;
  config?: Record<string, unknown>;
  conditions?: Record<string, unknown>;
  enabled?: boolean;
  priority?: number;
  runAsync?: boolean;
  timeoutMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
  createdByAgentId?: string | null;
  createdByUserId?: string | null;
}

interface UpdateHookInput {
  name?: string;
  description?: string | null;
  event?: AgentHookEvent;
  hookType?: AgentHookType;
  config?: Record<string, unknown>;
  conditions?: Record<string, unknown>;
  enabled?: boolean;
  priority?: number;
  runAsync?: boolean;
  timeoutMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
}

interface CreateTemplateInput {
  name: string;
  description?: string | null;
  event: AgentHookEvent;
  hookType: AgentHookType;
  config?: Record<string, unknown>;
  conditions?: Record<string, unknown>;
  isDefault?: boolean;
}

interface WebhookConfig {
  url: string;
  headers?: Record<string, string>;
  method?: string;
}

interface WakeAgentConfig {
  targetAgentId: string;
  context?: Record<string, unknown>;
}

interface CreateIssueConfig {
  projectId: string;
  title: string;
  description?: string;
  priority?: string;
}

interface NotifyChannelConfig {
  channelId: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Webhook execution helper
// ---------------------------------------------------------------------------

async function executeWebhook(
  config: { url: string; headers?: Record<string, string>; method?: string },
  payload: unknown,
): Promise<{ status: number; body: unknown }> {
  const resp = await fetch(config.url, {
    method: config.method || "POST",
    headers: { "Content-Type": "application/json", ...config.headers },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  return { status: resp.status, body: await resp.json().catch(() => null) };
}

// ---------------------------------------------------------------------------
// Condition evaluator
// ---------------------------------------------------------------------------

function evaluateConditions(
  conditions: Record<string, unknown>,
  payload: Record<string, unknown>,
): boolean {
  for (const [key, expected] of Object.entries(conditions)) {
    const actual = payload[key];

    // Regex match: condition value is a string starting with "/"
    if (typeof expected === "string" && expected.startsWith("/")) {
      const lastSlash = expected.lastIndexOf("/");
      if (lastSlash > 0) {
        const pattern = expected.slice(1, lastSlash);
        const flags = expected.slice(lastSlash + 1);
        try {
          const regex = new RegExp(pattern, flags);
          if (!regex.test(String(actual ?? ""))) return false;
          continue;
        } catch {
          // Malformed regex falls through to exact match
        }
      }
    }

    // Array includes: condition is an array, actual must be in it
    if (Array.isArray(expected)) {
      if (!expected.includes(actual)) return false;
      continue;
    }

    // Exact match
    if (actual !== expected) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

export function agentHookService(db: Db) {
  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  async function create(
    companyId: string,
    agentId: string,
    data: CreateHookInput,
  ) {
    const id = randomUUID();
    const now = new Date();
    const [hook] = await db
      .insert(agentHooks)
      .values({
        id,
        companyId,
        agentId,
        name: data.name,
        description: data.description ?? null,
        event: data.event,
        hookType: data.hookType,
        config: data.config ?? {},
        conditions: data.conditions ?? {},
        enabled: data.enabled ?? true,
        priority: data.priority ?? 0,
        runAsync: data.runAsync ?? false,
        timeoutMs: data.timeoutMs ?? 30_000,
        retryCount: data.retryCount ?? 0,
        retryDelayMs: data.retryDelayMs ?? 1_000,
        createdByAgentId: data.createdByAgentId ?? null,
        createdByUserId: data.createdByUserId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await logActivity(db, {
      companyId,
      actorType: data.createdByAgentId ? "agent" : data.createdByUserId ? "user" : "system",
      actorId: data.createdByAgentId ?? data.createdByUserId ?? "system",
      action: "agent_hook.created",
      entityType: "agent_hook",
      entityId: id,
      agentId,
      details: { event: data.event, hookType: data.hookType },
    });

    return hook!;
  }

  async function update(hookId: string, data: UpdateHookInput) {
    const [updated] = await db
      .update(agentHooks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agentHooks.id, hookId))
      .returning();

    if (!updated) throw notFound(`Hook ${hookId} not found`);
    return updated;
  }

  async function deleteHook(hookId: string) {
    const [deleted] = await db
      .delete(agentHooks)
      .where(eq(agentHooks.id, hookId))
      .returning();

    if (!deleted) throw notFound(`Hook ${hookId} not found`);
    return deleted;
  }

  async function list(
    agentId: string,
    filters: { event?: AgentHookEvent; enabled?: boolean } = {},
  ) {
    const conditions = [eq(agentHooks.agentId, agentId)];
    if (filters.event) conditions.push(eq(agentHooks.event, filters.event));
    if (filters.enabled !== undefined)
      conditions.push(eq(agentHooks.enabled, filters.enabled));

    return db
      .select()
      .from(agentHooks)
      .where(and(...conditions))
      .orderBy(agentHooks.priority);
  }

  async function listForCompany(
    companyId: string,
    filters: { event?: AgentHookEvent; agentId?: string } = {},
  ) {
    const conditions = [eq(agentHooks.companyId, companyId)];
    if (filters.event) conditions.push(eq(agentHooks.event, filters.event));
    if (filters.agentId) conditions.push(eq(agentHooks.agentId, filters.agentId));

    return db
      .select()
      .from(agentHooks)
      .where(and(...conditions))
      .orderBy(agentHooks.priority);
  }

  async function getById(hookId: string) {
    const [hook] = await db
      .select()
      .from(agentHooks)
      .where(eq(agentHooks.id, hookId))
      .limit(1);

    if (!hook) throw notFound(`Hook ${hookId} not found`);
    return hook;
  }

  // -------------------------------------------------------------------------
  // Hook execution
  // -------------------------------------------------------------------------

  async function executeHookAction(
    hook: typeof agentHooks.$inferSelect,
    payload: Record<string, unknown>,
    runId: string | undefined,
  ): Promise<{ result: Record<string, unknown> | null; error: string | null }> {
    const config = hook.config;

    switch (hook.hookType) {
      case "webhook": {
        const webhookCfg = config as unknown as WebhookConfig;
        const res = await executeWebhook(webhookCfg, {
          event: hook.event,
          agentId: hook.agentId,
          hookId: hook.id,
          runId,
          payload,
          firedAt: new Date().toISOString(),
        });
        if (res.status >= 400) {
          return {
            result: { status: res.status, body: res.body },
            error: `Webhook returned status ${res.status}`,
          };
        }
        return { result: { status: res.status, body: res.body }, error: null };
      }

      case "wake_agent": {
        const wakeCfg = config as unknown as WakeAgentConfig;
        // Insert a wakeup request for the target agent.
        // The heartbeat service picks these up on the next cycle.
        const { agentWakeupRequests } = await import("@clawdev/db");
        await db.insert(agentWakeupRequests).values({
          companyId: hook.companyId,
          agentId: wakeCfg.targetAgentId,
          source: "hook",
          triggerDetail: JSON.stringify({
            sourceAgentId: hook.agentId,
            hookId: hook.id,
            event: hook.event,
          }),
          reason: `Hook "${hook.name}" fired on ${hook.event}`,
          payload: wakeCfg.context ?? {},
          status: "queued",
        });
        return { result: { targetAgentId: wakeCfg.targetAgentId }, error: null };
      }

      case "create_issue": {
        const issueCfg = config as unknown as CreateIssueConfig;
        const { issues } = await import("@clawdev/db");
        const [issue] = await db
          .insert(issues)
          .values({
            companyId: hook.companyId,
            projectId: issueCfg.projectId,
            title: issueCfg.title || `Hook-created issue: ${hook.event}`,
            description: issueCfg.description ?? JSON.stringify(payload).slice(0, 2000),
            priority: issueCfg.priority ?? "medium",
            status: "backlog",
            originKind: "hook",
            originId: hook.id,
            createdByAgentId: hook.agentId,
          })
          .returning();
        return { result: { issueId: issue?.id }, error: null };
      }

      case "notify_channel": {
        const channelCfg = config as unknown as NotifyChannelConfig;
        const { channelMessages } = await import("@clawdev/db");
        await db.insert(channelMessages).values({
          channelId: channelCfg.channelId,
          companyId: hook.companyId,
          senderAgentId: hook.agentId,
          body:
            channelCfg.message ||
            `Hook fired: **${hook.name}** (${hook.event})`,
        });
        publishLiveEvent({
          companyId: hook.companyId,
          type: "channel_message.created",
          payload: { channelId: channelCfg.channelId, hookId: hook.id },
        });
        return { result: { channelId: channelCfg.channelId }, error: null };
      }

      default:
        return { result: null, error: `Unknown hook type: ${hook.hookType}` };
    }
  }

  async function executeWithRetries(
    hook: typeof agentHooks.$inferSelect,
    hookRunId: string,
    payload: Record<string, unknown>,
    parentRunId: string | undefined,
  ): Promise<void> {
    const maxAttempts = Math.max(1, (hook.retryCount ?? 0) + 1);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const startedAt = new Date();
      await db
        .update(agentHookRuns)
        .set({ status: "running" as AgentHookRunStatus, startedAt, attempt })
        .where(eq(agentHookRuns.id, hookRunId));

      try {
        const { result, error } = await executeHookAction(hook, payload, parentRunId);
        const completedAt = new Date();
        const durationMs = completedAt.getTime() - startedAt.getTime();

        if (error && attempt < maxAttempts) {
          logger.warn({ hookId: hook.id, attempt, error }, "Hook execution failed, retrying");
          await db
            .update(agentHookRuns)
            .set({
              status: "failed" as AgentHookRunStatus,
              error,
              result: result ?? undefined,
              durationMs,
              completedAt,
              attempt,
            })
            .where(eq(agentHookRuns.id, hookRunId));

          await sleep(hook.retryDelayMs ?? 1_000);
          continue;
        }

        const finalStatus: AgentHookRunStatus = error ? "failed" : "succeeded";
        await db
          .update(agentHookRuns)
          .set({
            status: finalStatus,
            result: result ?? undefined,
            error,
            durationMs,
            completedAt,
            attempt,
          })
          .where(eq(agentHookRuns.id, hookRunId));
        return;
      } catch (err) {
        const completedAt = new Date();
        const durationMs = completedAt.getTime() - startedAt.getTime();
        const errorMsg = err instanceof Error ? err.message : String(err);

        if (attempt < maxAttempts) {
          logger.warn({ hookId: hook.id, attempt, error: errorMsg }, "Hook execution threw, retrying");
          await db
            .update(agentHookRuns)
            .set({
              status: "failed" as AgentHookRunStatus,
              error: errorMsg,
              durationMs,
              completedAt,
              attempt,
            })
            .where(eq(agentHookRuns.id, hookRunId));

          await sleep(hook.retryDelayMs ?? 1_000);
          continue;
        }

        await db
          .update(agentHookRuns)
          .set({
            status: "failed" as AgentHookRunStatus,
            error: errorMsg,
            durationMs,
            completedAt,
            attempt,
          })
          .where(eq(agentHookRuns.id, hookRunId));
        return;
      }
    }
  }

  async function fireEvent(
    companyId: string,
    agentId: string,
    event: AgentHookEvent,
    payload: Record<string, unknown>,
    opts: { runId?: string } = {},
  ) {
    // 1. Query enabled hooks for this agent + event, ordered by priority
    const hooks = await db
      .select()
      .from(agentHooks)
      .where(
        and(
          eq(agentHooks.agentId, agentId),
          eq(agentHooks.event, event),
          eq(agentHooks.enabled, true),
        ),
      )
      .orderBy(agentHooks.priority);

    if (hooks.length === 0) return [];

    const firedRunIds: string[] = [];
    const asyncTasks: Promise<void>[] = [];

    for (const hook of hooks) {
      // 2. Evaluate conditions
      if (
        hook.conditions &&
        Object.keys(hook.conditions).length > 0 &&
        !evaluateConditions(hook.conditions, payload)
      ) {
        continue;
      }

      // 3. Create a pending run record
      const hookRunId = randomUUID();
      await db.insert(agentHookRuns).values({
        id: hookRunId,
        hookId: hook.id,
        companyId,
        agentId,
        event,
        eventPayload: payload,
        status: "pending",
        attempt: 1,
        triggeredByRunId: opts.runId ?? null,
      });

      firedRunIds.push(hookRunId);

      // 4. Execute based on sync/async mode
      if (hook.runAsync) {
        // Fire-and-forget: don't await, catch errors silently
        const task = executeWithRetries(hook, hookRunId, payload, opts.runId).catch((err) => {
          logger.error(
            { hookId: hook.id, hookRunId, error: err instanceof Error ? err.message : String(err) },
            "Async hook execution failed unexpectedly",
          );
        });
        asyncTasks.push(task);
      } else {
        // Synchronous: await before continuing to the next hook
        await executeWithRetries(hook, hookRunId, payload, opts.runId);
      }

      // 6. Publish live event
      publishLiveEvent({
        companyId,
        type: "agent.hook.fired",
        payload: {
          hookId: hook.id,
          hookRunId,
          agentId,
          event,
          hookType: hook.hookType,
          hookName: hook.name,
          runAsync: hook.runAsync,
        },
      });
    }

    // Let async tasks finish in background (they are already catching their own errors)
    if (asyncTasks.length > 0) {
      Promise.allSettled(asyncTasks).catch(() => {
        // Intentionally swallowed; individual errors are logged above.
      });
    }

    return firedRunIds;
  }

  // -------------------------------------------------------------------------
  // Run queries
  // -------------------------------------------------------------------------

  async function getRunsForHook(
    hookId: string,
    filters: { limit?: number; status?: AgentHookRunStatus } = {},
  ) {
    const conditions = [eq(agentHookRuns.hookId, hookId)];
    if (filters.status) conditions.push(eq(agentHookRuns.status, filters.status));

    return db
      .select()
      .from(agentHookRuns)
      .where(and(...conditions))
      .orderBy(desc(agentHookRuns.createdAt))
      .limit(filters.limit ?? 50);
  }

  async function getRunsForAgent(
    agentId: string,
    filters: { limit?: number; event?: AgentHookEvent } = {},
  ) {
    const conditions = [eq(agentHookRuns.agentId, agentId)];
    if (filters.event) conditions.push(eq(agentHookRuns.event, filters.event));

    return db
      .select()
      .from(agentHookRuns)
      .where(and(...conditions))
      .orderBy(desc(agentHookRuns.createdAt))
      .limit(filters.limit ?? 50);
  }

  // -------------------------------------------------------------------------
  // Template management
  // -------------------------------------------------------------------------

  async function createTemplate(companyId: string, data: CreateTemplateInput) {
    const id = randomUUID();
    const now = new Date();
    const [template] = await db
      .insert(companyHookTemplates)
      .values({
        id,
        companyId,
        name: data.name,
        description: data.description ?? null,
        event: data.event,
        hookType: data.hookType,
        config: data.config ?? {},
        conditions: data.conditions ?? {},
        isDefault: data.isDefault ?? false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return template!;
  }

  async function listTemplates(companyId: string) {
    return db
      .select()
      .from(companyHookTemplates)
      .where(eq(companyHookTemplates.companyId, companyId))
      .orderBy(companyHookTemplates.name);
  }

  async function applyTemplate(templateId: string, agentId: string) {
    const [template] = await db
      .select()
      .from(companyHookTemplates)
      .where(eq(companyHookTemplates.id, templateId))
      .limit(1);

    if (!template) throw notFound(`Template ${templateId} not found`);

    return create(template.companyId, agentId, {
      name: template.name,
      description: template.description,
      event: template.event as AgentHookEvent,
      hookType: template.hookType as AgentHookType,
      config: template.config,
      conditions: template.conditions,
    });
  }

  async function applyDefaultTemplates(companyId: string, agentId: string) {
    const templates = await db
      .select()
      .from(companyHookTemplates)
      .where(
        and(
          eq(companyHookTemplates.companyId, companyId),
          eq(companyHookTemplates.isDefault, true),
        ),
      );

    const created = [];
    for (const template of templates) {
      const hook = await create(companyId, agentId, {
        name: template.name,
        description: template.description,
        event: template.event as AgentHookEvent,
        hookType: template.hookType as AgentHookType,
        config: template.config,
        conditions: template.conditions,
      });
      created.push(hook);
    }
    return created;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  return {
    create,
    update,
    delete: deleteHook,
    list,
    listForCompany,
    getById,
    fireEvent,
    getRunsForHook,
    getRunsForAgent,
    createTemplate,
    listTemplates,
    applyTemplate,
    applyDefaultTemplates,
    evaluateConditions,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
