#!/usr/bin/env node
import { chromium, expect } from "@playwright/test";

const base = process.env.CLAWDEV_BASE_URL ?? "http://127.0.0.1:3100";
const endpointURL = process.env.CHROME_DEBUG_URL ?? "http://127.0.0.1:9222";

const browser = await chromium.connectOverCDP(endpointURL);
const context = browser.contexts()[0] ?? (await browser.newContext());
const page = context.pages()[0] ?? (await context.newPage());

const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];
const notFoundResponses = [];

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
    notFoundResponses.push(response.url());
  }
});

const companyRes = await page.request.get(`${base}/api/companies`);
const companies = await companyRes.json();
const company = Array.isArray(companies) ? companies[0] : null;
if (!company) throw new Error("No company available for interaction smoke");

const prefix = company.slug ?? company.issuePrefix ?? company.id;

await page.goto(`${base}/${prefix}/dashboard`);
await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 15_000 });
await page.getByRole("button", { name: "New Issue" }).click();
await expect(page.getByRole("dialog", { name: "Create new issue" })).toBeVisible({ timeout: 10_000 });
await page.getByRole("button", { name: "Cancel" }).click();
await expect(page.getByRole("dialog", { name: "Create new issue" })).toHaveCount(0);

await page.goto(`${base}/${prefix}/agents/ceo`);
await expect(page.getByRole("heading", { name: /CEO/i }).first()).toBeVisible({ timeout: 10_000 });
await expect(page.getByRole("button", { name: "Assign Task" })).toBeVisible({ timeout: 10_000 });
await page.getByRole("button", { name: "Assign Task" }).click();
await expect(page.getByRole("dialog", { name: "Create new issue" })).toBeVisible({ timeout: 10_000 });
await page.getByRole("button", { name: "Cancel" }).click();

await page.goto(`${base}/${prefix}/inbox`);
await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible({ timeout: 10_000 });

await page.goto(`${base}/${prefix}/dashboard`);
await page.getByRole("button", { name: /Search \(Ctrl\+K\)/ }).click();
await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible({ timeout: 10_000 });
await page.getByRole("button", { name: "Close" }).click();

await page.goto(`${base}/${prefix}/runs`);
await page.waitForLoadState("networkidle").catch(() => {});

const result = { base, prefix, pageErrors, requestFailures, consoleErrors, notFoundResponses };
console.log(JSON.stringify(result, null, 2));

if (pageErrors.length || requestFailures.length || consoleErrors.length) {
  process.exitCode = 1;
}

await browser.close();
