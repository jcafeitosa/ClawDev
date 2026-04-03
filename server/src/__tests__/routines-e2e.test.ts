import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  activityLog,
  agents,
  companies,
  companyMemberships,
  instanceSettings,
  principalPermissionGrants,
  projects,
  routineRuns,
  routines,
  routineTriggers,
  openPGliteDatabase,
  type PGliteDatabaseHandle,
} from "@clawdev/db";
import { accessService } from "../services/access.js";

vi.mock("../services/index.js", async () => {
  const actual = await vi.importActual<typeof import("../services/index.js")>("../services/index.js");
  const { randomUUID } = await import("node:crypto");

  return {
    ...actual,
    routineService: (db: any) =>
      actual.routineService(db, {
        heartbeat: {
          wakeup: async () => {
            return { id: randomUUID() };
          },
        },
      }),
  };
});

describe("routine routes end-to-end", () => {
  let db!: PGliteDatabaseHandle["db"];
  let tempDb: PGliteDatabaseHandle | null = null;

  beforeAll(async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "clawdev-routines-e2e-"));
    tempDb = await openPGliteDatabase(dataDir);
    db = tempDb.db;
  }, 180_000);

  afterAll(async () => {
    await tempDb?.stop();
  }, 180_000);

  async function createApp(actor: Record<string, unknown>) {
    const { routineRoutes } = await import("../routes/routines.js");
    return new Elysia({ prefix: "/api" })
      .derive(() => ({ actor }))
      .use(routineRoutes(db));
  }

  async function appFetch(
    app: Awaited<ReturnType<typeof createApp>>,
    method: string,
    path: string,
    body?: unknown,
  ) {
    const res = await app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text || null;
    }
    return { status: res.status, body: json as any };
  }

  async function seedFixture() {
    const companyId = randomUUID();
    const agentId = randomUUID();
    const projectId = randomUUID();
    const userId = randomUUID();
    const issuePrefix = `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

    await db.insert(companies).values({
      id: companyId,
      name: "ClawDev",
      issuePrefix,
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "CodexCoder",
      role: "engineer",
      status: "active",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });

    await db.insert(projects).values({
      id: projectId,
      companyId,
      name: "Routine Project",
      status: "in_progress",
    });

    const access = accessService(db);
    const membership = await access.ensureMembership(companyId, "user", userId, "owner", "active");
    await access.setMemberPermissions(
      companyId,
      membership.id,
      [{ permissionKey: "tasks:assign" }],
      userId,
    );

    return { companyId, agentId, projectId, userId };
  }

  it(
    "supports creating, scheduling, and inspecting a routine through the API",
    async () => {
    const { companyId, agentId, projectId, userId } = await seedFixture();
    const app = await createApp({
      type: "board",
      userId,
      source: "session",
      isInstanceAdmin: false,
      companyIds: [companyId],
    });

    const createRes = await appFetch(app, "POST", `/api/companies/${companyId}/routines`, {
      projectId,
      title: "Daily standup prep",
      description: "Summarize blockers and open PRs",
      assigneeAgentId: agentId,
      priority: "high",
      concurrencyPolicy: "coalesce_if_active",
      catchUpPolicy: "skip_missed",
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.title).toBe("Daily standup prep");
    expect(createRes.body.assigneeAgentId).toBe(agentId);

    const routineId = createRes.body.id as string;

    const triggerRes = await appFetch(app, "POST", `/api/routines/${routineId}/triggers`, {
      kind: "schedule",
      label: "Weekday morning",
      cronExpression: "0 10 * * 1-5",
      timezone: "UTC",
    });

    expect(triggerRes.status).toBe(201);
    expect(triggerRes.body.trigger.kind).toBe("schedule");
    expect(triggerRes.body.trigger.enabled).toBe(true);
    expect(triggerRes.body.secretMaterial).toBeNull();

    const detailRes = await appFetch(app, "GET", `/api/routines/${routineId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.triggers).toHaveLength(1);
    expect(detailRes.body.triggers[0]?.id).toBe(triggerRes.body.trigger.id);
    expect(detailRes.body.recentRuns).toHaveLength(0);

    const runsRes = await appFetch(app, "GET", `/api/routines/${routineId}/runs?limit=10`);
    expect(runsRes.status).toBe(200);
    expect(runsRes.body).toHaveLength(0);

    const actions = await db
      .select({
        action: activityLog.action,
      })
      .from(activityLog)
      .where(eq(activityLog.companyId, companyId));

    expect(actions.map((entry) => entry.action)).toEqual(
      expect.arrayContaining([
        "routine.created",
        "routine.trigger_created",
      ]),
    );
    },
    180_000,
  );
});
