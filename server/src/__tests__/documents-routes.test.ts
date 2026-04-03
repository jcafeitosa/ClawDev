import { Elysia } from "elysia";
import { describe, expect, it, vi } from "vitest";
import { documentRoutes } from "../routes/documents.js";

const companyId = "22222222-2222-4222-8222-222222222222";

const rows = [
  {
    id: "doc-1",
    companyId,
    issueId: "issue-1",
    issueIdentifier: "CLAW-1",
    issueTitle: "Architecture planning",
    title: "Architecture Notes",
    format: "markdown",
    latestBody: "# Notes",
    latestRevisionId: "rev-1",
    latestRevisionNumber: 3,
    createdByAgentId: null,
    createdByUserId: null,
    updatedByAgentId: null,
    updatedByUserId: null,
    createdAt: new Date("2026-03-19T00:00:00.000Z"),
    updatedAt: new Date("2026-03-19T00:00:00.000Z"),
  },
];

function createDbStub() {
  const queryChain = {
    leftJoin: vi.fn(() => queryChain),
    where: vi.fn(() => queryChain),
    orderBy: vi.fn(async () => rows),
    limit: vi.fn(async () => rows),
  };
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => queryChain),
    })),
  };
}

function createApp() {
  return new Elysia({ prefix: "/api" })
    .derive(() => ({
      actor: {
        type: "board",
        source: "local_implicit",
        userId: "board-user",
      },
    }))
    .use(documentRoutes(createDbStub() as any));
}

describe("document routes", () => {
  it("includes issue linkage when listing company documents", async () => {
    const app = createApp();

    const res = await app.handle(
      new Request(`http://localhost/api/companies/${companyId}/documents`, {
        method: "GET",
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
        id: "doc-1",
        companyId,
        issueId: "issue-1",
        issueIdentifier: "CLAW-1",
        issueTitle: "Architecture planning",
        title: "Architecture Notes",
        format: "markdown",
        body: "# Notes",
        latestRevisionId: "rev-1",
        latestRevisionNumber: 3,
        createdByAgentId: null,
        createdByUserId: null,
        updatedByAgentId: null,
        updatedByUserId: null,
        createdAt: "2026-03-19T00:00:00.000Z",
        updatedAt: "2026-03-19T00:00:00.000Z",
      },
    ]);
  });

  it("filters company documents by query", async () => {
    const app = createApp();

    const res = await app.handle(
      new Request(`http://localhost/api/companies/${companyId}/documents?q=Architecture`, {
        method: "GET",
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
        id: "doc-1",
        companyId,
        issueId: "issue-1",
        issueIdentifier: "CLAW-1",
        issueTitle: "Architecture planning",
        title: "Architecture Notes",
        format: "markdown",
        body: "# Notes",
        latestRevisionId: "rev-1",
        latestRevisionNumber: 3,
        createdByAgentId: null,
        createdByUserId: null,
        updatedByAgentId: null,
        updatedByUserId: null,
        createdAt: "2026-03-19T00:00:00.000Z",
        updatedAt: "2026-03-19T00:00:00.000Z",
      },
    ]);
  });
});
