import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pluginRoutes } from "../routes/plugins.js";

const mockRegistry = vi.hoisted(() => ({
  listInstalled: vi.fn(),
  listByStatus: vi.fn(),
  getById: vi.fn(),
  getByKey: vi.fn(),
}));

const mockLifecycle = vi.hoisted(() => ({}));
const mockMetadata = vi.hoisted(() => vi.fn((manifest: Record<string, unknown>) => manifest.ui?.metadata ?? null));

vi.mock("../services/plugin-registry.js", () => ({
  pluginRegistryService: () => mockRegistry,
}));

vi.mock("../services/plugin-lifecycle.js", () => ({
  pluginLifecycleManager: () => mockLifecycle,
}));

vi.mock("../services/plugin-loader.js", () => ({
  getPluginUiContributionMetadata: mockMetadata,
  pluginLoader: {},
}));

vi.mock("../services/activity-log.js", () => ({
  logActivity: vi.fn(),
}));

vi.mock("../services/live-events.js", () => ({
  publishGlobalLiveEvent: vi.fn(),
}));

vi.mock("../services/plugin-config-validator.js", () => ({
  validateInstanceConfig: vi.fn(),
}));

function createApp() {
  return new Elysia({ prefix: "/api" })
    .derive(() => ({
      actor: {
        type: "board",
        userId: "board-user",
        companyIds: ["company-1"],
        source: "local_implicit",
      },
    }))
    .use(
      pluginRoutes({
        db: {} as any,
        jobScheduler: {} as any,
        jobStore: {} as any,
        workerManager: {} as any,
        streamBus: {} as any,
        toolDispatcher: {
          listToolsForAgent: vi.fn(() => []),
          executeTool: vi.fn(),
        } as any,
      }),
    );
}

async function req(app: Elysia, method: string, path: string, body?: unknown) {
  const init: RequestInit = { method, headers: {} };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["content-type"] = "application/json";
  }
  const res = await app.handle(new Request(`http://localhost${path}`, init));
  const text = await res.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    // keep plain text
  }
  return { status: res.status, body: json, text };
}

describe("plugin routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistry.listInstalled.mockResolvedValue([
      {
        id: "plugin-1",
        name: "Example Plugin",
        version: "1.0.0",
        enabled: true,
        description: "Example",
      },
    ]);
    mockRegistry.listByStatus.mockResolvedValue([
      {
        id: "plugin-1",
        pluginKey: "example.plugin",
        version: "1.0.0",
        updatedAt: new Date("2026-03-19T00:00:00.000Z"),
        manifestJson: {
          displayName: "Example Plugin",
          ui: {
            metadata: {
              uiEntryFile: "ui.tsx",
              slots: ["dashboard"],
              launchers: [],
            },
          },
        },
      },
    ]);
  });

  it("covers the plugin listing and example endpoints used by the frontend", async () => {
    const app = createApp();

    const pluginsRes = await req(app, "GET", "/api/plugins");
    expect(pluginsRes.status).toBe(200);
    expect(pluginsRes.body).toEqual([
      expect.objectContaining({
        id: "plugin-1",
        name: "Example Plugin",
        enabled: true,
      }),
    ]);

    const examplesRes = await req(app, "GET", "/api/plugins/examples");
    expect(examplesRes.status).toBe(200);
    expect(Array.isArray(examplesRes.body)).toBe(true);
    expect((examplesRes.body as Array<Record<string, unknown>>).length).toBeGreaterThan(0);

    const contributionsRes = await req(app, "GET", "/api/plugins/ui-contributions");
    expect(contributionsRes.status).toBe(200);
    expect(contributionsRes.body).toEqual([
      expect.objectContaining({
        pluginId: "plugin-1",
        pluginKey: "example.plugin",
        uiEntryFile: "ui.tsx",
      }),
    ]);
  });
});
