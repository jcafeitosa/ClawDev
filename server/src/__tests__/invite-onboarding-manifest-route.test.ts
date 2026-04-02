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

function createApp(db: Record<string, unknown>) {
  return new Elysia({ prefix: "/api" }).use(accessRoutes(db as any));
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
    expect(res.body.onboarding.skill.name).toBe("clawdev");
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
});
