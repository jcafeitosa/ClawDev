import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../errors.js";
import { activityRoutes } from "../routes/activity.js";

const mockActivityService = vi.hoisted(() => ({
  list: vi.fn(),
  forIssue: vi.fn(),
  runsForIssue: vi.fn(),
  issuesForRun: vi.fn(),
  create: vi.fn(),
}));

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
  getByIdentifier: vi.fn(),
}));

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("../services/activity.js", () => ({
  activityService: () => mockActivityService,
}));

vi.mock("../services/index.js", () => ({
  issueService: () => mockIssueService,
}));

function createApp() {
  mockDb.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        then: vi.fn().mockResolvedValue([{ companyId: "company-1" }]),
      }),
    }),
  });
  return new Elysia({ prefix: "/api" })
    .onError(({ error, set }) => {
      if (error instanceof HttpError) {
        set.status = error.status;
        return error.details ? { error: error.message, details: error.details } : { error: error.message };
      }
      set.status = 500;
      return { error: "Internal server error" };
    })
    .derive(() => ({
      actor: {
        type: "board",
        userId: "user-1",
        companyIds: ["company-1"],
        source: "local_implicit",
        isInstanceAdmin: true,
      },
    }))
    .use(activityRoutes(mockDb as any));
}

async function req(app: any, method: string, path: string, body?: any, headers?: Record<string, string>) {
  const init: RequestInit = { method, headers: { ...headers } };
  if (body) { init.body = JSON.stringify(body); (init.headers as any)["content-type"] = "application/json"; }
  const res = await app.handle(new Request("http://localhost" + path, init));
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json, text };
}

describe("activity routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves issue identifiers before loading runs", async () => {
    mockIssueService.getByIdentifier.mockResolvedValue({
      id: "issue-uuid-1",
      companyId: "company-1",
    });
    mockActivityService.runsForIssue.mockResolvedValue([
      {
        runId: "run-1",
      },
    ]);

    const res = await req(createApp(), "GET", "/api/issues/PAP-475/runs");

    expect(res.status).toBe(200);
    expect(mockIssueService.getByIdentifier).toHaveBeenCalledWith("PAP-475");
    expect(mockIssueService.getById).not.toHaveBeenCalled();
    expect(mockActivityService.runsForIssue).toHaveBeenCalledWith("company-1", "issue-uuid-1");
    expect(res.body).toEqual([{ runId: "run-1" }]);
  });

  it("supports the heartbeat-runs alias for run issue lookup", async () => {
    mockActivityService.issuesForRun.mockResolvedValue([
      {
        issueId: "issue-1",
        identifier: "PAP-1",
      },
    ]);

    const res = await req(createApp(), "GET", "/api/heartbeat-runs/run-1/issues");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ issueId: "issue-1", identifier: "PAP-1" }]);
    expect(mockActivityService.issuesForRun).toHaveBeenCalledWith("run-1");
  });
});
