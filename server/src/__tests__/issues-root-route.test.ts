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
}));

async function createApp() {
  const { issueRoutes } = await import("../routes/issues.js");
  return new Elysia({ prefix: "/api" })
    .derive(() => ({
      actor: {
        type: "board",
        source: "local_implicit",
        userId: "user-1",
        companyIds: ["company-1"],
      },
    }))
    .use(issueRoutes({} as any));
}

describe("issues root route", () => {
  it(
    "rejects the companyless /issues endpoint",
    async () => {
    const app = await createApp();
    const res = await app.handle(new Request("http://localhost/api/issues"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Missing companyId in path. Use /api/companies/{companyId}/issues.",
    });
    },
    15_000,
  );
});
