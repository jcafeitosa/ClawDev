#!/usr/bin/env node
import { chromium } from "@playwright/test";

const base = process.env.CLAWDEV_BASE_URL ?? "http://127.0.0.1:3100";
const endpointURL = process.env.CHROME_DEBUG_URL ?? "http://127.0.0.1:9222";

const browser = await chromium.connectOverCDP(endpointURL);
const context = browser.contexts()[0] ?? (await browser.newContext());
const page = context.pages()[0] ?? (await context.newPage());

const consoleErrors = [];
const pageErrors = [];

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

const COMPANY_NAME = `Codex Browser ${Date.now()}`;
const AGENT_NAME = "CEO";
const TASK_TITLE = "Codex browser setup task";

await page.goto(`${base}/setup`);
await page.locator('input[placeholder="Acme Corp"]').fill(COMPANY_NAME);
await page.getByRole("button", { name: "Next" }).click();

await page.locator('input[placeholder="CEO"]').fill(AGENT_NAME);
await page.getByRole("button", { name: "Codex (Local)" }).click();
await page.getByRole("button", { name: "Next" }).click();

await page.locator('input[placeholder="Set up the project repository"]').fill(TASK_TITLE);
await page.getByRole("button", { name: "Next" }).click();

await page.getByRole("button", { name: "Go to Dashboard" }).click();
await page.waitForURL(/\/dashboard$/, { timeout: 15_000 });

const baseUrl = page.url().split("/").slice(0, 3).join("/");
const companiesRes = await page.request.get(`${baseUrl}/api/companies`);
const companies = await companiesRes.json();
const company = Array.isArray(companies) ? companies.find((c) => c.name === COMPANY_NAME) : null;
if (!company) throw new Error(`Company not found after setup: ${COMPANY_NAME}`);

const agentsRes = await page.request.get(`${baseUrl}/api/companies/${company.id}/agents`);
const agents = await agentsRes.json();
const ceo = Array.isArray(agents) ? agents.find((a) => a.name === AGENT_NAME) : null;
if (!ceo) throw new Error("CEO agent not found after setup");
if (ceo.adapterType !== "codex_local") {
  throw new Error(`Expected codex_local adapter, got ${ceo.adapterType ?? "missing"}`);
}

const issuesRes = await page.request.get(`${baseUrl}/api/companies/${company.id}/issues`);
const issues = await issuesRes.json();
const task = Array.isArray(issues) ? issues.find((i) => i.title === TASK_TITLE) : null;
if (!task) throw new Error("Task not found after setup");
if (task.assigneeAgentId !== ceo.id) {
  throw new Error(`Expected task to be assigned to CEO ${ceo.id}, got ${task.assigneeAgentId ?? "missing"}`);
}

console.log(JSON.stringify({
  companyId: company.id,
  companyName: COMPANY_NAME,
  companyPrefix: company.slug ?? company.issuePrefix ?? company.id,
  agentId: ceo.id,
  adapterType: ceo.adapterType,
  taskId: task.id,
  pageErrors,
  consoleErrors,
}, null, 2));

if (pageErrors.length || consoleErrors.length) {
  process.exitCode = 1;
}

await browser.close();
