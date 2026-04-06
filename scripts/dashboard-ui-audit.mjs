#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROUTES_ROOT = path.join(process.cwd(), "svelte-ui", "src", "routes");
const SHADCN_PRIMITIVES = [
  "Card",
  "Button",
  "Badge",
  "Tabs",
  "Table",
  "Alert",
  "Skeleton",
  "Input",
  "Textarea",
  "Select",
  "Dialog",
  "Sheet",
  "Popover",
  "DropdownMenu",
  "Command",
  "Breadcrumb",
  "Separator",
  "Progress",
  "Avatar",
  "Tooltip",
];

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, out);
      continue;
    }
    if (entry.isFile() && entry.name === "+page.svelte") out.push(fullPath);
  }
  return out;
}

function toRoute(filePath) {
  return (
    "/" +
    path
      .relative(ROUTES_ROOT, path.dirname(filePath))
      .split(path.sep)
      .filter(Boolean)
      .join("/")
  );
}

function summarizeImports(content) {
  const importMatches = [...content.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"][^'"]*ui\/index\.js['"]/g)];
  const imported = new Set();
  for (const match of importMatches) {
    for (const token of match[1].split(",")) {
      const name = token.trim().split(/\s+as\s+/i)[0];
      if (name) imported.add(name);
    }
  }
  return [...imported].filter((name) => SHADCN_PRIMITIVES.includes(name)).sort();
}

function countMatches(content, regex) {
  return (content.match(regex) ?? []).length;
}

async function main() {
  const files = (await walk(ROUTES_ROOT)).sort();
  const rows = [];

  for (const file of files) {
    const content = await readFile(file, "utf8");
    const route = toRoute(file);
    const usesPageLayout = /<PageLayout\b/.test(content);
    const usesGlassCard = /glass-card/.test(content);
    const shadcn = summarizeImports(content);
    const shadcnUsageCount = countMatches(content, /<([A-Z][A-Za-z0-9]*)\b/g);

    rows.push({
      route,
      usesPageLayout,
      usesGlassCard,
      shadcn,
      shadcnUsageCount,
      file,
    });
  }

  const companyRows = rows.filter((row) => row.route.startsWith("/[companyPrefix]/"));
  const globalRows = rows.filter((row) => !row.route.startsWith("/[companyPrefix]/"));
  const dashboardRow = rows.find((row) => row.route === "/[companyPrefix]/dashboard") ?? null;

  const formatYesNo = (value) => (value ? "yes" : "no");
  const formatList = (items) => (items.length > 0 ? items.join(", ") : "-");

  console.log("# ClawDev Dashboard / shadcn UI audit");
  console.log("");
  console.log("## Round 1 - Inventory");
  console.log("");
  console.log(`- Routes scanned: ${rows.length}`);
  console.log(`- Company routes: ${companyRows.length}`);
  console.log(`- Global routes: ${globalRows.length}`);
  console.log(`- Dashboard route: ${dashboardRow ? "found" : "missing"}`);
  console.log("");
  console.log("| Route | PageLayout | glass-card | shadcn primitives | `<A>` count |");
  console.log("| --- | --- | --- | --- | --- |");
  for (const row of rows) {
    if (!row.route.startsWith("/[companyPrefix]/") && !row.route.startsWith("/settings") && !row.route.startsWith("/design-guide")) continue;
    console.log(
      `| ${row.route} | ${formatYesNo(row.usesPageLayout)} | ${formatYesNo(row.usesGlassCard)} | ${formatList(row.shadcn)} | ${row.shadcnUsageCount} |`,
    );
  }

  console.log("");
  console.log("## Round 2 - Pattern drift");
  console.log("");
  if (dashboardRow) {
    console.log(
      `- Dashboard uses PageLayout: ${formatYesNo(dashboardRow.usesPageLayout)}; glass-card surfaces: ${formatYesNo(dashboardRow.usesGlassCard)}; shadcn primitives: ${formatList(dashboardRow.shadcn)}.`,
    );
  }
  console.log(
    "- Pages that still rely mostly on `glass-card` are deviating from the shadcn compound-component pattern, even if they keep the same visual language.",
  );
  console.log(
    "- Pages that already use `PageLayout` are structurally aligned, but some still mix raw section divs with card compounds, which weakens consistency.",
  );
  console.log("");
  console.log("## Round 3 - Implementation targets");
  console.log("");
  console.log("- Promote `PageLayout` on dashboard-like pages that still render a free-form top-level container.");
  console.log("- Prefer `Card`, `CardHeader`, `CardContent`, `CardFooter`, `Badge`, `Alert`, `Skeleton`, `Button`, and `Separator` over custom wrappers when the layout is a standard data panel.");
  console.log("- Keep `glass-card` only where it is doing something the shadcn card stack cannot express cleanly, such as the existing glassmorphism hero surfaces.");
  console.log("- Preserve the current responsive behavior and live data cadence; the audit is about structure and component semantics, not changing business logic.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
