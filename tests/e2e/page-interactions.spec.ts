import { expect, test, type Locator, type Page } from "@playwright/test";
import { ensureCompany } from "./helpers";

const DESCTRUCTIVE_RE = /(delete|remove|destroy|archive|clear|reset|wipe|hard stop|pause company|delete company|sign out|logout|danger|disable)/i;
const SAFE_ACTION_RE = /(back|next|retry|refresh|edit|view|open|close|show|hide|copy|save|new|add|apply|filter|toggle|expand|collapse|settings|run|resume|pause|select|tab)/i;

type BrowserDiagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: string[];
};

function collectBrowserDiagnostics(page: Page): BrowserDiagnostics {
  const diagnostics: BrowserDiagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
  };

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (
        !text.includes("SES Removing unpermitted intrinsics") &&
        !text.includes("[vite] failed to connect to websocket") &&
        !text.includes("WebSocket connection to 'ws://127.0.0.1:")
      ) {
        diagnostics.consoleErrors.push(text);
      }
    }
  });
  page.on("pageerror", (error) => {
    const message = error.message;
    if (message.includes("SES Removing unpermitted intrinsics")) return;
    if (message.includes("WebSocket closed without opened.")) return;
    diagnostics.pageErrors.push(message);
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (failure !== "net::ERR_ABORTED") {
      diagnostics.requestFailures.push(`${request.method()} ${request.url()} ${failure}`);
    }
  });

  return diagnostics;
}

async function waitForStable(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(500);
}

async function visibleControls(page: Page) {
  const locators = [
    page.locator('main [role="tab"]'),
    page.locator('main [role="switch"]'),
    page.locator('main [role="checkbox"]'),
    page.locator('main button'),
    page.locator('main a[href]'),
    page.locator('main select'),
  ];

  const controls: Array<{ locator: Locator; label: string; kind: string }> = [];
  for (const locator of locators) {
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      const item = locator.nth(index);
      if (!(await item.isVisible().catch(() => false))) continue;
      const kind = (await item.getAttribute("role")) ?? (await item.evaluate((el) => el.tagName.toLowerCase()).catch(() => "unknown"));
      const label = await item
        .evaluate((el) => {
          const aria = el.getAttribute("aria-label")?.trim();
          const title = el.getAttribute("title")?.trim();
          const text = (el.textContent ?? "").trim().replace(/\s+/g, " ");
          const href = el.getAttribute("href")?.trim();
          return aria || title || text || href || "";
        })
        .catch(() => "");
      controls.push({ locator: item, label, kind });
    }
  }

  return controls;
}

async function interactWithPage(page: Page) {
  const controls = await visibleControls(page);
  const clicked: string[] = [];

  for (const control of controls.slice(0, 12)) {
    if (!control.label) continue;
    if (DESCTRUCTIVE_RE.test(control.label)) continue;

    const isClickable =
      control.kind === "tab" ||
      control.kind === "switch" ||
      control.kind === "checkbox" ||
      control.kind === "button" ||
      control.kind === "a" ||
      control.kind === "select";

    if (!isClickable) continue;
    if (control.kind !== "select" && !SAFE_ACTION_RE.test(control.label) && control.kind !== "tab" && control.kind !== "switch" && control.kind !== "checkbox") {
      continue;
    }

    try {
      if (control.kind === "select") {
        const optionValues = await control.locator.locator("option").evaluateAll((options) =>
          options
            .map((option) => ({
              value: (option as HTMLOptionElement).value,
              label: (option.textContent ?? "").trim(),
              disabled: (option as HTMLOptionElement).disabled,
            }))
            .filter((option) => !option.disabled && option.value),
        );

        if (optionValues.length < 2) continue;
        const currentValue = await control.locator.inputValue().catch(() => "");
        const target = optionValues.find((option) => option.value !== currentValue) ?? optionValues[0];
        if (!target?.value || target.value === currentValue) continue;
        await control.locator.selectOption(target.value);
        clicked.push(`${control.kind}:${control.label}=>${target.label || target.value}`);
        await waitForStable(page);
        continue;
      }

      await control.locator.click({ timeout: 2000 });
      clicked.push(`${control.kind}:${control.label}`);
      await waitForStable(page);
    } catch {
      // Ignore best-effort interactions; the diagnostics below will still catch actual page/runtime errors.
    }
  }

  return clicked;
}

