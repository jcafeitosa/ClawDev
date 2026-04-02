import { expect, test } from "@playwright/test";

/**
 * E2E: Onboarding wizard flow (skip_llm mode).
 *
 * Uses the shared Playwright webServer, but clears existing companies first so
 * the onboarding UI is exercised from a clean state.
 */

const SKIP_LLM = process.env.CLAWDEV_E2E_SKIP_LLM !== "false";

const COMPANY_NAME = `E2E-Test-${Date.now()}`;
const AGENT_NAME = "CEO";
const TASK_TITLE = "E2E test task";

async function resetCompanies(page: Parameters<typeof test>[0]["page"]) {
  const companiesRes = await page.request.get("/api/companies");
  expect(companiesRes.ok()).toBe(true);
  const companies = (await companiesRes.json()) as Array<{ id: string }>;

  for (const company of companies) {
    const delRes = await page.request.delete(`/api/companies/${company.id}`);
    expect(delRes.ok()).toBe(true);
  }
}

test.describe.configure({ mode: "serial" });

test.describe("Onboarding wizard", () => {
  test("completes full wizard flow", async ({ page }) => {
    await resetCompanies(page);

    await page.goto("/setup");

    await expect(page.locator("h3", { hasText: "Name your company" })).toBeVisible({
      timeout: 15_000,
    });

    await page.locator('input[placeholder="Acme Corp"]').fill(COMPANY_NAME);
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.locator("h3", { hasText: "Create your first agent" })).toBeVisible({
      timeout: 10_000,
    });

    await page.locator('input[placeholder="CEO"]').fill(AGENT_NAME);
    await expect(page.getByRole("button", { name: "Claude (Local)" }).locator("..")).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.locator("h3", { hasText: "Create your first task" })).toBeVisible({
      timeout: 10_000,
    });

    await page.locator('input[placeholder="Set up the project repository"]').fill(TASK_TITLE);
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.locator("h3", { hasText: "Your company is ready!" })).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.getByText(COMPANY_NAME, { exact: true })).toBeVisible();
    await expect(page.getByText(AGENT_NAME, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Go to Dashboard" }).click();

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10_000 });

    const baseUrl = page.url().split("/").slice(0, 3).join("/");

    const companiesRes = await page.request.get(`${baseUrl}/api/companies`);
    expect(companiesRes.ok()).toBe(true);
    const companies = (await companiesRes.json()) as Array<{ id: string; name: string }>;
    const company = companies.find((c) => c.name === COMPANY_NAME);
    expect(company).toBeTruthy();

    const agentsRes = await page.request.get(`${baseUrl}/api/companies/${company!.id}/agents`);
    expect(agentsRes.ok()).toBe(true);
    const agents = await agentsRes.json();
    const ceoAgent = agents.find((a: { name: string }) => a.name === AGENT_NAME);
    expect(ceoAgent).toBeTruthy();
    expect(ceoAgent.role).toBe("ceo");
    expect(ceoAgent.adapterType).not.toBe("process");

    const instructionsBundleRes = await page.request.get(
      `${baseUrl}/api/agents/${ceoAgent.id}/instructions-bundle?companyId=${company!.id}`,
    );
    expect(instructionsBundleRes.ok()).toBe(true);
    const instructionsBundle = await instructionsBundleRes.json();
    expect(
      instructionsBundle.files.map((file: { path: string }) => file.path).sort(),
    ).toEqual(["AGENTS.md", "HEARTBEAT.md", "SOUL.md", "TOOLS.md"]);

    const issuesRes = await page.request.get(`${baseUrl}/api/companies/${company!.id}/issues`);
    expect(issuesRes.ok()).toBe(true);
    const issues = await issuesRes.json();
    const task = issues.find((i: { title: string }) => i.title === TASK_TITLE);
    expect(task).toBeTruthy();
    expect(task.assigneeAgentId).toBe(ceoAgent.id);
    expect(task.description ?? "").not.toContain("github.com/jcafeitosa/companies");

    if (!SKIP_LLM) {
      await expect(async () => {
        const res = await page.request.get(`${baseUrl}/api/issues/${task.id}`);
        const issue = await res.json();
        expect(["in_progress", "done"]).toContain(issue.status);
      }).toPass({ timeout: 120_000, intervals: [5_000] });
    }
  });
});
