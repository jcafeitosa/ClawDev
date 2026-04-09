import { describe, expect, it, vi } from "vitest";
import { buildPluginDetailResponse } from "../elysia-app.js";

vi.mock("../routes/plugins.js", () => ({
  pluginRoutes: () => ({}) as never,
}));

vi.mock("../services/plugin-registry.js", () => ({
  pluginRegistryService: () => ({
    getById: vi.fn().mockResolvedValue(null),
    getByKey: vi.fn().mockResolvedValue(null),
  }),
}));

describe("elysia plugin detail route", () => {
  it("returns Plugin not found for unknown plugin ids", async () => {
    const set: { status?: number } = {};
    const response = await buildPluginDetailResponse(
      {
        getById: vi.fn().mockResolvedValue(null),
        getByKey: vi.fn().mockResolvedValue(null),
      } as any,
      { getWorker: vi.fn(() => null) } as any,
      "abc",
      {
        type: "board",
        userId: "local-board",
        companyIds: ["company-1"],
        source: "local_implicit",
      } as any,
      set,
    );

    expect(set.status).toBe(404);
    expect(response).toEqual({ error: "Plugin not found" });
  });
});
