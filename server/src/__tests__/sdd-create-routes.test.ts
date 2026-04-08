import { Elysia } from "elysia";
import { describe, expect, it, vi } from "vitest";

const mockProjectCreate = vi.fn();
const mockProjectCreateWorkspace = vi.fn();
const mockProjectGetById = vi.fn();
const mockProjectUpdate = vi.fn();
const mockProjectRemove = vi.fn();
const mockIssueCreate = vi.fn();
const mockIssueGetById = vi.fn();
const mockIssueUpdate = vi.fn();
const COMPANY_ID = "11111111-1111-4111-8111-111111111111";

vi.mock("../services/index.js", () => ({
  projectService: () => ({
    create: mockProjectCreate,
    createWorkspace: mockProjectCreateWorkspace,
    getById: mockProjectGetById,
    update: mockProjectUpdate,
    remove: mockProjectRemove,
  }),
  issueService: () => ({ create: mockIssueCreate, getById: mockIssueGetById, update: mockIssueUpdate }),
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

vi.mock("../middleware/logger.js", () => ({
  logger: (() => {
    const logger = {
      child: vi.fn(() => logger),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    return logger;
  })(),
}));

vi.mock("../middleware/elysia-logger.js", () => ({
  elysiaLogger: new Elysia({ name: "logger" }),
}));

async function createProjectApp() {
  const { projectRoutes } = await import("../routes/projects.js");
  return new Elysia({ prefix: "/api" })
    .derive(() => ({
      actor: {
        type: "board",
        source: "local_implicit",
        userId: "user-1",
        companyIds: [COMPANY_ID],
      },
    }))
    .use(projectRoutes({} as any));
}

async function createIssueApp() {
  const { issueRoutes, companyIssueRoutes } = await import("../routes/issues.js");
  return new Elysia({ prefix: "/api" })
    .derive(() => ({
      actor: {
        type: "board",
        source: "local_implicit",
        userId: "user-1",
        companyIds: [COMPANY_ID],
      },
    }))
    .use(issueRoutes({} as any))
    .use(companyIssueRoutes({} as any));
}

describe("structured delivery create routes", () => {
  it("allows project creation without SDD spec and design but preserves the structured description contract", async () => {
    mockProjectCreate.mockReset();
    mockProjectCreate.mockResolvedValue({ id: "project-1", name: "Onboarding" });
    const app = await createProjectApp();
    const res = await app.handle(
      new Request(`http://localhost/api/companies/${COMPANY_ID}/projects`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Onboarding", description: "Launch project" }),
      }),
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "project-1", name: "Onboarding" });
    expect(mockProjectCreate).toHaveBeenCalledTimes(1);
    expect(mockProjectCreate.mock.calls[0]?.[1].description).toContain("## Spec");
    expect(mockProjectCreate.mock.calls[0]?.[1].description).toContain("## Design");
    expect(mockProjectCreate.mock.calls[0]?.[1].description).toContain("## Risk");
    expect(mockProjectCreate.mock.calls[0]?.[1].description).toContain("## Rollout");
    expect(mockProjectCreate.mock.calls[0]?.[1].description).toContain("## Rollback");
    expect(mockProjectCreate.mock.calls[0]?.[1].description).toContain("## Validation");
  });

  it("composes project description from structured SDD fields", async () => {
    mockProjectCreate.mockReset();
    mockProjectCreate.mockResolvedValue({ id: "project-1", name: "Onboarding" });
    mockProjectCreateWorkspace.mockReset();
    mockProjectGetById.mockReset();
    mockProjectRemove.mockReset();

    const app = await createProjectApp();
    const res = await app.handle(
      new Request(`http://localhost/api/companies/${COMPANY_ID}/projects`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Onboarding",
          description: "Company launch plan",
          sddSpec: "Define the launch scope, the owners, and the acceptance criteria for the project.",
          sddDesign: "Split the work into one owner per slice and one review path per dependency.",
          sddRisk: "The main risk is ownership drift across launch steps, so keep each milestone small and explicit.",
          sddRollout: "Roll out the project in one controlled milestone, then expand once the first pass proves stable.",
          sddRollback: "If launch validation fails, revert the change, reset the project state, and retry from the plan.",
          sddValidation: "Confirm launch readiness before execution and verify the project can be safely handed off.",
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
    expect(mockProjectCreate.mock.calls[0]?.[1].description).toContain("## Risk");
    expect(mockProjectCreate.mock.calls[0]?.[1].description).toContain("## Rollout");
    expect(mockProjectCreate.mock.calls[0]?.[1].description).toContain("## Rollback");
    expect(mockProjectCreate.mock.calls[0]?.[1].description).toContain("## Validation");
  });

  it("allows project patching with a complete structured SDD payload", async () => {
    mockProjectGetById.mockReset();
    mockProjectUpdate.mockReset();
    mockProjectGetById.mockResolvedValue({ id: "project-1", companyId: COMPANY_ID });
    mockProjectUpdate.mockResolvedValue({ id: "project-1", companyId: COMPANY_ID, name: "Onboarding" });

    const app = await createProjectApp();
    const res = await app.handle(
      new Request(`http://localhost/api/projects/project-1`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description: "Project overview update",
          sddSpec: "Rewrite the project spec while patching.",
          sddDesign: "Keep the implementation small and explicit while preserving the current project structure.",
          sddRisk: "The main risk is rewriting the description into an inconsistent state, so update all sections together.",
          sddRollout: "Apply the change in one controlled patch after reviewing the composed structured description.",
          sddRollback: "If validation fails, restore the previous description and retry with corrected sections.",
          sddValidation: "Confirm the composed description still contains the expected structured sections.",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "project-1", companyId: COMPANY_ID, name: "Onboarding" });
    expect(mockProjectUpdate).toHaveBeenCalledTimes(1);
    expect(mockProjectUpdate.mock.calls[0]?.[1].description).toContain("## Overview");
    expect(mockProjectUpdate.mock.calls[0]?.[1].description).toContain("## Spec");
    expect(mockProjectUpdate.mock.calls[0]?.[1].description).toContain("## Design");
    expect(mockProjectUpdate.mock.calls[0]?.[1].description).toContain("## Risk");
    expect(mockProjectUpdate.mock.calls[0]?.[1].description).toContain("## Rollout");
    expect(mockProjectUpdate.mock.calls[0]?.[1].description).toContain("## Rollback");
    expect(mockProjectUpdate.mock.calls[0]?.[1].description).toContain("## Validation");
  });

  it("allows issue creation without SDD spec and design but preserves the structured description contract", async () => {
    mockIssueCreate.mockReset();
    mockIssueCreate.mockResolvedValue({ id: "issue-1", title: "First issue" });
    const app = await createIssueApp();
    const res = await app.handle(
      new Request(`http://localhost/api/companies/${COMPANY_ID}/issues`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "First issue", status: "todo" }),
      }),
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "issue-1", title: "First issue" });
    expect(mockIssueCreate).toHaveBeenCalledTimes(1);
    expect(mockIssueCreate.mock.calls[0]?.[1].description).toContain("## Spec");
    expect(mockIssueCreate.mock.calls[0]?.[1].description).toContain("## Design");
    expect(mockIssueCreate.mock.calls[0]?.[1].description).toContain("## Risk");
    expect(mockIssueCreate.mock.calls[0]?.[1].description).toContain("## Rollout");
    expect(mockIssueCreate.mock.calls[0]?.[1].description).toContain("## Rollback");
    expect(mockIssueCreate.mock.calls[0]?.[1].description).toContain("## Validation");
  });

  it("composes issue description from structured SDD fields", async () => {
    mockIssueCreate.mockReset();
    mockIssueCreate.mockResolvedValue({ id: "issue-1", title: "First issue" });

    const app = await createIssueApp();
    const res = await app.handle(
      new Request(`http://localhost/api/companies/${COMPANY_ID}/issues`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "First issue",
          description: "Short summary",
          sddSpec: "Define the issue scope, the expected outcome, and the acceptance criteria for delivery.",
          sddDesign: "Assign one owner and one execution slice with the minimum dependencies needed to finish the work.",
          sddRisk: "The main risk is an unintended dependency chain, so keep the change narrow and explicit.",
          sddRollout: "Roll out the issue as a single owner execution slice and confirm the first checkpoint.",
          sddRollback: "If validation fails, revert the change, restore the previous state, and reopen the issue.",
          sddValidation: "Validate the acceptance criteria before starting and confirm the change is safe to execute.",
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
    expect(mockIssueCreate.mock.calls[0]?.[1].description).toContain("## Risk");
    expect(mockIssueCreate.mock.calls[0]?.[1].description).toContain("## Rollout");
    expect(mockIssueCreate.mock.calls[0]?.[1].description).toContain("## Rollback");
    expect(mockIssueCreate.mock.calls[0]?.[1].description).toContain("## Validation");
  });

  it("allows issue patching with a complete structured SDD payload", async () => {
    mockIssueGetById.mockReset();
    mockIssueUpdate.mockReset();
    const issueId = "11111111-1111-4111-8111-111111111112";
    mockIssueGetById.mockResolvedValue({ id: issueId, companyId: COMPANY_ID, title: "First issue" });
    mockIssueUpdate.mockResolvedValue({ id: issueId, title: "First issue" });

    const app = await createIssueApp();
    const res = await app.handle(
      new Request(`http://localhost/api/issues/${issueId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description: "Issue overview update",
          sddSpec: "Rewrite the issue spec while patching the record.",
          sddDesign: "Keep the execution path narrow and explicit while preserving the current issue state.",
          sddRisk: "The main risk is clobbering the description with an incomplete payload, so replace all sections together.",
          sddRollout: "Apply the change in one controlled patch after confirming the structured payload is complete.",
          sddRollback: "If validation fails, restore the previous description and retry with a corrected payload.",
          sddValidation: "Confirm the composed issue description still contains the expected sections.",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: issueId, title: "First issue", comment: null });
    expect(mockIssueUpdate).toHaveBeenCalledTimes(1);
    expect(mockIssueUpdate.mock.calls[0]?.[1].description).toContain("## Overview");
    expect(mockIssueUpdate.mock.calls[0]?.[1].description).toContain("## Spec");
    expect(mockIssueUpdate.mock.calls[0]?.[1].description).toContain("## Design");
    expect(mockIssueUpdate.mock.calls[0]?.[1].description).toContain("## Risk");
    expect(mockIssueUpdate.mock.calls[0]?.[1].description).toContain("## Rollout");
    expect(mockIssueUpdate.mock.calls[0]?.[1].description).toContain("## Rollback");
    expect(mockIssueUpdate.mock.calls[0]?.[1].description).toContain("## Validation");
  });

});
