import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../errors.js";
import { approvalRoutes } from "../routes/approvals.js";

const mockApprovalService = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  requestRevision: vi.fn(),
  resubmit: vi.fn(),
  listComments: vi.fn(),
  addComment: vi.fn(),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockHeartbeatService = vi.hoisted(() => ({
  wakeup: vi.fn(),
}));

const mockIssueApprovalService = vi.hoisted(() => ({
  listIssuesForApproval: vi.fn(),
  linkManyForApproval: vi.fn(),
}));

const mockSecretService = vi.hoisted(() => ({
  normalizeHireApprovalPayloadForPersistence: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  approvalService: () => mockApprovalService,
  agentService: () => mockAgentService,
  heartbeatService: () => mockHeartbeatService,
  issueApprovalService: () => mockIssueApprovalService,
  logActivity: mockLogActivity,
  secretService: () => mockSecretService,
}));

function createApp() {
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
        source: "session",
        isInstanceAdmin: false,
      },
    }))
    .use(approvalRoutes({} as any));
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

describe("approval routes idempotent retries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentService.getById.mockResolvedValue({
      id: "agent-1",
      companyId: "company-1",
      role: "hr",
      permissions: { canCreateAgents: true },
    });
    mockHeartbeatService.wakeup.mockResolvedValue({ id: "wake-1" });
    mockIssueApprovalService.listIssuesForApproval.mockResolvedValue([{ id: "issue-1" }]);
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("does not emit duplicate approval side effects when approve is already resolved", async () => {
    mockApprovalService.getById.mockResolvedValue({
      id: "approval-1",
      companyId: "company-1",
      type: "hire_agent",
      status: "approved",
      payload: {},
      requestedByAgentId: "agent-1",
    });
    mockApprovalService.approve.mockResolvedValue({
      approval: {
        id: "approval-1",
        companyId: "company-1",
        type: "hire_agent",
        status: "approved",
        payload: {},
        requestedByAgentId: "agent-1",
      },
      applied: false,
    });

    const res = await req(createApp(),
      "POST", "/api/approvals/approval-1/approve",
      {});

    expect(res.status).toBe(200);
    expect(mockIssueApprovalService.listIssuesForApproval).not.toHaveBeenCalled();
    expect(mockHeartbeatService.wakeup).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });

  it("does not emit duplicate rejection logs when reject is already resolved", async () => {
    mockApprovalService.getById.mockResolvedValue({
      id: "approval-1",
      companyId: "company-1",
      type: "hire_agent",
      status: "rejected",
      payload: {},
    });
    mockApprovalService.reject.mockResolvedValue({
      approval: {
        id: "approval-1",
        companyId: "company-1",
        type: "hire_agent",
        status: "rejected",
        payload: {},
      },
      applied: false,
    });

    const res = await req(createApp(),
      "POST", "/api/approvals/approval-1/reject",
      {});

    expect(res.status).toBe(200);
    expect(mockLogActivity).not.toHaveBeenCalled();
  });

  it("allows HR agents with create-agent privileges to approve hire requests", async () => {
    const approval = {
      id: "approval-1",
      companyId: "company-1",
      type: "hire_agent",
      status: "pending",
      payload: {},
      requestedByAgentId: "agent-1",
    };
    mockApprovalService.getById.mockResolvedValue(approval);
    mockApprovalService.approve.mockResolvedValue({ approval: { ...approval, status: "approved" }, applied: true });

    const app = new Elysia({ prefix: "/api" })
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
          type: "agent",
          agentId: "agent-1",
          companyId: "company-1",
          source: "agent_key",
        },
      }))
      .use(approvalRoutes({} as any));

    const res = await req(app, "POST", "/api/approvals/approval-1/approve", {});

    expect(res.status).toBe(200);
    expect(mockApprovalService.approve).toHaveBeenCalledWith("approval-1", "agent-1", null);
  });
});
