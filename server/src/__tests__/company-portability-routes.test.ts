import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCompanyService = vi.hoisted(() => ({
  list: vi.fn(),
  stats: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
  remove: vi.fn(),
}));

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  ensureMembership: vi.fn(),
}));

const mockBudgetService = vi.hoisted(() => ({
  upsertPolicy: vi.fn(),
}));

const mockCompanyPortabilityService = vi.hoisted(() => ({
  exportBundle: vi.fn(),
  previewExport: vi.fn(),
  previewImport: vi.fn(),
  importBundle: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  accessService: () => mockAccessService,
  agentService: () => mockAgentService,
  budgetService: () => mockBudgetService,
  companyPortabilityService: () => mockCompanyPortabilityService,
  companyService: () => mockCompanyService,
  logActivity: mockLogActivity,
}));

async function createApp(actor: Record<string, unknown>) {
  const { companyRoutes } = await import("../routes/companies.js");
  const { HttpError } = await import("../errors.js");
  return new Elysia()
    .onError(({ error, set }) => {
      if (error instanceof HttpError) {
        set.status = error.status;
        return error.details
          ? { error: error.message, details: error.details }
          : { error: error.message };
      }
      set.status = 500;
      return { error: "Internal server error" };
    })
    .derive(() => ({ actor }))
    .use(companyRoutes({} as any));
}

describe("company portability routes", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAgentService.getById.mockReset();
    mockCompanyPortabilityService.exportBundle.mockReset();
    mockCompanyPortabilityService.previewExport.mockReset();
    mockCompanyPortabilityService.previewImport.mockReset();
    mockCompanyPortabilityService.importBundle.mockReset();
    mockLogActivity.mockReset();
  });

  it("rejects non-CEO agents from CEO-safe export preview routes", async () => {
    mockAgentService.getById.mockResolvedValue({
      id: "agent-1",
      companyId: "11111111-1111-4111-8111-111111111111",
      role: "engineer",
    });
    const app = await createApp({
      type: "agent",
      agentId: "agent-1",
      companyId: "11111111-1111-4111-8111-111111111111",
      source: "agent_key",
      runId: "run-1",
    });

    const res = await app.handle(
      new Request("http://localhost/companies/11111111-1111-4111-8111-111111111111/exports/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ include: { company: true, agents: true, projects: true } }),
      }),
    );

    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toContain("Only CEO agents");
    expect(mockCompanyPortabilityService.previewExport).not.toHaveBeenCalled();
  });

  it("allows CEO agents to use company-scoped export preview routes", async () => {
    mockAgentService.getById.mockResolvedValue({
      id: "agent-1",
      companyId: "11111111-1111-4111-8111-111111111111",
      role: "ceo",
    });
    mockCompanyPortabilityService.previewExport.mockResolvedValue({
      rootPath: "paperclip",
      manifest: { agents: [], skills: [], projects: [], issues: [], envInputs: [], includes: { company: true, agents: true, projects: true, issues: false, skills: false }, company: null, schemaVersion: 1, generatedAt: new Date().toISOString(), source: null },
      files: {},
      fileInventory: [],
      counts: { files: 0, agents: 0, skills: 0, projects: 0, issues: 0 },
      warnings: [],
      paperclipExtensionPath: ".paperclip.yaml",
    });
    const app = await createApp({
      type: "agent",
      agentId: "agent-1",
      companyId: "11111111-1111-4111-8111-111111111111",
      source: "agent_key",
      runId: "run-1",
    });

    const res = await app.handle(
      new Request("http://localhost/companies/11111111-1111-4111-8111-111111111111/exports/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ include: { company: true, agents: true, projects: true } }),
      }),
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(mockCompanyPortabilityService.previewExport).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", {
      include: { company: true, agents: true, projects: true },
    });
  });

  it("rejects replace collision strategy on CEO-safe import routes", async () => {
    mockAgentService.getById.mockResolvedValue({
      id: "agent-1",
      companyId: "11111111-1111-4111-8111-111111111111",
      role: "ceo",
    });
    const app = await createApp({
      type: "agent",
      agentId: "agent-1",
      companyId: "11111111-1111-4111-8111-111111111111",
      source: "agent_key",
      runId: "run-1",
    });

    const res = await app.handle(
      new Request("http://localhost/companies/11111111-1111-4111-8111-111111111111/imports/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: { type: "inline", files: { "COMPANY.md": "---\nname: Test\n---\n" } },
          include: { company: true, agents: true, projects: false, issues: false },
          target: { mode: "existing_company", companyId: "11111111-1111-4111-8111-111111111111" },
          collisionStrategy: "replace",
        }),
      }),
    );

    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toContain("does not allow replace");
    expect(mockCompanyPortabilityService.previewImport).not.toHaveBeenCalled();
  });

  it("keeps global import preview routes board-only", async () => {
    const app = await createApp({
      type: "agent",
      agentId: "agent-1",
      companyId: "11111111-1111-4111-8111-111111111111",
      source: "agent_key",
      runId: "run-1",
    });

    const res = await app.handle(
      new Request("http://localhost/companies/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: { type: "inline", files: { "COMPANY.md": "---\nname: Test\n---\n" } },
          include: { company: true, agents: true, projects: false, issues: false },
          target: { mode: "existing_company", companyId: "11111111-1111-4111-8111-111111111111" },
          collisionStrategy: "rename",
        }),
      }),
    );

    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toContain("Board access required");
  });
});
