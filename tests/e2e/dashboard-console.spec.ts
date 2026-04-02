import { test, expect } from "@playwright/test";
import { ensureCompany } from "./helpers";

test("dashboard opens without browser errors", async ({ page }) => {
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

  const { company, prefix } = await ensureCompany(page);

  await page.goto(`/${prefix}/dashboard`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  expect(requestFailures, requestFailures.join("\n")).toEqual([]);
  expect(consoleErrors.filter((text) => !text.includes("SES Removing unpermitted intrinsics"))).toEqual([]);
});

test("dashboard recovers from a stale selected company id", async ({ page }) => {
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

  const { company, prefix } = await ensureCompany(page);

  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("clawdev.selectedCompanyId", "00000000-0000-4000-8000-000000000000");
  });

  await page.goto(`/${prefix}/dashboard`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  expect(requestFailures, requestFailures.join("\n")).toEqual([]);
  expect(consoleErrors.filter((text) => !text.includes("SES Removing unpermitted intrinsics"))).toEqual([]);

  const recoveredCompanyId = await page.evaluate(() => localStorage.getItem("clawdev.selectedCompanyId"));
  expect(recoveredCompanyId).toBe(company.id);
});
