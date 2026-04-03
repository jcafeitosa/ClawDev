import { test, expect } from "@playwright/test";
import { collectBrowserDiagnostics, ensureCompany } from "./helpers";

test("dashboard opens without browser errors", async ({ page }) => {
  const diagnostics = collectBrowserDiagnostics(page);

  const { company, prefix } = await ensureCompany(page);

  await page.goto(`/${prefix}/dashboard`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  expect(diagnostics.pageErrors, diagnostics.pageErrors.join("\n")).toEqual([]);
  expect(diagnostics.requestFailures, diagnostics.requestFailures.join("\n")).toEqual([]);
  expect(diagnostics.consoleErrors, diagnostics.consoleErrors.join("\n")).toEqual([]);
});

test("dashboard recovers from a stale selected company id", async ({ page }) => {
  const diagnostics = collectBrowserDiagnostics(page);

  const { company, prefix } = await ensureCompany(page);

  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("clawdev.selectedCompanyId", "00000000-0000-4000-8000-000000000000");
  });

  await page.goto(`/${prefix}/dashboard`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  expect(diagnostics.pageErrors, diagnostics.pageErrors.join("\n")).toEqual([]);
  expect(diagnostics.requestFailures, diagnostics.requestFailures.join("\n")).toEqual([]);
  expect(diagnostics.consoleErrors, diagnostics.consoleErrors.join("\n")).toEqual([]);

  const recoveredCompanyId = await page.evaluate(() => localStorage.getItem("clawdev.selectedCompanyId"));
  expect(recoveredCompanyId).toBe(company.id);
});
