import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { companySkillRoutes } from "../routes/company-skills.js";

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  canUser: vi.fn(),
  hasPermission: vi.fn(),
}));

const mockCompanySkillService = vi.hoisted(() => ({
  importFromSource: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  accessService: () => mockAccessService,
  agentService: () => mockAgentService,
  companySkillService: () => mockCompanySkillService,
  logActivity: mockLogActivity,
}));

function createApp(actor: Record<string, unknown>) {
  return new Elysia({ prefix: "/api" })
    .derive(() => ({ actor }))
    .use(companySkillRoutes({} as any));
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

describe("company skill mutation permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompanySkillService.importFromSource.mockResolvedValue({
      imported: [],
      warnings: [],
    });
    mockLogActivity.mockResolvedValue(undefined);
    mockAccessService.canUser.mockResolvedValue(true);
    mockAccessService.hasPermission.mockResolvedValue(false);
  });

  it("allows local board operators to mutate company skills", async () => {
    const res = await req(createApp({
      type: "board",
      userId: "local-board",
      companyIds: ["company-1"],
      source: "local_implicit",
      isInstanceAdmin: false,
    }), "POST", "/api/companies/company-1/skills/import", { source: "https://github.com/vercel-labs/agent-browser" });

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(mockCompanySkillService.importFromSource).toHaveBeenCalledWith(
      "company-1",
      "https://github.com/vercel-labs/agent-browser",
    );
  });

  it("blocks same-company agents without management permission from mutating company skills", async () => {
    mockAgentService.getById.mockResolvedValue({
      id: "agent-1",
      companyId: "company-1",
      permissions: {},
    });

    const res = await req(createApp({
      type: "agent",
      agentId: "agent-1",
      companyId: "company-1",
      runId: "run-1",
    }), "POST", "/api/companies/company-1/skills/import", { source: "https://github.com/vercel-labs/agent-browser" });

    expect(res.status, JSON.stringify(res.body)).toBe(403);
    expect(mockCompanySkillService.importFromSource).not.toHaveBeenCalled();
  });

  it("allows agents with canCreateAgents to mutate company skills", async () => {
    mockAgentService.getById.mockResolvedValue({
      id: "agent-1",
      companyId: "company-1",
      permissions: { canCreateAgents: true },
    });

    const res = await req(createApp({
      type: "agent",
      agentId: "agent-1",
      companyId: "company-1",
      runId: "run-1",
    }), "POST", "/api/companies/company-1/skills/import", { source: "https://github.com/vercel-labs/agent-browser" });

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(mockCompanySkillService.importFromSource).toHaveBeenCalledWith(
      "company-1",
      "https://github.com/vercel-labs/agent-browser",
    );
  });
});
