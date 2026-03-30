import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueRoutes } from "../routes/issues.js";

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
  update: vi.fn(),
  addComment: vi.fn(),
  findMentionedAgents: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  canUser: vi.fn(),
  hasPermission: vi.fn(),
}));

const mockHeartbeatService = vi.hoisted(() => ({
  wakeup: vi.fn(async () => undefined),
  reportRunActivity: vi.fn(async () => undefined),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("../services/index.js", () => ({
  accessService: () => mockAccessService,
  agentService: () => mockAgentService,
  documentService: () => ({}),
  executionWorkspaceService: () => ({}),
  goalService: () => ({}),
  heartbeatService: () => mockHeartbeatService,
  issueApprovalService: () => ({}),
  issueService: () => mockIssueService,
  logActivity: mockLogActivity,
  projectService: () => ({}),
  routineService: () => ({
    syncRunStatusForIssue: vi.fn(async () => undefined),
  }),
  workProductService: () => ({}),
}));

function createApp() {
  return new Elysia({ prefix: "/api" })
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

async function req(app: any, method: string, path: string, body?: any, headers?: Record<string, string>) {
  const init: RequestInit = { method, headers: { ...headers } };
  if (body) { init.body = JSON.stringify(body); (init.headers as any)["content-type"] = "application/json"; }
  const res = await app.handle(new Request("http://localhost" + path, init));
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json, text };
}

function makeIssue(status: "todo" | "done") {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    companyId: "company-1",
    status,
    assigneeAgentId: "22222222-2222-4222-8222-222222222222",
    assigneeUserId: null,
    createdByUserId: "local-board",
    identifier: "PAP-580",
    title: "Comment reopen default",
  };
}

describe("issue comment reopen routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIssueService.addComment.mockResolvedValue({
      id: "comment-1",
      issueId: "11111111-1111-4111-8111-111111111111",
      companyId: "company-1",
      body: "hello",
      createdAt: new Date(),
      updatedAt: new Date(),
      authorAgentId: null,
      authorUserId: "local-board",
    });
    mockIssueService.findMentionedAgents.mockResolvedValue([]);
  });

  it("treats reopen=true as a no-op when the issue is already open", async () => {
    mockIssueService.getById.mockResolvedValue(makeIssue("todo"));
    mockIssueService.update.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
      ...makeIssue("todo"),
      ...patch,
    }));

    const res = await req(createApp(), "PATCH", "/api/issues/11111111-1111-4111-8111-111111111111", { comment: "hello", reopen: true, assigneeAgentId: "33333333-3333-4333-8333-333333333333" });

    expect(res.status).toBe(200);
    expect(mockIssueService.update).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", {
      assigneeAgentId: "33333333-3333-4333-8333-333333333333",
    });
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "issue.updated",
        details: expect.not.objectContaining({ reopened: true }),
      }),
    );
  });

  it("reopens closed issues via the PATCH comment path", async () => {
    mockIssueService.getById.mockResolvedValue(makeIssue("done"));
    mockIssueService.update.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
      ...makeIssue("done"),
      ...patch,
    }));

    const res = await req(createApp(), "PATCH", "/api/issues/11111111-1111-4111-8111-111111111111", { comment: "hello", reopen: true, assigneeAgentId: "33333333-3333-4333-8333-333333333333" });

    expect(res.status).toBe(200);
    expect(mockIssueService.update).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", {
      assigneeAgentId: "33333333-3333-4333-8333-333333333333",
      status: "todo",
    });
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "issue.updated",
        details: expect.objectContaining({
          reopened: true,
          reopenedFrom: "done",
          status: "todo",
        }),
      }),
    );
  });
});
