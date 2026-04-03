import { expect, test } from "@playwright/test";
import { collectBrowserDiagnostics, ensureCompany } from "./helpers";

async function visitAndSmoke(page: Parameters<typeof test>[0]["page"], url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(750);
}

async function clickFirstNavigableLink(page: Parameters<typeof test>[0]["page"]) {
  const candidates = page
    .locator('main a[href]:not([href^="mailto:"]):not([href^="tel:"])')
    .filter({ hasNot: page.locator("button") });
  const count = await candidates.count();

  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    if (await candidate.isVisible().catch(() => false)) {
      const href = await candidate.getAttribute("href");
      if (!href || href.startsWith("#")) continue;
      await candidate.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);
      return true;
    }
  }

  return false;
}

test("deep navigation smoke covers the major interactive surfaces", async ({ page }) => {
  const { prefix } = await ensureCompany(page);
  const errors = collectBrowserDiagnostics(page);

  const routes = [
    `/${prefix}/dashboard`,
    `/${prefix}/activity`,
    `/${prefix}/agents`,
    `/${prefix}/issues`,
    `/${prefix}/projects`,
    `/${prefix}/routines`,
    `/${prefix}/runs`,
    `/${prefix}/workspaces`,
    `/${prefix}/plugins`,
    `/${prefix}/approvals`,
    `/${prefix}/inbox`,
    `/${prefix}/costs`,
    `/${prefix}/budgets`,
    `/${prefix}/labels`,
    `/${prefix}/providers`,
    `/${prefix}/skills`,
    `/${prefix}/secrets`,
    `/${prefix}/org`,
    `/${prefix}/org/chart`,
    `/${prefix}/settings`,
    `/settings/general`,
    `/settings/experimental`,
    `/settings/users`,
    `/settings/api-keys`,
    `/settings/status`,
    `/companies`,
    `/setup`,
    `/onboarding`,
    `/invite`,
    `/claim`,
    `/cli-auth`,
  ];

  for (const route of routes) {
    await visitAndSmoke(page, route);
    await clickFirstNavigableLink(page);
  }

  expect(errors.pageErrors, errors.pageErrors.join("\n")).toEqual([]);
  expect(errors.requestFailures, errors.requestFailures.join("\n")).toEqual([]);
  expect(errors.notFoundResponses, errors.notFoundResponses.join("\n")).toEqual([]);
  expect(
    errors.consoleErrors,
    errors.consoleErrors.join("\n"),
  ).toEqual([]);
});
