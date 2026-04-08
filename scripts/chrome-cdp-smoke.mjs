#!/usr/bin/env node
import { chromium } from "@playwright/test";
import process from "process";

const base = process.env.CLAWDEV_BASE_URL ?? "http://127.0.0.1:3100";
const port = Number(process.env.CHROME_DEBUG_PORT ?? 9222);
const endpointURL = `http://127.0.0.1:${port}`;

const browser = await chromium.connectOverCDP(endpointURL);
const context = browser.contexts()[0] ?? (await browser.newContext());
const page = context.pages()[0] ?? (await context.newPage());

const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];

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

const companiesRes = await page.request.get(`${base}/api/companies`);
if (!companiesRes.ok()) {
  throw new Error(`Failed to list companies: ${companiesRes.status()}`);
}

const companies = await companiesRes.json();
const company = Array.isArray(companies) ? companies[0] : companies?.[0];
if (!company) {
  throw new Error("No company found");
}

const prefix = company.slug ?? company.urlKey ?? company.id;
const routes = [
  `/${prefix}/dashboard`,
  `/${prefix}/inbox`,
  `/${prefix}/agents`,
  `/${prefix}/providers`,
  `/${prefix}/projects`,
  `/${prefix}/issues`,
  `/${prefix}/runs`,
  `/${prefix}/settings`,
];

for (const route of routes) {
  await page.goto(`${base}${route}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);
}

const result = {
  base,
  endpointURL,
  prefix,
  pageErrors,
  requestFailures,
  consoleErrors,
};

console.log(JSON.stringify(result, null, 2));

if (pageErrors.length || requestFailures.length || consoleErrors.length) {
  process.exitCode = 1;
}

await browser.close();
