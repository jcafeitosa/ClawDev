import { Elysia } from "elysia";
import { describe, expect, it, vi } from "vitest";

const mockProjectCreate = vi.fn();
const mockProjectCreateWorkspace = vi.fn();
const mockProjectGetById = vi.fn();
const mockProjectRemove = vi.fn();
const mockIssueCreate = vi.fn();

vi.mock("../services/index.js", () => ({
  projectService: () => ({
    create: mockProjectCreate,
    createWorkspace: mockProjectCreateWorkspace,
    getById: mockProjectGetById,
    remove: mockProjectRemove,
  }),
  issueService: () => ({ create: mockIssueCreate }),
  logActivity: vi.fn(),
  workspaceOperationService: () => ({}),
  accessService: () => ({ canUser: vi.fn(), hasPermission: vi.fn() }),
  goalService: () => ({ getById: vi.fn(), getDefaultCompanyGoal: vi.fn() }),
  documentService: () => ({}),
  executionWorkspaceService: () => ({}),
  heartbeatService: () => ({}),
  workProductService: () => ({}),
  routineService: () => ({}),
  issueApprovalService: () => ({}),
  agentService: () => ({ getById: vi.fn() }),
}));

vi.mock("../routes/issues-checkout-wakeup.js", () => ({
  queueIssueAssignmentWakeup: vi.fn(),
}));

async function createProjectApp() {
  const { projectRoutes } = await import("../routes/projects.js");
  return new Elysia({ prefix: "/api" })
    .derive(() => ({
      actor: {
        type: "board",
        source: "local_implicit",
        userId: "user-1",
        companyIds: ["company-1"],
      },
    }))
    .use(projectRoutes({} as any));
}

async function createIssueApp() {
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
    .use(issueRoutes({} as any, {} as any));
}

describe("structured delivery create routes", () => {
  it("rejects project creation without SDD spec and design", async () => {
    mockProjectCreate.mockReset();
    const app = await createProjectApp();
    const res = await app.handle(
      new Request("http://localhost/api/companies/company-1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Onboarding", description: "Launch project" }),
      }),
    );

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: "SDD spec and design are required for project creation",
    });
    expect(mockProjectCreate).not.toHaveBeenCalled();
  });

  it("composes project description from structured SDD fields", async () => {
    mockProjectCreate.mockReset();
    mockProjectCreate.mockResolvedValue({ id: "project-1", name: "Onboarding" });
    mockProjectCreateWorkspace.mockReset();
    mockProjectGetById.mockReset();
    mockProjectRemove.mockReset();

    const app = await createProjectApp();
    const res = await app.handle(
      new Request("http://localhost/api/companies/company-1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Onboarding",
          description: "Company launch plan",
          sddSpec: "Define the launch scope.",
          sddDesign: "Split the work into one owner per slice.",
          sddValidation: "Confirm launch readiness before execution.",
        }),
      }),
    );

    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created).toEqual({ id: "project-1", name: "Onboarding" });
    expect(mockProjectCreate).toHaveBeenCalledTimes(1);
    expect(mockProjectCreate.mock.calls[0]?.[1]).toMatchObject({
      name: "Onboarding",
      description: expect.stringContaining("## Spec"),
    });
    expect(mockProjectCreate.mock.calls[0]?.[1].description).toContain("## Design");
    expect(mockProjectCreate.mock.calls[0]?.[1].description).toContain("## Validation");
  });

  it("rejects issue creation without SDD spec and design", async () => {
    mockIssueCreate.mockReset();
    const app = await createIssueApp();
    const res = await app.handle(
      new Request("http://localhost/api/companies/company-1/issues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "First issue", status: "todo" }),
      }),
    );

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: "SDD spec and design are required for issue creation",
    });
    expect(mockIssueCreate).not.toHaveBeenCalled();
  });

  it("composes issue description from structured SDD fields", async () => {
    mockIssueCreate.mockReset();
    mockIssueCreate.mockResolvedValue({ id: "issue-1", title: "First issue" });

    const app = await createIssueApp();
    const res = await app.handle(
      new Request("http://localhost/api/companies/company-1/issues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "First issue",
          description: "Short summary",
          sddSpec: "Define the issue scope.",
          sddDesign: "Assign one owner and one execution slice.",
          sddValidation: "Validate the acceptance criteria before starting.",
        }),
      }),
    );

    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created).toEqual({ id: "issue-1", title: "First issue" });
    expect(mockIssueCreate).toHaveBeenCalledTimes(1);
    expect(mockIssueCreate.mock.calls[0]?.[1]).toMatchObject({
      title: "First issue",
      description: expect.stringContaining("## Overview"),
    });
    expect(mockIssueCreate.mock.calls[0]?.[1].description).toContain("## Spec");
    expect(mockIssueCreate.mock.calls[0]?.[1].description).toContain("## Design");
    expect(mockIssueCreate.mock.calls[0]?.[1].description).toContain("## Validation");
  });
});
