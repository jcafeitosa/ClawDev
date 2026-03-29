import { test, expect } from "@playwright/test";

test.describe("Agents API", () => {
  test("GET /api/agents/:id returns 404 for missing agent", async ({ request }) => {
    const response = await request.get("/api/agents/00000000-0000-0000-0000-000000000000");
    expect(response.status()).toBe(404);
  });
});
