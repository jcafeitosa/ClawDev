import { expect, test } from "@playwright/test";
import { ensureCompany } from "./helpers";

async function collectBrowserErrors(page: Parameters<typeof test>[0]["page"]) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requestFailures: string[] = [];
  const notFoundResponses: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (
        !text.includes("SES Removing unpermitted intrinsics") &&
        !text.includes("[vite] failed to connect to websocket") &&
        !text.includes("WebSocket connection to 'ws://127.0.0.1:")
      ) {
        consoleErrors.push(text);
      }
    }
  });
  page.on("pageerror", (error) => {
    const message = error.message;
    if (message.includes("SES Removing unpermitted intrinsics")) return;
    if (message.includes("WebSocket closed without opened.")) return;
    pageErrors.push(message);
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (failure !== "net::ERR_ABORTED") {
      requestFailures.push(`${request.method()} ${request.url()} ${failure}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() === 404) {
      notFoundResponses.push(`${response.request().method()} ${response.url()}`);
    }
  });

  return { consoleErrors, pageErrors, requestFailures, notFoundResponses };
}

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
  const errors = await collectBrowserErrors(page);

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
