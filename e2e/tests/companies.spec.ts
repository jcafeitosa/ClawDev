import { test, expect } from "@playwright/test";

test.describe("Companies API", () => {
  test("GET /api/companies returns array", async ({ request }) => {
    const response = await request.get("/api/companies");
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });
});

test.describe("Companies UI", () => {
  test("dashboard loads", async ({ page }) => {
    await page.goto("/");
    // Should redirect to or show the main dashboard
    await expect(page).toHaveURL(/\//);
    // Wait for the page to be interactive
    await page.waitForLoadState("networkidle");
  });
});
