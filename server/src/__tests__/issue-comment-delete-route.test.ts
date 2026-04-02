import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { commentRoutes } from "../routes/comments.js";

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
  getComment: vi.fn(),
  removeComment: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn(async () => undefined));

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
  heartbeatService: () => ({
    wakeup: vi.fn(async () => undefined),
    reportRunActivity: vi.fn(async () => undefined),
  }),
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
    .use(commentRoutes({} as any));
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

describe("issue comment delete route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes a comment and logs the mutation", async () => {
    mockIssueService.getById.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      companyId: "company-1",
      identifier: "PAP-999",
      title: "Delete me",
    });
    mockIssueService.getComment.mockResolvedValue({
      id: "comment-1",
      issueId: "11111111-1111-4111-8111-111111111111",
      companyId: "company-1",
      body: "hello world",
      authorAgentId: null,
      authorUserId: "local-board",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockIssueService.removeComment.mockResolvedValue({
      id: "comment-1",
      issueId: "11111111-1111-4111-8111-111111111111",
      companyId: "company-1",
      body: "hello world",
      authorAgentId: null,
      authorUserId: "local-board",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await req(
      createApp(),
      "DELETE",
      "/api/comments/comment-1",
    );

    expect(res.status).toBe(200);
    expect(mockIssueService.removeComment).toHaveBeenCalledWith("comment-1");
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "issue.comment_deleted",
        entityType: "issue",
        entityId: "11111111-1111-4111-8111-111111111111",
      }),
    );
  });
});
