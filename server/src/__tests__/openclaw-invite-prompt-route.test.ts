import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { accessRoutes } from "../routes/access.js";

const mockAccessService = vi.hoisted(() => ({
  hasPermission: vi.fn(),
  canUser: vi.fn(),
  isInstanceAdmin: vi.fn(),
  getMembership: vi.fn(),
  ensureMembership: vi.fn(),
  listMembers: vi.fn(),
  setMemberPermissions: vi.fn(),
  promoteInstanceAdmin: vi.fn(),
  demoteInstanceAdmin: vi.fn(),
  listUserCompanyAccess: vi.fn(),
  setUserCompanyAccess: vi.fn(),
  setPrincipalGrants: vi.fn(),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockBoardAuthService = vi.hoisted(() => ({
  createCliAuthChallenge: vi.fn(),
  describeCliAuthChallenge: vi.fn(),
  approveCliAuthChallenge: vi.fn(),
  cancelCliAuthChallenge: vi.fn(),
  resolveBoardAccess: vi.fn(),
  assertCurrentBoardKey: vi.fn(),
  revokeBoardApiKey: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  accessService: () => mockAccessService,
  agentService: () => mockAgentService,
  boardAuthService: () => mockBoardAuthService,
  deduplicateAgentName: vi.fn(),
  logActivity: mockLogActivity,
  notifyHireApproved: vi.fn(),
}));

function createDbStub(allowedJoinTypes: "agent" | "both" = "agent") {
  const companyWhere = vi.fn().mockReturnValue({
    then: (resolve: (rows: unknown[]) => unknown) => resolve([{ name: "Company One" }]),
  });
  const companyFrom = vi.fn().mockReturnValue({ where: companyWhere });
  const select = vi.fn().mockReturnValue({ from: companyFrom });
  const createdInvite = {
    id: "invite-1",
    companyId: "592f1299-1fcf-472b-abd8-2e50fa774b0d",
    inviteType: "company_join",
    allowedJoinTypes,
    defaultsPayload: null,
    expiresAt: new Date("2026-03-07T00:10:00.000Z"),
    invitedByUserId: null,
    tokenHash: "hash",
    revokedAt: null,
    acceptedAt: null,
    createdAt: new Date("2026-03-07T00:00:00.000Z"),
    updatedAt: new Date("2026-03-07T00:00:00.000Z"),
  };
  const returning = vi.fn().mockResolvedValue([createdInvite]);
  const values = vi.fn().mockReturnValue({ returning });
  const insert = vi.fn().mockReturnValue({ values });
  return {
    select,
    insert,
  };
}

function createDbStubThatFailsOnInsert() {
  const select = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        then: (resolve: (rows: unknown[]) => unknown) => resolve([{ name: "Company One" }]),
      }),
    }),
  });
  const returning = vi.fn().mockRejectedValue(new Error("insert or update on table \"invites\" violates foreign key constraint"));
  const values = vi.fn().mockReturnValue({ returning });
  const insert = vi.fn().mockReturnValue({ values });
  return { select, insert };
}

function createApp(actor: Record<string, unknown>, db: Record<string, unknown>) {
  return new Elysia({ prefix: "/api" })
    .derive(() => ({ actor }))
    .use(accessRoutes(db as any));
}

async function req(
  app: any,
  method: string,
  path: string,
  body?: any,
  headers?: Record<string, string>,
) {
  const init: RequestInit = { method, headers: { ...headers } };
  if (body) {
    init.body = JSON.stringify(body);
    (init.headers as any)["content-type"] = "application/json";
  }
  const res = await app.handle(new Request("http://localhost" + path, init));
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json, text };
}

