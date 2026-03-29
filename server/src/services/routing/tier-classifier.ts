import type { TaskSignals } from "@clawdev/shared";

export interface ClassificationResult {
  tier: 1 | 2 | 3;
  complexityScore: number; // 0–1
  reasoning: string;
}

// ── Keyword dictionaries ────────────────────────────────────────────────────

const TIER1_TITLE_KEYWORDS = [
  "architect",
  "design system",
  "migration",
  "rewrite",
  "security audit",
  "performance overhaul",
  "infrastructure",
  "multi-service",
  "distributed",
  "database redesign",
  "scalability",
  "critical vulnerability",
  "zero-downtime",
  "auth redesign",
];

const TIER3_TITLE_KEYWORDS = [
  "typo",
  "fix lint",
  "linting",
  "rename",
  "bump version",
  "update dependency",
  "update readme",
  "fix import",
  "remove unused",
  "add comment",
  "whitespace",
  "formatting",
  "trivial",
  "nit",
  "changelog",
];

const TIER1_TASK_TYPES = ["architecture", "security", "infrastructure"];
const TIER3_TASK_TYPES = ["formatting", "documentation", "chore"];

// ── Scoring helpers ─────────────────────────────────────────────────────────

function keywordScore(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let matches = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) matches++;
  }
  return Math.min(matches / 2, 1.0);
}

function tokenComplexityScore(estimatedTokens: number): number {
  if (estimatedTokens > 100_000) return 1.0;
  if (estimatedTokens > 50_000) return 0.85;
  if (estimatedTokens > 20_000) return 0.6;
  if (estimatedTokens > 10_000) return 0.4;
  if (estimatedTokens > 5_000) return 0.25;
  return 0.1;
}

function descriptionComplexityScore(description?: string): number {
  if (!description) return 0;
  const length = description.length;

  let score = 0;

  // Length-based (longer descriptions typically mean more complex tasks)
  if (length > 3000) score += 0.3;
  else if (length > 1000) score += 0.2;
  else if (length > 300) score += 0.1;

  const lower = description.toLowerCase();

  // Structural complexity signals
  const complexitySignals = [
    "breaking change",
    "backward compat",
    "backwards compat",
    "cross-cutting",
    "multi-step",
    "requires coordination",
    "race condition",
    "concurrency",
    "deadlock",
    "distributed",
    "consensus",
    "transaction",
    "rollback",
  ];
  for (const signal of complexitySignals) {
    if (lower.includes(signal)) score += 0.15;
  }

  // Code block count as a proxy for scope
  const codeBlockCount = (description.match(/```/g) || []).length / 2;
  if (codeBlockCount > 3) score += 0.15;
  else if (codeBlockCount > 1) score += 0.05;

  return Math.min(score, 1.0);
}

function projectSizeScore(size?: "small" | "medium" | "large"): number {
  switch (size) {
    case "large":
      return 0.3;
    case "medium":
      return 0.15;
    case "small":
      return 0.0;
    default:
      return 0.1; // unknown defaults to slight bump
  }
}

// ── Main classifier ─────────────────────────────────────────────────────────

export function classifyTask(signals: TaskSignals): ClassificationResult {
  const reasons: string[] = [];

  // 1. Token count signal (weight 0.30)
  const tokenScore = tokenComplexityScore(signals.estimatedInputTokens);

  // 2. Title keyword signal (weight 0.25)
  const titleText = signals.issueTitle ?? "";
  const tier1TitleScore = keywordScore(titleText, TIER1_TITLE_KEYWORDS);
  const tier3TitleScore = keywordScore(titleText, TIER3_TITLE_KEYWORDS);
  const titleScore = tier1TitleScore > 0
    ? 0.5 + tier1TitleScore * 0.5
    : tier3TitleScore > 0
      ? 0.5 - tier3TitleScore * 0.5
      : 0.5;

  // 3. Task type signal (weight 0.15)
  let taskTypeScore = 0.5;
  if (TIER1_TASK_TYPES.includes(signals.taskType)) {
    taskTypeScore = 0.9;
    reasons.push(`task type "${signals.taskType}" indicates high complexity`);
  } else if (TIER3_TASK_TYPES.includes(signals.taskType)) {
    taskTypeScore = 0.1;
    reasons.push(`task type "${signals.taskType}" indicates low complexity`);
  }

  // 4. Description complexity (weight 0.15)
  const descScore = descriptionComplexityScore(signals.issueDescription);

  // 5. Project size (weight 0.15)
  const projScore = projectSizeScore(signals.projectSize);

  // Weighted composite
  let composite =
    tokenScore * 0.3 +
    titleScore * 0.25 +
    taskTypeScore * 0.15 +
    descScore * 0.15 +
    projScore * 0.15;

  // Priority bump: "critical" or "urgent" bumps score up
  if (signals.priority) {
    const p = signals.priority.toLowerCase();
    if (p === "critical" || p === "urgent") {
      composite = Math.min(composite + 0.15, 1.0);
      reasons.push(`priority "${signals.priority}" bumped complexity`);
    } else if (p === "high") {
      composite = Math.min(composite + 0.05, 1.0);
    }
  }

  // Build reasoning for title keywords
  if (tier1TitleScore > 0) {
    reasons.push("title contains high-complexity keywords");
  }
  if (tier3TitleScore > 0) {
    reasons.push("title contains low-complexity keywords");
  }
  if (tokenScore >= 0.6) {
    reasons.push(`estimated ${signals.estimatedInputTokens.toLocaleString()} input tokens suggest large context`);
  }
  if (descScore >= 0.3) {
    reasons.push("description contains complex structural signals");
  }

  // Map composite score to tier
  let tier: 1 | 2 | 3;
  if (composite >= 0.65) {
    tier = 1;
  } else if (composite >= 0.35) {
    tier = 2;
  } else {
    tier = 3;
  }

  const complexityScore = Math.round(composite * 1000) / 1000;

  const reasoning =
    reasons.length > 0
      ? `Tier ${tier} (score ${complexityScore}): ${reasons.join("; ")}`
      : `Tier ${tier} (score ${complexityScore}): default classification based on aggregate signals`;

  return { tier, complexityScore, reasoning };
}
