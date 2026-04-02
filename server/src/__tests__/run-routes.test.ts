import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../errors.js";
import { runRoutes } from "../routes/runs.js";

const companyId = "22222222-2222-4222-8222-222222222222";
const runId = "run-1";

const mockHeartbeatService = vi.hoisted(() => ({
  getRun: vi.fn(),
  readLog: vi.fn(),
  listEvents: vi.fn(),
}));

const mockActivityService = vi.hoisted(() => ({
  issuesForRun: vi.fn(),
}));

const mockWorkspaceOperationService = vi.hoisted(() => ({
  listForRun: vi.fn(),
}));

const mockRedactCurrentUserValue = vi.hoisted(() => vi.fn((value: unknown) => value));
const mockRedactEventPayload = vi.hoisted(() => vi.fn((value: unknown) => value));

const runListRows = [
  {
    id: "run-list-1",
    agentId: "agent-1",
    status: "running",
    invocationSource: "on_demand",
    triggerDetail: "manual",
    startedAt: "2026-04-01T00:00:00.000Z",
    finishedAt: null,
    error: null,
    exitCode: null,
    stdoutExcerpt: null,
    stderrExcerpt: null,
    errorCode: null,
    externalRunId: null,
    createdAt: "2026-04-01T00:00:00.000Z",
    agentName: "Agent One",
    agentIcon: "Bot",
    agentRole: "ceo",
  },
];

vi.mock("../services/index.js", () => ({
  activityService: () => mockActivityService,
  heartbeatService: () => mockHeartbeatService,
  workspaceOperationService: () => mockWorkspaceOperationService,
}));

vi.mock("../log-redaction.js", () => ({
  redactCurrentUserValue: mockRedactCurrentUserValue,
}));

vi.mock("../redaction.js", () => ({
  redactEventPayload: mockRedactEventPayload,
}));

function createApp() {
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn((limit: number) => Promise.resolve(limit === 0 ? [] : runListRows)),
              then: (resolve: (rows: typeof runListRows) => unknown) =>
                Promise.resolve(resolve(runListRows)),
            })),
          })),
        })),
      })),
    })),
  };

  return new Elysia({ prefix: "/api" })
    .onError(({ error, set }) => {
      if (error instanceof HttpError) {
        set.status = error.status;
        return { error: error.message };
      }
      set.status = 500;
      return { error: "Internal server error" };
    })
    .derive(() => ({
      actor: {
        type: "board",
        source: "local_implicit",
        userId: "board-user",
        companyIds: [companyId],
      },
    }))
    .use(runRoutes(db as any));
}

async function req(app: any, method: string, path: string) {
  const res = await app.handle(new Request(`http://localhost${path}`, { method }));
  const text = await res.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

describe("run routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeartbeatService.getRun.mockResolvedValue({
      id: runId,
      companyId,
      contextSnapshot: { executionWorkspaceId: "workspace-1" },
    });
    mockHeartbeatService.readLog.mockResolvedValue({
      runId,
      store: "local_file",
      logRef: "run-1.ndjson",
      content: "log line\n",
      nextOffset: undefined,
    });
    mockHeartbeatService.listEvents.mockResolvedValue([
      { seq: 1, payload: { secret: "redact" } },
    ]);
    mockActivityService.issuesForRun.mockResolvedValue([
      { issueId: "issue-1", identifier: "PAP-1", title: "Touched issue", status: "in_progress" },
    ]);
    mockWorkspaceOperationService.listForRun.mockResolvedValue([
      { id: "op-1", companyId, metadata: { note: "ops" } },
    ]);
  });

  it("serves heartbeat run log, events, and workspace operations for a company", async () => {
    const app = createApp();

    const logRes = await req(app, "GET", `/api/companies/${companyId}/heartbeat-runs/${runId}/log`);
    expect(logRes.status).toBe(200);
    expect(mockHeartbeatService.getRun).toHaveBeenCalledWith(runId);
    expect(logRes.body.content).toBe("log line\n");

    const eventsRes = await req(app, "GET", `/api/companies/${companyId}/heartbeat-runs/${runId}/events?limit=10`);
    expect(eventsRes.status).toBe(200);
    expect(mockHeartbeatService.listEvents).toHaveBeenCalledWith(runId, 0, 10);
    expect(mockRedactEventPayload).toHaveBeenCalled();

    const opsRes = await req(app, "GET", `/api/companies/${companyId}/heartbeat-runs/${runId}/workspace-operations`);
    expect(opsRes.status).toBe(200);
    expect(mockWorkspaceOperationService.listForRun).toHaveBeenCalledWith(runId, "workspace-1");
    expect(mockRedactCurrentUserValue).toHaveBeenCalled();
  });

  it("returns arrays for heartbeat run lists and live runs", async () => {
    const app = createApp();

    const listRes = await req(app, "GET", `/api/companies/${companyId}/heartbeat-runs?limit=5`);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body).toHaveLength(1);

    const liveRes = await req(app, "GET", `/api/companies/${companyId}/live-runs`);
    expect(liveRes.status).toBe(200);
    expect(Array.isArray(liveRes.body)).toBe(true);
    expect(liveRes.body).toHaveLength(1);
  });

  it("serves company-scoped touched issues for a run", async () => {
    const app = createApp();

    const res = await req(app, "GET", `/api/companies/${companyId}/runs/${runId}/issues`);
    expect(res.status).toBe(200);
    expect(mockActivityService.issuesForRun).toHaveBeenCalledWith(runId);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].issueId).toBe("issue-1");
  });
});