async function seedDetailData(page: Page, companyId: string) {
  const agentsRes = await page.request.get(`/api/companies/${companyId}/agents`);
  expect(agentsRes.ok()).toBe(true);
  let agents = (await agentsRes.json()) as Array<{ id: string; name?: string; role?: string }>;
  let agent = agents.find((item) => item.role === "ceo") ?? agents[0] ?? null;

  if (!agent) {
    const createAgentRes = await page.request.post(`/api/companies/${companyId}/agents`, {
      data: {
        name: `E2E Agent ${Date.now()}`,
        role: "engineer",
        adapterType: "claude_local",
      },
    });
    expect(createAgentRes.ok()).toBe(true);
    agent = (await createAgentRes.json()) as { id: string; name?: string; role?: string };
  }

  const issuesRes = await page.request.get(`/api/companies/${companyId}/issues`);
  expect(issuesRes.ok()).toBe(true);
  let issues = (await issuesRes.json()) as Array<{ id: string; title?: string }>;
  let issue = issues[0] ?? null;

  if (!issue) {
    const createIssueRes = await page.request.post(`/api/companies/${companyId}/issues`, {
      data: {
        title: `E2E Issue ${Date.now()}`,
        description: "Created for interactive smoke coverage.",
        assigneeAgentId: agent.id,
      },
    });
    expect(createIssueRes.ok()).toBe(true);
    issue = (await createIssueRes.json()) as { id: string; title?: string };
  }

  const runsRes = await page.request.get(`/api/companies/${companyId}/heartbeat-runs?limit=20`);
  expect(runsRes.ok()).toBe(true);
  const runs = (await runsRes.json()) as Array<{ id: string; agentId?: string; status?: string }>;
  let run = runs.find((item) => item.agentId === agent.id) ?? runs[0] ?? null;

  if (!run) {
    const tempAgentRes = await page.request.post(`/api/companies/${companyId}/agents`, {
      data: {
        name: `E2E Failed Run ${Date.now()}`,
        role: "engineer",
        adapterType: "claude_local",
        adapterConfig: {
          command: "claude-does-not-exist",
        },
      },
    });
    expect(tempAgentRes.ok()).toBe(true);
    const tempAgent = (await tempAgentRes.json()) as { id: string };

    const wakeupRes = await page.request.post(`/api/agents/${tempAgent.id}/wakeup`, {
      data: {
        source: "on_demand",
        triggerDetail: "interactive smoke",
        reason: "seed failed run",
      },
    });
    expect(wakeupRes.ok()).toBe(true);

    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const latestRunsRes = await page.request.get(`/api/companies/${companyId}/heartbeat-runs?limit=20`);
      expect(latestRunsRes.ok()).toBe(true);
      const latestRuns = (await latestRunsRes.json()) as Array<{ id: string; agentId?: string; status?: string }>;
      const failed = latestRuns.find((item) => item.agentId === tempAgent.id && (item.status === "failed" || item.status === "timed_out"));
      if (failed) {
        run = failed;
        break;
      }
      await page.waitForTimeout(500);
    }
  }

  return { agent, issue, run };
}

