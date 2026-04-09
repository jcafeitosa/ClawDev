import { Elysia } from "elysia";
import { describe, expect, it, vi } from "vitest";

vi.mock("../services/index.js", () => ({
  issueService: () => ({}),
  issueApprovalService: () => ({}),
  accessService: () => ({}),
  goalService: () => ({}),
  projectService: () => ({}),
  documentService: () => ({}),
  executionWorkspaceService: () => ({}),
  heartbeatService: () => ({}),
  workProductService: () => ({}),
  logActivity: vi.fn(),
  routineService: () => ({}),
  agentService: () => ({}),
  companyService: () => ({
    getById: vi.fn(async () => null),
    list: vi.fn(async () => []),
    stats: vi.fn(async () => ({})),
    create: vi.fn(async () => null),
    update: vi.fn(async () => null),
  }),
  companyPortabilityService: () => ({
    exportCompany: vi.fn(async () => null),
    importCompany: vi.fn(async () => null),
    previewImport: vi.fn(async () => null),
  }),
  budgetService: () => ({
    upsertPolicy: vi.fn(async () => undefined),
  }),
}));

async function createApp() {
  const { companyRoutes } = await import("../routes/companies.js");
  return new Elysia({ prefix: "/api" })
    .derive(() => ({
      actor: {
        type: "board",
        source: "local_implicit",
        userId: "user-1",
        companyIds: ["company-1"],
      },
    }))
    .use(companyRoutes({} as any));
}

describe("issues root route", () => {
  it("rejects the companyless /companies/issues endpoint", async () => {
    const app = await createApp();
    const res = await app.handle(new Request("http://localhost/api/companies/issues"));

    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Missing companyId in path. Use /api/companies/{companyId}/issues.");
  });
});
