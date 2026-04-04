import { Elysia } from "elysia";
import { describe, expect, it, vi } from "vitest";
import { companyRoutes } from "../routes/companies.js";
import { HttpError } from "../errors.js";

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

vi.mock("../services/index.js", () => ({
  accessService: () => mockAccessService,
  agentService: () => mockAgentService,
  budgetService: () => mockBudgetService,
  companyPortabilityService: () => mockCompanyPortabilityService,
  companyService: () => mockCompanyService,
  logActivity: vi.fn(),
}));

function createApp() {
  return new Elysia()
    .onError(({ error, set }) => {
      if (error instanceof HttpError) {
        set.status = error.status;
        return error.details
          ? { error: error.message, details: error.details }
          : { error: error.message };
      }
      if (error && typeof error === "object" && "issues" in error) {
        set.status = 400;
        return { error: "Validation error", details: (error as any).issues };
      }
      set.status = 500;
      return { error: "Internal server error" };
    })
    .derive(() => ({
      actor: {
        type: "board",
        userId: "user-1",
        source: "local_implicit",
      },
    }))
    .use(companyRoutes({} as any));
}

describe("GET /api/companies/:companyId", () => {
  it("returns Company not found for missing companies instead of API route not found", async () => {
    mockCompanyService.getById.mockResolvedValue(null);
    const app = createApp();

    const res = await app.handle(
      new Request("http://localhost/companies/11111111-1111-4111-8111-111111111111"),
    );

    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Company not found" });
  });
});