const routeSpecs = [
  { path: (prefix: string) => `/${prefix}/dashboard`, mode: "generic" as const },
  { path: (prefix: string) => `/${prefix}/inbox`, mode: "generic" as const },
  { path: (prefix: string) => `/${prefix}/agents`, mode: "generic" as const },
  { path: (prefix: string) => `/${prefix}/issues`, mode: "generic" as const },
  { path: (prefix: string) => `/${prefix}/runs`, mode: "generic" as const },
  { path: (prefix: string) => `/${prefix}/providers`, mode: "provider" as const },
  { path: (prefix: string) => `/${prefix}/projects`, mode: "generic" as const },
  { path: (prefix: string) => `/${prefix}/plugins`, mode: "generic" as const },
  { path: (prefix: string) => `/${prefix}/workspaces`, mode: "generic" as const },
  { path: (prefix: string) => `/${prefix}/approvals`, mode: "generic" as const },
  { path: (prefix: string) => `/${prefix}/budgets`, mode: "generic" as const },
  { path: (prefix: string) => `/${prefix}/labels`, mode: "generic" as const },
  { path: (prefix: string) => `/${prefix}/activity`, mode: "generic" as const },
  { path: (prefix: string) => `/${prefix}/org`, mode: "generic" as const },
  { path: (prefix: string) => `/${prefix}/org/chart`, mode: "generic" as const },
  { path: (prefix: string) => `/${prefix}/settings`, mode: "settings-company" as const },
  { path: () => "/settings/general", mode: "settings-global" as const },
  { path: () => "/settings/experimental", mode: "settings-global" as const },
  { path: () => "/settings/users", mode: "settings-global" as const },
  { path: () => "/settings/api-keys", mode: "settings-global" as const },
  { path: () => "/settings/status", mode: "settings-global" as const },
];

test.describe.configure({ mode: "serial" });

test("page-by-page interactive smoke covers safe controls on major surfaces", async ({ page }) => {
  const diagnostics = collectBrowserDiagnostics(page);
  const { company, prefix } = await ensureCompany(page);
  const seeded = await seedDetailData(page, company.id);

  const routeResults: Array<{ route: string; clicked: string[] }> = [];

  for (const spec of routeSpecs) {
    const route = spec.path(prefix);
    await page.goto(route);
    await waitForStable(page);
    const clicked = await interactWithPage(page);

    if (spec.mode === "provider") {
      const strategySelect = page.locator('main select').first();
      if (await strategySelect.isVisible().catch(() => false)) {
        const options = await strategySelect.locator("option").evaluateAll((nodes) =>
          nodes
            .map((node) => ({
              value: (node as HTMLOptionElement).value,
              label: (node.textContent ?? "").trim(),
              disabled: (node as HTMLOptionElement).disabled,
            }))
            .filter((option) => !option.disabled && option.value),
        );
        if (options.length > 1) {
          const current = await strategySelect.inputValue().catch(() => "");
          const target = options.find((option) => option.value !== current) ?? options[0];
          if (target?.value && target.value !== current) {
            await strategySelect.selectOption(target.value);
            clicked.push(`select:strategy:${target.label || target.value}`);
            await waitForStable(page);
          }
        }
      }
    }

    routeResults.push({ route, clicked });
  }

  for (const detailRoute of [
    `/${prefix}/agents/${seeded.agent.id}`,
    `/${prefix}/issues/${seeded.issue.id}`,
    `/${prefix}/runs/${seeded.run?.id ?? ""}`,
  ]) {
    if (detailRoute.endsWith("/")) continue;
    await page.goto(detailRoute);
    await waitForStable(page);
    const clicked = await interactWithPage(page);
    routeResults.push({ route: detailRoute, clicked });
  }

  expect(diagnostics.pageErrors, diagnostics.pageErrors.join("\n")).toEqual([]);
  expect(diagnostics.requestFailures, diagnostics.requestFailures.join("\n")).toEqual([]);
  expect(diagnostics.consoleErrors, diagnostics.consoleErrors.join("\n")).toEqual([]);

  // Keep a light audit trail for local debugging if this ever flakes.
  console.log(JSON.stringify(routeResults, null, 2));
});
