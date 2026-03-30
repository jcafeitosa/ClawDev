import { describe, it, expect } from "vitest";
import { Elysia } from "elysia";
import { healthRoutes } from "../routes/health.js";
import { serverVersion } from "../version.js";

describe("GET /health", () => {
  const app = new Elysia({ prefix: "/health" }).use(healthRoutes());

  it("returns 200 with status ok", async () => {
    const res = await app.handle(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", version: serverVersion });
  });
});
