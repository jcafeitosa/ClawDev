import { Elysia } from "elysia";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
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

vi.mock("../services/index.js", () => ({
  accessService: () => mockAccessService,
  agentService: () => mockAgentService,
  boardAuthService: () => mockBoardAuthService,
  deduplicateAgentName: vi.fn(),
  logActivity: vi.fn(),
  notifyHireApproved: vi.fn(),
}));

function createDbStub(invite: Record<string, unknown>) {
  const where = vi.fn().mockReturnValue({
    then: (resolve: (rows: unknown[]) => unknown) => resolve([invite]),
  });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { select };
}

function createAcceptDbStub(opts: {
  invite: Record<string, unknown>;
  joinRequest: Record<string, unknown>;
}) {
  const inviteWhere = vi.fn().mockReturnValue({
    then: (resolve: (rows: unknown[]) => unknown) => resolve([opts.invite]),
  });
  const inviteFrom = vi.fn().mockReturnValue({ where: inviteWhere });
  const inviteSelect = vi.fn().mockReturnValue({ from: inviteFrom });

  const joinRequestWhere = vi.fn().mockReturnValue({
    returning: () => ({
      then: (resolve: (rows: unknown[]) => unknown) => resolve([opts.joinRequest]),
    }),
  });
  const joinRequestSet = vi.fn().mockReturnValue({ where: joinRequestWhere });
  const joinRequestUpdate = vi.fn().mockReturnValue({ set: joinRequestSet });

  const txInviteWhere = vi.fn().mockReturnValue({
    then: (resolve: (rows: unknown[]) => unknown) => resolve(undefined),
  });
  const txInviteUpdate = vi.fn().mockReturnValue({
    set: () => ({ where: txInviteWhere }),
  });
  const txJoinInsert = vi.fn().mockReturnValue({
    values: () => ({
      returning: () => ({
        then: (resolve: (rows: unknown[]) => unknown) => resolve([opts.joinRequest]),
      }),
    }),
  });
  const transaction = vi.fn(async (callback: (tx: Record<string, unknown>) => unknown) => {
    return await callback({
      update: txInviteUpdate,
      insert: txJoinInsert,
    } as any);
  });

  return {
    select: inviteSelect,
    update: joinRequestUpdate,
    transaction,
  };
}

function createAcceptDbStubCapturingInsert(opts: {
  invite: Record<string, unknown>;
  joinRequest: Record<string, unknown>;
}) {
  let insertedValues: Record<string, unknown> | null = null;

  const inviteWhere = vi.fn().mockReturnValue({
    then: (resolve: (rows: unknown[]) => unknown) => resolve([opts.invite]),
  });
  const inviteFrom = vi.fn().mockReturnValue({ where: inviteWhere });
  const inviteSelect = vi.fn().mockReturnValue({ from: inviteFrom });

  const authUserWhere = vi.fn().mockReturnValue({
    then: (resolve: (rows: unknown[]) => unknown) =>
      resolve([{ email: "local@paperclip.local" }]),
  });
  const authUserFrom = vi.fn().mockReturnValue({ where: authUserWhere });
  const authUserSelect = vi.fn().mockReturnValue({ from: authUserFrom });

  const joinRequestWhere = vi.fn().mockReturnValue({
    returning: () => ({
      then: (resolve: (rows: unknown[]) => unknown) => resolve([opts.joinRequest]),
    }),
  });
  const joinRequestSet = vi.fn().mockReturnValue({ where: joinRequestWhere });
  const joinRequestUpdate = vi.fn().mockReturnValue({ set: joinRequestSet });

  const txInviteWhere = vi.fn().mockReturnValue({
    then: (resolve: (rows: unknown[]) => unknown) => resolve(undefined),
  });
  const txInviteUpdate = vi.fn().mockReturnValue({
    set: () => ({ where: txInviteWhere }),
  });
  const txJoinInsert = vi.fn().mockReturnValue({
    values: (values: Record<string, unknown>) => {
      insertedValues = values;
      return {
        returning: () => ({
          then: (resolve: (rows: unknown[]) => unknown) => resolve([opts.joinRequest]),
        }),
      };
    },
  });
  const transaction = vi.fn(async (callback: (tx: Record<string, unknown>) => unknown) => {
    return await callback({
      update: txInviteUpdate,
      insert: txJoinInsert,
    } as any);
  });

  return {
    select: vi.fn((selection?: Record<string, unknown>) =>
      selection && "email" in selection ? authUserSelect() : inviteSelect(),
    ),
    update: joinRequestUpdate,
    transaction,
    getInsertedValues: () => insertedValues,
  };
}

