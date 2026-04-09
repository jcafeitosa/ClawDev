import { describe, expect, it } from "vitest";
import { readSessionModelPin } from "../services/heartbeat.js";

describe("heartbeat session model pin", () => {
  it("reads pinned model state when present", () => {
    const pin = readSessionModelPin({
      sessionModelPin: {
        adapterType: "claude_local",
        modelId: "claude-sonnet-4-6",
        pinnedAt: "2026-04-08T00:00:00.000Z",
        authProfileKey: "profile-123",
        source: "session",
      },
    });

    expect(pin).toEqual({
      adapterType: "claude_local",
      modelId: "claude-sonnet-4-6",
      pinnedAt: "2026-04-08T00:00:00.000Z",
      authProfileKey: "profile-123",
      source: "session",
    });
  });

  it("returns null for incomplete pin state", () => {
    expect(
      readSessionModelPin({
        sessionModelPin: {
          adapterType: "claude_local",
        },
      }),
    ).toBeNull();
  });
});
