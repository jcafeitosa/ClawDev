export interface StructuredSddInput {
  summary?: string | null;
  spec: string;
  design: string;
  risk: string;
  rollout: string;
  rollback: string;
  validation: string;
  subjectLabel: string;
}

export interface ParsedStructuredSddDescription {
  subjectLabel: string;
  summary: string;
  spec: string;
  design: string;
  risk: string;
  rollout: string;
  rollback: string;
  validation: string;
}

export const STRUCTURED_SDD_MIN_SECTION_LENGTH = 40;
export const STRUCTURED_SDD_MIN_SECTION_WORDS = 5;

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function section(title: string, body: string): string {
  return `## ${title}\n${body}`;
}

function countWords(value: string): number {
  return value.split(" ").filter(Boolean).length;
}

function createEmptyParsedStructuredSddDescription(): ParsedStructuredSddDescription {
  return {
    subjectLabel: "",
    summary: "",
    spec: "",
    design: "",
    risk: "",
    rollout: "",
    rollback: "",
    validation: "",
  };
}

function isStructuredSectionTitle(value: string): value is keyof Omit<ParsedStructuredSddDescription, "subjectLabel" | "summary"> {
  return value === "spec"
    || value === "design"
    || value === "risk"
    || value === "rollout"
    || value === "rollback"
    || value === "validation";
}

export function hasMeaningfulStructuredSddSection(value: string | null | undefined): boolean {
  const normalized = normalizeText(value);
  return normalized.length >= STRUCTURED_SDD_MIN_SECTION_LENGTH
    && countWords(normalized) >= STRUCTURED_SDD_MIN_SECTION_WORDS;
}

export function validateStructuredSddInput(input: {
  spec: string | null | undefined;
  design: string | null | undefined;
  risk: string | null | undefined;
  rollout: string | null | undefined;
  rollback: string | null | undefined;
  validation: string | null | undefined;
}): string[] {
  const issues: string[] = [];
  if (!hasMeaningfulStructuredSddSection(input.spec)) {
    issues.push(
      `SDD spec must be at least ${STRUCTURED_SDD_MIN_SECTION_LENGTH} characters and ${STRUCTURED_SDD_MIN_SECTION_WORDS} words.`,
    );
  }
  if (!hasMeaningfulStructuredSddSection(input.design)) {
    issues.push(
      `SDD design must be at least ${STRUCTURED_SDD_MIN_SECTION_LENGTH} characters and ${STRUCTURED_SDD_MIN_SECTION_WORDS} words.`,
    );
  }
  if (!hasMeaningfulStructuredSddSection(input.risk)) {
    issues.push(
      `SDD risk must be at least ${STRUCTURED_SDD_MIN_SECTION_LENGTH} characters and ${STRUCTURED_SDD_MIN_SECTION_WORDS} words.`,
    );
  }
  if (!hasMeaningfulStructuredSddSection(input.rollout)) {
    issues.push(
      `SDD rollout must be at least ${STRUCTURED_SDD_MIN_SECTION_LENGTH} characters and ${STRUCTURED_SDD_MIN_SECTION_WORDS} words.`,
    );
  }
  if (!hasMeaningfulStructuredSddSection(input.rollback)) {
    issues.push(
      `SDD rollback must be at least ${STRUCTURED_SDD_MIN_SECTION_LENGTH} characters and ${STRUCTURED_SDD_MIN_SECTION_WORDS} words.`,
    );
  }
  if (!hasMeaningfulStructuredSddSection(input.validation)) {
    issues.push(
      `SDD validation must be at least ${STRUCTURED_SDD_MIN_SECTION_LENGTH} characters and ${STRUCTURED_SDD_MIN_SECTION_WORDS} words.`,
    );
  }
  return issues;
}

export function parseStructuredSddDescription(value: string | null | undefined): ParsedStructuredSddDescription {
  const raw = String(value ?? "").replace(/\r\n/g, "\n").trim();
  const parsed = createEmptyParsedStructuredSddDescription();
  if (!raw) return parsed;

  const sectionBuffers: Record<keyof Omit<ParsedStructuredSddDescription, "subjectLabel">, string[]> = {
    summary: [],
    spec: [],
    design: [],
    risk: [],
    rollout: [],
    rollback: [],
    validation: [],
  };

  let currentSection: keyof typeof sectionBuffers | null = null;
  const lines = raw.split("\n");

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (headingMatch) {
      const headingLevel = headingMatch[1].length;
      const headingTitle = headingMatch[2].trim();
      if (headingLevel === 1) {
        parsed.subjectLabel = headingTitle;
        currentSection = null;
        continue;
      }

      const normalizedTitle = headingTitle.toLowerCase();
      if (normalizedTitle === "overview") {
        currentSection = "summary";
      } else if (isStructuredSectionTitle(normalizedTitle)) {
        currentSection = normalizedTitle;
      } else {
        currentSection = null;
      }
      continue;
    }

    if (currentSection) {
      sectionBuffers[currentSection].push(line);
    }
  }

  const normalizedSections = Object.fromEntries(
    Object.entries(sectionBuffers).map(([key, lines]) => [key, normalizeText(lines.join("\n"))]),
  ) as unknown as Omit<ParsedStructuredSddDescription, "subjectLabel">;

  if (!normalizedSections.summary && !normalizedSections.spec && !normalizedSections.design && !normalizedSections.risk && !normalizedSections.rollout && !normalizedSections.rollback && !normalizedSections.validation) {
    normalizedSections.summary = normalizeText(raw);
  }

  return {
    ...parsed,
    ...normalizedSections,
  };
}

export function composeStructuredSddDescription(input: StructuredSddInput): string {
  const summary = normalizeText(input.summary);
  const spec = normalizeText(input.spec);
  const design = normalizeText(input.design);
  const risk = normalizeText(input.risk);
  const rollout = normalizeText(input.rollout);
  const rollback = normalizeText(input.rollback);
  const validation = normalizeText(input.validation);
  const sections = [
    section("Spec", spec),
    section("Design", design),
    section("Risk", risk),
    section("Rollout", rollout),
    section("Rollback", rollback),
    section("Validation", validation),
  ];

  if (summary) {
    sections.unshift(section("Overview", summary));
  }

  return [`# ${normalizeText(input.subjectLabel) || "Structured delivery"}`, ...sections].join("\n\n");
}
