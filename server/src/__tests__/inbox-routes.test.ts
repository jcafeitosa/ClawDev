import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { inboxRoutes } from "../routes/inbox.js";

const companyId = "11111111-1111-4111-8111-111111111111";

const mockAccessService = vi.hoisted(() => ({
  canUser: vi.fn(),
  hasPermission: vi.fn(),
}));

const mockDashboardSummary = vi.hoisted(() => vi.fn());
const mockIssueService = vi.hoisted(() => ({
  countUnreadTouchedByUser: vi.fn(),
}));
const mockSidebarBadgeGet = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  accessService: () => mockAccessService,
  dashboardService: () => ({ summary: mockDashboardSummary }),
  issueService: () => mockIssueService,
  sidebarBadgeService: () => ({ get: mockSidebarBadgeGet }),
}));

function createDbStub(joinRequestCount: number) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          then: (resolve: (rows: Array<{ count: number }>) => unknown) =>
            Promise.resolve(resolve([{ count: joinRequestCount }])),
        })),
      })),
    })),
  } as any;
}

async function req(app: any, method: string, path: string) {
  const res = await app.handle(new Request(`http://localhost${path}`, { method }));
  return { status: res.status, body: await res.json() };
}

describe("inbox routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccessService.canUser.mockResolvedValue(true);
    mockAccessService.hasPermission.mockResolvedValue(false);
    mockIssueService.countUnreadTouchedByUser.mockResolvedValue(3);
    mockSidebarBadgeGet.mockResolvedValue({
      inbox: 6,
      approvals: 2,
      failedRuns: 0,
      joinRequests: 4,
    });
    mockDashboardSummary.mockResolvedValue({
      agents: { error: 1 },
      costs: { monthBudgetCents: 10000, monthUtilizationPercent: 90 },
    });
  });

  it("returns the aggregate inbox total and forwards unread touched counts to sidebar badges", async () => {
    const app = new Elysia({ prefix: "/api" })
      .derive(() => ({
        actor: {
          type: "board",
          source: "local_implicit",
          userId: "board-user",
          companyIds: [companyId],
        },
      }))
      .use(inboxRoutes(createDbStub(4) as any));

    const res = await req(app, "GET", `/api/companies/${companyId}/inbox?status=unread&limit=0`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 8,
      count: 8,
      inbox: 8,
      approvals: 2,
      failedRuns: 0,
      joinRequests: 4,
      unreadTouchedIssues: 3,
      alerts: 2,
    });
    expect(mockSidebarBadgeGet).toHaveBeenCalledWith(companyId, {
      joinRequests: 4,
      unreadTouchedIssues: 3,
    });
  });
});
