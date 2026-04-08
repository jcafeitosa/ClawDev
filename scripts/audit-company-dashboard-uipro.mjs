import fs from "fs";
import path from "path";

const repoRoot = process.cwd();
const routesRoot = path.join(repoRoot, "svelte-ui", "src", "routes", "[companyPrefix]");
const reportPath = path.join(repoRoot, "report", "uipro-company-dashboard-audit.md");

const UI_PRIMITIVES = [
  "PageLayout",
  "Card",
  "Button",
  "Badge",
  "Input",
  "Textarea",
  "Skeleton",
  "Separator",
  "Alert",
  "Tabs",
  "Dialog",
  "Sheet",
  "DropdownMenu",
  "Select",
  "Popover",
  "Tooltip",
  "Command",
  "Avatar",
  "Progress",
  "Breadcrumb",
  "Table",
];

function listPages(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.isFile() && entry.name === "+page.svelte") out.push(full);
    }
  };

  walk(dir);
  return out.sort();
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function has(re, text) {
  return re.test(text);
}

function countMatches(re, text) {
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

function relativePage(filePath) {
  return path.relative(routesRoot, filePath).replaceAll(path.sep, "/");
}

function classifyPage(meta) {
  if (!meta.usesPageLayout) return "cleanup";
  if (meta.usesGlassCard && meta.cardCount < 2) return "mixed";
  if (meta.usesGlassCard && meta.cardCount >= 2) return "mixed";
  if (meta.primitiveCount < 3) return "mixed";
  return "aligned";
}

function pageSummary(meta) {
  const hits = [];
  if (meta.usesPageLayout) hits.push("PageLayout");
  if (meta.usesGlassCard) hits.push("glass-card");
  if (meta.primitiveCount > 0) hits.push(`${meta.primitiveCount} shadcn primitives`);
  if (meta.hasTabs) hits.push("tabs");
  if (meta.hasTable) hits.push("table");
  if (meta.hasDialog) hits.push("dialog");
  return hits.length > 0 ? hits.join(", ") : "none";
}

const pages = listPages(routesRoot).map((filePath) => {
  const text = read(filePath);
  const importLine = text.match(/import\s+\{([^}]+)\}\s+from\s+['"][^'"]*components\/ui[^'"]*['"]/);
  const importedNames = importLine
    ? importLine[1]
        .split(",")
        .map((token) => token.trim().replace(/\sas\s.+$/, ""))
        .filter(Boolean)
    : [];
  const primitiveNames = importedNames.filter((name) => UI_PRIMITIVES.includes(name));
  const primitiveCount = primitiveNames.length;
  const cardCount = countMatches(/<Card\b/g, text);

  return {
    path: relativePage(filePath),
    usesPageLayout: has(/<PageLayout\b/g, text),
    usesGlassCard: has(/glass-card/g, text),
    primitiveCount,
    primitiveNames,
    cardCount,
    hasTabs: has(/<Tabs|TabsList|TabsTrigger|TabsContent/g, text),
    hasTable: has(/<Table|<thead|<tbody|<tr|<td|<th/g, text),
    hasDialog: has(/<Dialog|<AlertDialog/g, text),
    hasButton: has(/<Button\b/g, text),
    hasBadge: has(/<Badge\b/g, text),
    hasAlert: has(/<Alert\b/g, text),
    verdict: classifyPage({
      usesPageLayout: has(/<PageLayout\b/g, text),
      usesGlassCard: has(/glass-card/g, text),
      primitiveCount,
      cardCount,
    }),
  };
});

const summary = {
  totalPages: pages.length,
  aligned: pages.filter((page) => page.verdict === "aligned").length,
  mixed: pages.filter((page) => page.verdict === "mixed").length,
  cleanup: pages.filter((page) => page.verdict === "cleanup").length,
  pageLayout: pages.filter((page) => page.usesPageLayout).length,
  glassCard: pages.filter((page) => page.usesGlassCard).length,
  cards: pages.reduce((acc, page) => acc + page.cardCount, 0),
};

const highLeverage = pages
  .filter((page) => page.verdict !== "aligned")
  .sort((a, b) => {
    const score = (page) => {
      let value = 0;
      if (!page.usesPageLayout) value += 3;
      if (page.usesGlassCard) value += 2;
      if (page.primitiveCount < 2) value += 1;
      return value;
    };
    return score(b) - score(a);
  })
  .slice(0, 8);

const bt = "`";
const reportLines = [
  "# ClawDev UI Pro Max Audit",
  "",
  `Generated from the local route scan on ${new Date().toISOString()}.`,
  "",
  "## Round 1. Page Inventory",
  "",
  "### Summary",
  `- Total company-scoped pages scanned: ${summary.totalPages}`,
  `- PageLayout coverage: ${summary.pageLayout}/${summary.totalPages}`,
  `- glass-card usage: ${summary.glassCard}/${summary.totalPages}`,
  `- Classified aligned: ${summary.aligned}`,
  `- Classified mixed: ${summary.mixed}`,
  `- Classified cleanup: ${summary.cleanup}`,
  "",
  "### Route Matrix",
  "| Page | Verdict | PageLayout | glass-card | Shadcn primitives |",
  "|---|---|---:|---:|---|",
  ...pages.map(
    (page) =>
      `| ${bt}${page.path}${bt} | ${page.verdict} | ${page.usesPageLayout ? "yes" : "no"} | ${page.usesGlassCard ? "yes" : "no"} | ${page.primitiveNames.join(", ") || "none"} |`,
  ),
  "",
  "## Round 2. Pattern Drift",
  "",
  `- The app already uses many shadcn primitives, but the dashboard remains the clearest outlier because it still relies on bespoke ${bt}glass-card${bt} surfaces instead of the shared ${bt}PageLayout${bt} / Card composition used elsewhere.`,
  `- The strongest alignment is on data-heavy routes that already use ${bt}PageLayout${bt}, ${bt}Card${bt}, ${bt}Badge${bt}, ${bt}Alert${bt}, ${bt}Skeleton${bt}, and other shadcn primitives in predictable combinations.`,
  "- The remaining drift is mostly structural, not functional: custom section wrappers, mixed surface styles, and inconsistent action placement rather than missing core components.",
  "- The local UI pro guidance points to data-dense layouts, tabular data presented as tables, and stronger block scaffolding; those are mostly present in the design guide and partially present in runtime pages.",
  "",
  "## Round 3. Highest-Leverage Candidates",
  "",
  `1. Convert ${bt}svelte-ui/src/routes/[companyPrefix]/dashboard/+page.svelte${bt} to ${bt}PageLayout${bt} and card-based sections first. This is the biggest single win because it is the only major company page still using a fully custom shell.`,
  `2. Keep the ${bt}glass-card${bt} effect only as a styling choice on top of ${bt}Card${bt} where needed, instead of using raw div wrappers. That preserves the visual direction while standardizing semantics.`,
  `3. Add a small dashboard action bar with shadcn ${bt}Button${bt} variants for the main flows: agents, issues, costs, approvals.`,
  `4. Preserve the current charts and timeline, but wrap each region in ${bt}CardHeader${bt} / ${bt}CardContent${bt} / ${bt}CardDescription${bt} so the page reads like the rest of the app.`,
  "5. If a future pass is needed, add table-based layouts to the data-heavy lists; that is the most direct UI Pro Max compliance gain after the dashboard shell is normalized.",
  "",
  "## High-Leverage Targets",
  "",
  "| Page | Why it matters | Primary fix |",
  "|---|---|---|",
  ...highLeverage.map(
    (page) =>
      `| ${bt}${page.path}${bt} | ${page.verdict === "cleanup" ? "missing PageLayout" : "mixed surface treatment"} | ${page.usesPageLayout ? "refine surface semantics" : "wrap in PageLayout"} |`,
  ),
  "",
  "## Notes",
  "",
  "- This audit is intentionally conservative: it flags structural drift and obvious shell inconsistencies, not every visual nuance.",
  "- No files were edited by the audit itself.",
  "- The next implementation pass should target the dashboard and any page that still uses bespoke surface containers for large content blocks.",
];

const report = reportLines.join("\n");

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, report);

console.log(report);
