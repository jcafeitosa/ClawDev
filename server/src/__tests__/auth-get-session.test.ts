import { describe, expect, it } from "vitest";
import { buildAuthGetSessionResponse } from "../elysia-app.js";

describe("buildAuthGetSessionResponse", () => {
  it("returns the Paperclip-compatible session payload for the implicit local board actor", async () => {
    const response = buildAuthGetSessionResponse({
      type: "board",
      userId: "local-board",
      source: "local_implicit",
      isInstanceAdmin: true,
    } as any);

    expect(response).toBeInstanceOf(Response);
    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toContain("application/json");
    await expect(response?.json()).resolves.toEqual({
      session: {
        id: "paperclip:local_implicit:local-board",
        userId: "local-board",
      },
      user: {
        id: "local-board",
        email: null,
        name: "Local Board",
      },
    });
  });

  it("returns null for non-board actors", () => {
    expect(
      buildAuthGetSessionResponse({
        type: "agent",
        agentId: "agent-1",
        companyId: "company-1",
        source: "agent_key",
      } as any),
    ).toBeNull();
  });
});