function createApp(db: Record<string, unknown>, actor: Record<string, unknown> = {}) {
  return new Elysia({ prefix: "/api" }).derive(() => ({ actor })).use(accessRoutes(db as any));
}

async function req(
  app: any,
  method: string,
  path: string,
  body?: any,
  headers?: Record<string, string>,
) {
  const init: RequestInit = { method, headers: { ...headers } };
  if (body !== undefined) {
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

describe("invite onboarding routes", () => {
  beforeEach(() => {
    mockAccessService.canUser.mockResolvedValue(false);
    mockAgentService.getById.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a manifest for /invites/:token/onboarding", async () => {
    const invite = {
      id: "invite-1",
      companyId: "company-1",
      inviteType: "company_join",
      allowedJoinTypes: "agent",
      defaultsPayload: {
        agentMessage: "Join and keep the gateway healthy.",
      },
      expiresAt: new Date("2026-04-05T00:00:00.000Z"),
      invitedByUserId: null,
      tokenHash: "hash",
      revokedAt: null,
      acceptedAt: null,
      createdAt: new Date("2026-03-04T00:00:00.000Z"),
      updatedAt: new Date("2026-03-04T00:00:00.000Z"),
    };
    const app = createApp(createDbStub(invite));

    const res = await req(app, "GET", "/api/invites/token-123/onboarding");

    expect(res.status).toBe(200);
    expect(res.body.invite.id).toBe("invite-1");
    expect(res.body.onboarding.recommendedAdapterType).toBe("openclaw_gateway");
    expect(res.body.onboarding.registrationEndpoint.path).toBe("/api/invites/token-123/accept");
    expect(res.body.onboarding.claimEndpointTemplate.path).toBe("/api/join-requests/{requestId}/claim-api-key");
    expect(res.body.onboarding.textInstructions.path).toBe("/api/invites/token-123/onboarding.txt");
    expect(res.body.onboarding.skill.name).toBe("paperclip");
  });

  it("still returns onboarding for an accepted invite", async () => {
    const invite = {
      id: "invite-accepted",
      companyId: "company-1",
      inviteType: "company_join",
      allowedJoinTypes: "agent",
      defaultsPayload: null,
      expiresAt: new Date("2026-04-05T00:00:00.000Z"),
      invitedByUserId: null,
      tokenHash: "hash",
      revokedAt: null,
      acceptedAt: new Date("2026-04-04T00:00:00.000Z"),
      createdAt: new Date("2026-03-04T00:00:00.000Z"),
      updatedAt: new Date("2026-03-04T00:00:00.000Z"),
    };
    const app = createApp(createDbStub(invite));

    const res = await req(app, "GET", "/api/invites/token-accepted/onboarding");

    expect(res.status).toBe(200);
    expect(res.body.invite.id).toBe("invite-accepted");
    expect(res.body.onboarding.recommendedAdapterType).toBe("openclaw_gateway");
  });

  it("probes invite resolution targets with HEAD", async () => {
    const invite = {
      id: "invite-1",
      companyId: "company-1",
      inviteType: "company_join",
      allowedJoinTypes: "agent",
      defaultsPayload: null,
      expiresAt: new Date("2026-04-05T00:00:00.000Z"),
      invitedByUserId: null,
      tokenHash: "hash",
      revokedAt: null,
      acceptedAt: null,
      createdAt: new Date("2026-03-04T00:00:00.000Z"),
      updatedAt: new Date("2026-03-04T00:00:00.000Z"),
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const app = createApp(createDbStub(invite));

    const res = await req(
      app,
      "GET",
      "/api/invites/token-123/test-resolution?url=https%3A%2F%2Fexample.com&timeoutMs=2000",
    );

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("reachable");
    expect(res.body.method).toBe("HEAD");
    expect(res.body.requestedUrl).toBe("https://example.com/");
    expect(res.body.testResolutionPath).toBe("/api/invites/token-123/test-resolution");
  });

  it("accepts paperclipApiUrl in the invite accept payload", async () => {
    const invite = {
      id: "invite-2",
      companyId: "company-1",
      inviteType: "company_join",
      allowedJoinTypes: "agent",
      defaultsPayload: null,
      expiresAt: new Date("2026-04-05T00:00:00.000Z"),
      invitedByUserId: null,
      tokenHash: "hash",
      revokedAt: null,
      acceptedAt: null,
      createdAt: new Date("2026-03-04T00:00:00.000Z"),
      updatedAt: new Date("2026-03-04T00:00:00.000Z"),
    };
    const joinRequest = {
      id: "join-1",
      companyId: "company-1",
      inviteId: "invite-2",
      requestType: "agent",
      status: "pending_approval",
      requestIp: "unknown",
      requestingUserId: null,
      requestEmailSnapshot: null,
      agentName: "OpenClaw",
      adapterType: "openclaw_gateway",
      capabilities: "Gateway",
      agentDefaultsPayload: {
        url: "ws://127.0.0.1:18789",
        paperclipApiUrl: "https://paperclip.example.com",
        headers: {
          "x-openclaw-token": "gateway-token-1234567890",
        },
      },
      claimSecretHash: null,
      claimSecretExpiresAt: null,
      createdAt: new Date("2026-03-04T00:00:00.000Z"),
      updatedAt: new Date("2026-03-04T00:00:00.000Z"),
    };
    const app = createApp(createAcceptDbStub({ invite, joinRequest }));

    const res = await req(
      app,
      "POST",
      "/api/invites/token-123/accept",
      {
        requestType: "agent",
        agentName: "OpenClaw",
        adapterType: "openclaw_gateway",
        capabilities: "Gateway",
        paperclipApiUrl: "https://paperclip.example.com",
        agentDefaultsPayload: {
          url: "ws://127.0.0.1:18789",
          headers: {
            "x-openclaw-token": "gateway-token-1234567890",
          },
        },
      },
      { host: "localhost:3100" },
    );

    expect(res.status).toBe(202);
    expect(res.body.agentDefaultsPayload.paperclipApiUrl).toBe("https://paperclip.example.com");
  });

  it("records request ip and email snapshot for human invite accepts", async () => {
    const invite = {
      id: "invite-human",
      companyId: "company-1",
      inviteType: "company_join",
      allowedJoinTypes: "both",
      defaultsPayload: null,
      expiresAt: new Date("2026-04-05T00:00:00.000Z"),
      invitedByUserId: null,
      tokenHash: "hash",
      revokedAt: null,
      acceptedAt: null,
      createdAt: new Date("2026-03-04T00:00:00.000Z"),
      updatedAt: new Date("2026-03-04T00:00:00.000Z"),
    };
    const joinRequest = {
      id: "join-human",
      companyId: "company-1",
      inviteId: "invite-human",
      requestType: "human",
      status: "pending_approval",
      requestIp: "127.0.0.1",
      requestingUserId: "local-board",
      requestEmailSnapshot: "local@paperclip.local",
      agentName: null,
      adapterType: null,
      capabilities: null,
      agentDefaultsPayload: null,
      claimSecretHash: null,
      claimSecretExpiresAt: null,
      createdAt: new Date("2026-03-04T00:00:00.000Z"),
      updatedAt: new Date("2026-03-04T00:00:00.000Z"),
    };
    const db = createAcceptDbStubCapturingInsert({ invite, joinRequest });
    const app = createApp(
      db,
      {
        type: "board",
        userId: "local-board",
        companyIds: ["company-1"],
        source: "local_implicit",
        isInstanceAdmin: true,
      },
    );

    const res = await req(
      app,
      "POST",
      "/api/invites/token-123/accept",
      {
        requestType: "human",
      },
      {
        host: "localhost:3100",
        "x-forwarded-for": "127.0.0.1",
      },
    );

    expect(res.status).toBe(202);
    expect(db.getInsertedValues()).toMatchObject({
      requestIp: "127.0.0.1",
      requestingUserId: "local-board",
      requestEmailSnapshot: "local@paperclip.local",
    });
  });
});
