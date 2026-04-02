import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pluginRoutes } from "../routes/plugins.js";

const mockPluginRegistryService = vi.hoisted(() => ({
  getById: vi.fn(),
  getByKey: vi.fn(),
  listByStatus: vi.fn(),
  listInstalled: vi.fn(),
}));

const mockPluginLifecycleManager = vi.hoisted(() => ({
  unload: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  upgrade: vi.fn(),
}));

const mockPublishGlobalLiveEvent = vi.hoisted(() => vi.fn());

vi.mock("../services/plugin-registry.js", () => ({
  pluginRegistryService: () => mockPluginRegistryService,
}));

vi.mock("../services/plugin-lifecycle.js", () => ({
  pluginLifecycleManager: () => mockPluginLifecycleManager,
}));

vi.mock("../services/live-events.js", () => ({
  publishGlobalLiveEvent: mockPublishGlobalLiveEvent,
}));

function createApp() {
  return new Elysia({ prefix: "/api" })
    .derive(() => ({
      actor: {
        type: "board",
        source: "local_implicit",
        userId: "user-1",
      },
    }))
    .use(
      pluginRoutes({
        db: {} as any,
        jobScheduler: {} as any,
        jobStore: {} as any,
        workerManager: {} as any,
        streamBus: {} as any,
        toolDispatcher: null as any,
      }),
    );
}

describe("DELETE /api/plugins/:pluginId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPluginLifecycleManager.unload.mockResolvedValue(undefined);
  });

  it("uninstalls a plugin through the DELETE alias", async () => {
    const app = createApp();

    const res = await app.handle(
      new Request("http://localhost/api/plugins/plugin-1", {
        method: "DELETE",
      }),
    );

    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockPluginLifecycleManager.unload).toHaveBeenCalledWith("plugin-1", false);
    expect(mockPublishGlobalLiveEvent).toHaveBeenCalledWith({
      type: "plugin.ui.updated",
      payload: { pluginId: "plugin-1" },
    });
  });

  it("supports purge through the DELETE alias", async () => {
    const app = createApp();

    const res = await app.handle(
      new Request("http://localhost/api/plugins/plugin-1?purge=true", {
        method: "DELETE",
      }),
    );

    expect(res.status).toBe(200);
    expect(mockPluginLifecycleManager.unload).toHaveBeenCalledWith("plugin-1", true);
  });
});
