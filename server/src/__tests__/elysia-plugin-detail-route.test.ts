import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../routes/plugins.js", () => ({
  pluginRoutes: () => new Elysia(),
}));

vi.mock("../services/plugin-registry.js", () => ({
  pluginRegistryService: () => ({
    getById: vi.fn().mockResolvedValue(null),
    getByKey: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock("../middleware/auth.js", () => ({
  createActorResolver: () => () => ({
    actor: {
      type: "board",
      userId: "local-board",
      companyIds: ["company-1"],
      source: "local_implicit",
    },
  }),
}));

vi.mock("../realtime/live-events-ws.js", () => ({
  liveEventsElysiaWs: () => new Elysia(),
}));

vi.mock("../routes/plugin-ui-static.js", () => ({
  pluginUiStaticRoutes: () => new Elysia(),
}));

function createStorage() {
  return {
    upload: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
    list: vi.fn(async () => []),
  } as any;
}

describe("elysia plugin detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mounts GET /api/plugins/:pluginId on the full app", async () => {
    const { createElysiaApp } = await import("../elysia-app.js");
    const app = createElysiaApp({
      db: {
        select: () => ({ from: () => ({ where: () => ({ then: (cb: (rows: Array<unknown>) => unknown) => Promise.resolve(cb([])) }) }) }),
        execute: vi.fn(async () => undefined),
      } as any,
      deploymentMode: "local_trusted",
      deploymentExposure: "private",
      authReady: true,
      companyDeletionEnabled: true,
      storage: createStorage(),
      uiMode: "none",
      pluginDeps: {
        jobScheduler: { start: vi.fn(async () => undefined), stop: vi.fn(async () => undefined) } as any,
        jobStore: {} as any,
        workerManager: { getWorker: vi.fn(() => null) } as any,
        streamBus: { publish: vi.fn(), subscribe: vi.fn(() => () => undefined) } as any,
        toolDispatcher: { listToolsForAgent: vi.fn(() => []), executeTool: vi.fn(async () => undefined) } as any,
      },
    });

    const response = await app.handle(new Request("http://localhost/api/plugins/abc"));
    const text = await response.text();
    expect(response.status).toBe(404);
    expect(text).toBe(JSON.stringify({ error: "Plugin not found" }));
  });
});
