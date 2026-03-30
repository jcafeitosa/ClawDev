import { Elysia } from "elysia";
import { describe, expect, it, vi } from "vitest";
import { companyRoutes } from "../routes/companies.js";
import { HttpError } from "../errors.js";

vi.mock("../services/index.js", () => ({
  companyService: () => ({
    list: vi.fn(),
    stats: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    remove: vi.fn(),
  }),
  companyPortabilityService: () => ({
    exportBundle: vi.fn(),
    previewExport: vi.fn(),
    previewImport: vi.fn(),
    importBundle: vi.fn(),
  }),
  accessService: () => ({
    canUser: vi.fn(),
    ensureMembership: vi.fn(),
  }),
  budgetService: () => ({
    upsertPolicy: vi.fn(),
  }),
  agentService: () => ({
    getById: vi.fn(),
  }),
  logActivity: vi.fn(),
}));

describe("company routes malformed issue path guard", () => {
  it("returns a clear error when companyId is missing for issues list path", async () => {
    const app = new Elysia()
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
      .derive(() => ({
        actor: {
          type: "agent",
          agentId: "agent-1",
          companyId: "company-1",
          source: "agent_key",
        },
      }))
      .use(companyRoutes({} as any));

    const res = await app.handle(new Request("http://localhost/companies/issues"));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      error: "Missing companyId in path. Use /api/companies/{companyId}/issues.",
    });
  });
});
