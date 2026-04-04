import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueRoutes } from "../routes/issues.js";

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
  checkout: vi.fn(),
  markRead: vi.fn(),
  archiveInbox: vi.fn(),
  unarchiveInbox: vi.fn(),
}));

const mockHeartbeatService = vi.hoisted(() => ({
  wakeup: vi.fn(async () => undefined),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  accessService: () => ({
    canUser: vi.fn(),
    hasPermission: vi.fn(),
  }),
  agentService: () => ({
    getById: vi.fn(),
  }),
  documentService: () => ({}),
  executionWorkspaceService: () => ({}),
  goalService: () => ({}),
  heartbeatService: () => mockHeartbeatService,
  issueApprovalService: () => ({}),
  issueService: () => mockIssueService,
  logActivity: mockLogActivity,
  projectService: () => ({
    getById: vi.fn(),
  }),
  routineService: () => ({
    syncRunStatusForIssue: vi.fn(async () => undefined),
  }),
  workProductService: () => ({}),
}));

function createApp() {
  return new Elysia({ prefix: "/api" })
    .onError(({ code, error, set, request }) => {
      switch (code) {
        case "NOT_FOUND":
          set.status = 404;
          return new URL(request.url).pathname.startsWith("/api/")
            ? { error: "API route not found" }
            : { error: "Not found" };
        case "VALIDATION":
          set.status = 400;
          return { error: "Validation error", details: (error as Error).message };
        case "PARSE":
          set.status = 400;
          return { error: "Invalid request body" };
        default:
          set.status = 500;
          return { error: "Internal server error" };
      }
    })
    .derive(() => ({
      actor: {
        type: "board",
        userId: "local-board",
        companyIds: ["company-1"],
        source: "local_implicit",
        isInstanceAdmin: false,
      },
    }))
    .use(issueRoutes({} as any, {} as any));
}

async function req(app: any, method: string, path: string, body?: any) {
  const init: RequestInit = { method, headers: {} };
  if (body) {
    init.body = JSON.stringify(body);
    (init.headers as any)["content-type"] = "application/json";
  }
  const res = await app.handle(new Request(`http://localhost${path}`, init));
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json, text };
}

describe("issue checkout route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("returns the updated issue even if activity logging fails asynchronously", async () => {
    mockIssueService.getById.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      companyId: "company-1",
      projectId: null,
      status: "todo",
      assigneeAgentId: null,
    });
    mockIssueService.checkout.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      companyId: "company-1",
      projectId: null,
      status: "in_progress",
      assigneeAgentId: "22222222-2222-4222-8222-222222222222",
    });
    mockLogActivity.mockRejectedValue(new Error("activity write failed"));

    const res = await req(createApp(), "POST", "/api/issues/11111111-1111-4111-8111-111111111111/checkout", {
      agentId: "22222222-2222-4222-8222-222222222222",
      expectedStatuses: ["todo"],
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: "in_progress",
        assigneeAgentId: "22222222-2222-4222-8222-222222222222",
      }),
    );
    expect(mockIssueService.checkout).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      ["todo"],
      null,
    );
    expect(mockLogActivity).toHaveBeenCalled();
  });

  it("rejects invalid checkout payloads before reaching the service layer", async () => {
    mockIssueService.getById.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      companyId: "company-1",
      projectId: null,
      status: "backlog",
      assigneeAgentId: null,
    });

    const res = await req(createApp(), "POST", "/api/issues/11111111-1111-4111-8111-111111111111/checkout", {
      agentId: "local-board",
      expectedStatuses: ["open"],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
    expect(mockIssueService.checkout).not.toHaveBeenCalled();
  });

  it("marks an issue as read for the board actor", async () => {
    mockIssueService.getById.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      companyId: "company-1",
      projectId: null,
      status: "todo",
      assigneeAgentId: null,
    });
    mockIssueService.markRead.mockResolvedValue({
      issueId: "11111111-1111-4111-8111-111111111111",
      userId: "local-board",
      lastReadAt: new Date("2026-03-19T00:00:00.000Z"),
    });

    const res = await req(createApp(), "POST", "/api/issues/11111111-1111-4111-8111-111111111111/read");

    expect(res.status).toBe(200);
    expect(mockIssueService.markRead).toHaveBeenCalledWith(
      "company-1",
      "11111111-1111-4111-8111-111111111111",
      "local-board",
      expect.any(Date),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "issue.read_marked",
        entityType: "issue",
        entityId: "11111111-1111-4111-8111-111111111111",
      }),
    );
  });

  it("archives and unarchives issue inbox state for the board actor", async () => {
    mockIssueService.getById.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      companyId: "company-1",
      projectId: null,
      status: "todo",
      assigneeAgentId: null,
    });
    mockIssueService.archiveInbox.mockResolvedValue({
      issueId: "11111111-1111-4111-8111-111111111111",
      userId: "local-board",
      archivedAt: new Date("2026-03-19T00:00:00.000Z"),
    });
    mockIssueService.unarchiveInbox.mockResolvedValue({
      issueId: "11111111-1111-4111-8111-111111111111",
      userId: "local-board",
    });

    const app = createApp();

    const archiveRes = await req(app, "POST", "/api/issues/11111111-1111-4111-8111-111111111111/inbox-archive");
    expect(archiveRes.status).toBe(200);
    expect(mockIssueService.archiveInbox).toHaveBeenCalledWith(
      "company-1",
      "11111111-1111-4111-8111-111111111111",
      "local-board",
      expect.any(Date),
    );

    const unarchiveRes = await req(app, "DELETE", "/api/issues/11111111-1111-4111-8111-111111111111/inbox-archive");
    expect(unarchiveRes.status).toBe(200);
    expect(mockIssueService.unarchiveInbox).toHaveBeenCalledWith(
      "company-1",
      "11111111-1111-4111-8111-111111111111",
      "local-board",
    );
  });
});
