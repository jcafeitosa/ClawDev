import { expect, test } from "@playwright/test";
import { collectBrowserDiagnostics, ensureCompany } from "./helpers";

test.describe.configure({ mode: "serial" });

async function resetCompanies(page: Parameters<typeof test>[0]["page"]) {
  const companiesRes = await page.request.get("/api/companies");
  expect(companiesRes.ok()).toBe(true);
  const companies = (await companiesRes.json()) as Array<{ id: string }>;

  for (const company of companies) {
    const delRes = await page.request.delete(`/api/companies/${company.id}`);
    expect(delRes.ok()).toBe(true);
  }
}

test("retrying a failed inbox run does not emit model auto for claude_local", async ({ page }) => {
  await resetCompanies(page);
  const { company, prefix } = await ensureCompany(page);
  const diagnostics = collectBrowserDiagnostics(page);

  const agentCreateRes = await page.request.post(`/api/companies/${company.id}/agents`, {
    data: {
      name: "Inbox Retry Agent",
      role: "engineer",
      adapterType: "claude_local",
      adapterConfig: {
        command: "claude-does-not-exist",
      },
    },
  });
  expect(agentCreateRes.ok()).toBe(true);
  const agent = (await agentCreateRes.json()) as { id: string };

  const wakeupRes = await page.request.post(`/api/agents/${agent.id}/wakeup`, {
    data: {
      source: "on_demand",
      triggerDetail: "manual",
      reason: "seed failed run",
    },
  });
  expect(wakeupRes.ok()).toBe(true);

  const deadline = Date.now() + 30_000;
  let failedRun: { id: string; agentId: string } | null = null;
  while (Date.now() < deadline) {
    const runsRes = await page.request.get(`/api/companies/${company.id}/heartbeat-runs?limit=20`);
    expect(runsRes.ok()).toBe(true);
    const runs = (await runsRes.json()) as Array<{ id: string; agentId: string; status: string }>;
    failedRun = runs.find((run) => run.agentId === agent.id && (run.status === "failed" || run.status === "timed_out")) ?? null;
    if (failedRun) break;
    await page.waitForTimeout(500);
  }
  expect(failedRun).not.toBeNull();

  await page.goto(`/${prefix}/inbox`);

  await expect(page.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Failed run/i }).first()).toBeVisible();

  const retryButton = page.getByRole("button", { name: "Retry" }).first();
  await expect(retryButton).toBeVisible();
  await retryButton.click();

  await expect(page).toHaveURL(/\/runs\//, { timeout: 20_000 });
  await expect(page.locator("body")).not.toContainText("--model auto", {
    timeout: 20_000,
  });

  expect(diagnostics.pageErrors, diagnostics.pageErrors.join("\n")).toEqual([]);
  expect(diagnostics.consoleErrors, diagnostics.consoleErrors.join("\n")).toEqual([]);
});
