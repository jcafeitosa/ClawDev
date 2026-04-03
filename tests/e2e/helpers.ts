import { expect, type Page } from "@playwright/test";

async function waitForApiReady(page: Page) {
  const deadline = Date.now() + 30_000;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    try {
      const healthRes = await page.request.get("/api/health");
      if (healthRes.ok()) return;
      lastError = new Error(`health check returned ${healthRes.status()}`);
    } catch (error) {
      lastError = error;
    }

    await page.waitForTimeout(500);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("API did not become ready within 30 seconds");
}

export async function ensureCompany(page: Page) {
  await waitForApiReady(page);

  const companiesRes = await page.request.get("/api/companies");
  expect(companiesRes.ok()).toBe(true);
  const companies = (await companiesRes.json()) as Array<{
    id: string;
    slug?: string | null;
    urlKey?: string | null;
  }>;

  if (companies.length > 0) {
    const company = companies[0]!;
    return {
      company,
      prefix: company.slug ?? company.urlKey ?? company.id,
    };
  }

  const createRes = await page.request.post("/api/companies", {
    data: { name: `E2E Seed ${Date.now()}` },
  });
  expect(createRes.ok()).toBe(true);
  const company = (await createRes.json()) as {
    id: string;
    slug?: string | null;
    urlKey?: string | null;
  };
  return {
    company,
    prefix: company.slug ?? company.urlKey ?? company.id,
  };
}

export type BrowserDiagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: string[];
  notFoundResponses: string[];
};

export function collectBrowserDiagnostics(page: Page): BrowserDiagnostics {
  const diagnostics: BrowserDiagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    notFoundResponses: [],
  };

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (
      text.includes("SES Removing unpermitted intrinsics") ||
      text.includes("[vite] failed to connect to websocket") ||
      text.includes("WebSocket connection to 'ws://127.0.0.1:")
    ) {
      return;
    }
    diagnostics.consoleErrors.push(text);
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

  page.on("response", (response) => {
    if (response.status() === 404) {
      diagnostics.notFoundResponses.push(`${response.request().method()} ${response.url()}`);
    }
  });

  return diagnostics;
}
