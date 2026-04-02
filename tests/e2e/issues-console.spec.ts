import { expect, test } from "@playwright/test";
import { ensureCompany } from "./helpers";

test("issues page and issue detail open without browser errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requestFailures: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (failure !== "net::ERR_ABORTED") {
      requestFailures.push(`${request.method()} ${request.url()} ${failure}`);
    }
  });

  const { prefix } = await ensureCompany(page);

  await page.goto(`/${prefix}/issues`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  const issueLinks = page.locator('a[href*="/issues/"]');
  await expect(issueLinks.first()).toBeVisible();
  await issueLinks.first().click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  const currentPath = new URL(page.url()).pathname;
  const relatedIssueHref = await page.evaluate((currentPathParam) => {
    const links = Array.from(document.querySelectorAll('a[href*="/issues/"]')) as HTMLAnchorElement[];
    const match = links
      .map((link) => link.href)
      .find((href) => {
        const path = new URL(href).pathname;
        return path !== currentPathParam && !path.endsWith("/issues");
      });
    return match ?? null;
  }, currentPath);

  if (relatedIssueHref) {
    const relatedPath = new URL(relatedIssueHref).pathname;
    await page.locator(`a[href="${relatedPath}"]`).first().click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
  }

  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  expect(requestFailures, requestFailures.join("\n")).toEqual([]);
  expect(consoleErrors.filter((text) => !text.includes("SES Removing unpermitted intrinsics"))).toEqual([]);
});
