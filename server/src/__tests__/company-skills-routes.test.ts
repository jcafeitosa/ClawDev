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
  getById: vi.fn(),
  detail: vi.fn(),
  importFromSource: vi.fn(),
  updateStatus: vi.fn(),
  deleteSkill: vi.fn(),
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
    mockCompanySkillService.getById.mockResolvedValue({
      id: "skill-1",
      companyId: "company-1",
      key: "company/company-1/skill-1",
      slug: "skill-1",
      name: "Skill 1",
      description: null,
      markdown: "---\nname: Skill 1\n---\n# Skill 1",
      sourceType: "local_path",
      sourceLocator: null,
      sourceRef: null,
      trustLevel: "markdown_only",
      compatibility: "compatible",
      fileInventory: [],
      metadata: null,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    });
    mockCompanySkillService.detail.mockResolvedValue({
      id: "skill-1",
      companyId: "company-1",
      key: "company/company-1/skill-1",
      slug: "skill-1",
      name: "Skill 1",
      description: null,
      markdown: "---\nname: Skill 1\n---\n# Skill 1",
      sourceType: "local_path",
      sourceLocator: null,
      sourceRef: null,
      trustLevel: "markdown_only",
      compatibility: "compatible",
      fileInventory: [],
      metadata: null,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
      attachedAgentCount: 0,
      usedByAgents: [],
      editable: true,
      editableReason: null,
      sourceLabel: "Local",
      sourceBadge: "local",
      sourcePath: "skills/skill-1",
    });
    mockCompanySkillService.updateStatus.mockResolvedValue({
      supported: true,
      reason: null,
      trackingRef: "main",
      currentRef: "abc123",
      latestRef: "abc123",
      hasUpdate: false,
    });
    mockCompanySkillService.deleteSkill.mockResolvedValue({
      id: "skill-1",
      slug: "skill-1",
      name: "Skill 1",
    });
    mockLogActivity.mockResolvedValue(undefined);
    mockAccessService.canUser.mockResolvedValue(false);
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

  it("allows board users with agents:create access to mutate company skills", async () => {
    mockAccessService.canUser.mockResolvedValue(true);

    const res = await req(createApp({
      type: "board",
      userId: "board-user",
      companyIds: ["company-1"],
      source: "session",
      isInstanceAdmin: false,
    }), "POST", "/api/companies/company-1/skills/import", { source: "https://github.com/vercel-labs/agent-browser" });

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(mockAccessService.canUser).toHaveBeenCalledWith("company-1", "board-user", "agents:create");
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

  it("allows agents with an explicit agents:create grant to mutate company skills", async () => {
    mockAgentService.getById.mockResolvedValue({
      id: "agent-1",
      companyId: "company-1",
      permissions: {},
    });
    mockAccessService.hasPermission.mockResolvedValue(true);

    const res = await req(createApp({
      type: "agent",
      agentId: "agent-1",
      companyId: "company-1",
      runId: "run-1",
    }), "POST", "/api/companies/company-1/skills/import", { source: "https://github.com/vercel-labs/agent-browser" });

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(mockAccessService.hasPermission).toHaveBeenCalledWith("company-1", "agent", "agent-1", "agents:create");
  });

  it("exposes the upstream update status for a company skill", async () => {
    const res = await req(createApp({
      type: "board",
      userId: "local-board",
      companyIds: ["company-1"],
      source: "local_implicit",
      isInstanceAdmin: false,
    }), "GET", "/api/companies/company-1/skills/skill-1/update-status");

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(mockCompanySkillService.updateStatus).toHaveBeenCalledWith("company-1", "skill-1");
  });

  it("exposes the company-scoped skill detail route", async () => {
    const res = await req(createApp({
      type: "board",
      userId: "local-board",
      companyIds: ["company-1"],
      source: "local_implicit",
      isInstanceAdmin: false,
    }), "GET", "/api/companies/company-1/skills/skill-1");

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(mockCompanySkillService.detail).toHaveBeenCalledWith("company-1", "skill-1");
  });

  it("supports deleting company-scoped skills", async () => {
    const res = await req(createApp({
      type: "board",
      userId: "local-board",
      companyIds: ["company-1"],
      source: "local_implicit",
      isInstanceAdmin: false,
    }), "DELETE", "/api/companies/company-1/skills/skill-1");

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(mockCompanySkillService.deleteSkill).toHaveBeenCalledWith("company-1", "skill-1");
  });
});