describe("POST /companies/:companyId/openclaw/invite-prompt", () => {
  beforeEach(() => {
    mockAccessService.canUser.mockResolvedValue(false);
    mockAgentService.getById.mockReset();
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("rejects non-level-C agent callers", async () => {
    const db = createDbStub();
    mockAgentService.getById.mockResolvedValue({
      id: "agent-1",
      companyId: "592f1299-1fcf-472b-abd8-2e50fa774b0d",
      role: "engineer",
    });
    const app = createApp(
      {
        type: "agent",
        agentId: "agent-1",
        companyId: "592f1299-1fcf-472b-abd8-2e50fa774b0d",
        source: "agent_key",
      },
      db,
    );

    const res = await req(
      app,
      "POST",
      "/api/companies/592f1299-1fcf-472b-abd8-2e50fa774b0d/openclaw/invite-prompt",
      {},
    );

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Only level C agents");
  });

  it("allows level C agent callers and creates an agent-only invite", async () => {
    const db = createDbStub();
    mockAgentService.getById.mockResolvedValue({
      id: "agent-1",
      companyId: "company-1",
      role: "coo",
    });
    const app = createApp(
      {
        type: "agent",
        agentId: "agent-1",
        companyId: "company-1",
        source: "agent_key",
      },
      db,
    );

    const res = await req(app, "POST", "/api/companies/company-1/openclaw/invite-prompt", {
      agentMessage: "Join and configure OpenClaw gateway.",
    });

    expect(res.status).toBe(201);
    expect(res.body.allowedJoinTypes).toBe("agent");
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.startsWith("pcp_invite_")).toBe(true);
    expect(res.body.inviteUrl).toMatch(/^\/invite\/pcp_invite_/);
    expect(res.body.onboardingTextPath).toContain("/api/invites/");
    expect(res.body.onboardingTextUrl).toContain("/api/invites/");
    expect(res.body.companyName).toBe("Company One");
  });

  it("allows board callers with invite permission", async () => {
    const db = createDbStub();
    mockAccessService.canUser.mockResolvedValue(true);
    const app = createApp(
      {
        type: "board",
        userId: "user-1",
        companyIds: ["592f1299-1fcf-472b-abd8-2e50fa774b0d"],
        source: "session",
        isInstanceAdmin: false,
      },
      db,
    );

    const res = await req(
      app,
      "POST",
      "/api/companies/592f1299-1fcf-472b-abd8-2e50fa774b0d/openclaw/invite-prompt",
      {},
    );

    expect(res.status).toBe(201);
    expect(res.body.allowedJoinTypes).toBe("agent");
  });

  it("returns a generic 500 when invite creation fails", async () => {
    const db = createDbStubThatFailsOnInsert();
    mockAccessService.canUser.mockResolvedValue(true);
    const app = createApp(
      {
        type: "board",
        userId: "user-1",
        companyIds: ["592f1299-1fcf-472b-abd8-2e50fa774b0d"],
        source: "session",
        isInstanceAdmin: false,
      },
      db,
    );

    const res = await req(
      app,
      "POST",
      "/api/companies/592f1299-1fcf-472b-abd8-2e50fa774b0d/openclaw/invite-prompt",
      {},
    );

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });

  it("rejects board callers without invite permission", async () => {
    const db = createDbStub();
    mockAccessService.canUser.mockResolvedValue(false);
    const app = createApp(
      {
        type: "board",
        userId: "user-1",
        companyIds: ["592f1299-1fcf-472b-abd8-2e50fa774b0d"],
        source: "session",
        isInstanceAdmin: false,
      },
      db,
    );

    const res = await req(
      app,
      "POST",
      "/api/companies/592f1299-1fcf-472b-abd8-2e50fa774b0d/openclaw/invite-prompt",
      {},
    );

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Permission denied");
  });
});

describe("POST /companies/:companyId/invites", () => {
  beforeEach(() => {
    mockAccessService.canUser.mockResolvedValue(false);
    mockAgentService.getById.mockReset();
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("returns the Paperclip-compatible invite payload for board callers", async () => {
    const db = createDbStub("both");
    const app = createApp(
      {
        type: "board",
        userId: "user-1",
        companyIds: ["592f1299-1fcf-472b-abd8-2e50fa774b0d"],
        source: "local_implicit",
        isInstanceAdmin: true,
      },
      db,
    );

    const res = await req(
      app,
      "POST",
      "/api/companies/592f1299-1fcf-472b-abd8-2e50fa774b0d/invites",
      {},
    );

    expect(res.status).toBe(201);
    expect(res.body.allowedJoinTypes).toBe("both");
    expect(res.body.token.startsWith("pcp_invite_")).toBe(true);
    expect(res.body.inviteUrl).toMatch(/^\/invite\/pcp_invite_/);
    expect(res.body.companyName).toBe("Company One");
    expect(res.body.onboardingTextPath).toContain("/api/invites/");
    expect(res.body.onboardingTextUrl).toContain("/api/invites/");
    expect(res.body.inviteMessage).toBeNull();
  });

  it("returns a generic 500 when company invite creation fails", async () => {
    const db = createDbStubThatFailsOnInsert();
    const app = createApp(
      {
        type: "board",
        userId: "user-1",
        companyIds: ["592f1299-1fcf-472b-abd8-2e50fa774b0d"],
        source: "local_implicit",
        isInstanceAdmin: true,
      },
      db,
    );

    const res = await req(
      app,
      "POST",
      "/api/companies/592f1299-1fcf-472b-abd8-2e50fa774b0d/invites",
      {},
    );

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });
});
