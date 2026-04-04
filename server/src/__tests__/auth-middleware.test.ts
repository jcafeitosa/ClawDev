import { describe, expect, it } from "vitest";
import { createActorResolver } from "../middleware/auth.js";

function buildRequest(headers: Record<string, string>) {
  return { request: new Request("http://localhost/api/health", { headers }) };
}

describe("auth middleware", () => {
  it("accepts both Paperclip and ClawDev run-id headers", async () => {
    const resolver = createActorResolver({} as any, { deploymentMode: "local_trusted" });

    const paperclip = await resolver(
      buildRequest({
        "x-paperclip-run-id": "paperclip-run",
      }) as any,
    );
    expect(paperclip.actor.runId).toBe("paperclip-run");

    const clawdev = await resolver(
      buildRequest({
        "x-clawdev-run-id": "clawdev-run",
      }) as any,
    );
    expect(clawdev.actor.runId).toBe("clawdev-run");
  });
});
