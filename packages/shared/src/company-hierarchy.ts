import { z } from "zod";
import type { AgentRole } from "./constants.js";

export const HIERARCHY_PRESETS = [
  "classic_pyramid",
  "flat_founder",
  "matrix_platform",
  "research_lab",
  "enterprise_platform",
  "hardware_systems",
  "social_scale",
] as const;

export type HierarchyPreset = (typeof HIERARCHY_PRESETS)[number];

export const hierarchyPresetSchema = z.enum(HIERARCHY_PRESETS);

export const HIERARCHY_LEVELS = ["c", "b", "a", "specialist"] as const;
export type HierarchyLevel = (typeof HIERARCHY_LEVELS)[number];
export const hierarchyLevelSchema = z.enum(HIERARCHY_LEVELS);

export interface HierarchyDepartmentDefinition {
  key: string;
  label: string;
  level: HierarchyLevel | "cross_functional";
  description: string;
  coreRoles: AgentRole[];
}

export interface HierarchyOperatingRule {
  key: string;
  title: string;
  description: string;
}

export const LEVEL_C_AGENT_ROLES = [
  "ceo",
  "coo",
  "cto",
  "cfo",
  "cmo",
  "hr",
] as const satisfies readonly AgentRole[];

export type LevelCAgentRole = (typeof LEVEL_C_AGENT_ROLES)[number];

export function isLevelCAgentRole(role: string | null | undefined): role is LevelCAgentRole {
  return typeof role === "string" && (LEVEL_C_AGENT_ROLES as readonly string[]).includes(role);
}

export function hasLevelCAgentPermissions(role: string | null | undefined): boolean {
  return isLevelCAgentRole(role);
}

export interface HierarchySeedBlueprint {
  key: string;
  name: string;
  role: AgentRole;
  title: string;
  level: HierarchyLevel;
  reportsToKey: string;
  departmentKey?: string;
}

export interface HierarchyPresetDefinition {
  id: HierarchyPreset;
  label: string;
  description: string;
  fit: string;
  rootTitle: string;
  rootSubtitle: string;
  departments: HierarchyDepartmentDefinition[];
  operatingRules: HierarchyOperatingRule[];
  seedAgents: HierarchySeedBlueprint[];
}

export const HIERARCHY_PRESET_DEFINITIONS: Record<HierarchyPreset, HierarchyPresetDefinition> = {
  classic_pyramid: {
    id: "classic_pyramid",
    label: "Classic pyramid",
    description: "Traditional vertical hierarchy with a clear chain of command from executives to ICs.",
    fit: "Good for companies that want explicit reporting lines and conservative organizational control.",
    rootTitle: "Chief Executive Officer",
    rootSubtitle: "Traditional top-down operating model",
    departments: [
      {
        key: "leadership",
        label: "Leadership",
        level: "cross_functional",
        description: "Executive decision making, approvals, capital allocation, and escalation handling.",
        coreRoles: ["ceo", "coo", "cto", "cfo", "cmo", "hr"],
      },
      {
        key: "delivery",
        label: "Delivery",
        level: "b",
        description: "Translates strategy into operating plans and manages handoffs between teams.",
        coreRoles: ["general", "pm", "engineer", "devops"],
      },
      {
        key: "execution",
        label: "Execution",
        level: "a",
        description: "Specialists and senior ICs who implement the plan inside their assigned scope.",
        coreRoles: ["engineer", "qa", "designer", "researcher"],
      },
    ],
    operatingRules: [
      {
        key: "sdd",
        title: "Spec-first delivery",
        description: "Use SDD: spec, design, decomposition, validation, then implementation.",
      },
      {
        key: "scope",
        title: "Respect the chain of command",
        description: "Do not step into another agent's competency; escalate or delegate across the chain instead.",
      },
      {
        key: "collaboration",
        title: "Collaborate through the system",
        description: "Use issues, subtasks, teams, channels, DMs, comments, and approvals to work together.",
      },
    ],
    seedAgents: [
      { key: "cto", name: "Engineering Lead", role: "cto", title: "Chief Technology Officer", level: "c", reportsToKey: "ceo", departmentKey: "leadership" },
      { key: "pm", name: "Product Lead", role: "pm", title: "Head of Product", level: "c", reportsToKey: "ceo", departmentKey: "leadership" },
      { key: "ops", name: "Operations Lead", role: "general", title: "Head of Operations", level: "c", reportsToKey: "ceo", departmentKey: "leadership" },
      { key: "eng-1", name: "Platform Engineer", role: "engineer", title: "Senior Engineer", level: "a", reportsToKey: "cto", departmentKey: "execution" },
      { key: "qa-1", name: "QA Specialist", role: "qa", title: "Quality Assurance Specialist", level: "specialist", reportsToKey: "pm", departmentKey: "execution" },
    ],
  },
  flat_founder: {
    id: "flat_founder",
    label: "Flat founding team",
    description: "Minimal hierarchy with direct collaboration and shallow reporting chains.",
    fit: "Best for small founding teams that want fast feedback loops and little management overhead.",
    rootTitle: "Founder / CEO",
    rootSubtitle: "Small, direct, and execution focused",
    departments: [
      {
        key: "founding",
        label: "Founding pod",
        level: "cross_functional",
        description: "A compact group that handles strategy, product, engineering, and delivery together.",
        coreRoles: ["ceo", "cto", "pm", "general", "engineer", "designer"],
      },
      {
        key: "specialists",
        label: "Specialists",
        level: "a",
        description: "Narrow experts who execute fast with minimal management overhead.",
        coreRoles: ["engineer", "designer", "qa", "researcher"],
      },
    ],
    operatingRules: [
      {
        key: "speed",
        title: "Fast iteration",
        description: "Prefer short cycles, direct feedback, and simple reporting lines.",
      },
      {
        key: "ownership",
        title: "Direct ownership",
        description: "A single owner should be obvious for each task or decision.",
      },
      {
        key: "collaboration",
        title: "Use the system",
        description: "Coordinate through issues, comments, channels, and DMs instead of ad hoc side work.",
      },
    ],
    seedAgents: [
      { key: "tech", name: "Technical Partner", role: "cto", title: "Technical Lead", level: "c", reportsToKey: "ceo", departmentKey: "founding" },
      { key: "product", name: "Product Partner", role: "pm", title: "Product Lead", level: "b", reportsToKey: "ceo", departmentKey: "founding" },
      { key: "design", name: "Design Partner", role: "designer", title: "Design Lead", level: "a", reportsToKey: "ceo", departmentKey: "specialists" },
      { key: "support", name: "Delivery Specialist", role: "general", title: "Delivery Specialist", level: "specialist", reportsToKey: "ceo", departmentKey: "specialists" },
    ],
  },
  matrix_platform: {
    id: "matrix_platform",
    label: "Matrix platform",
    description: "Cross-functional pillars with shared platform services and multiple product squads.",
    fit: "Good for large engineering organizations that balance platform, product, and research work.",
    rootTitle: "Chief Executive Officer",
    rootSubtitle: "Matrix org with shared platform layers",
    departments: [
      {
        key: "platform",
        label: "Platform",
        level: "c",
        description: "Shared infrastructure, developer experience, security, and runtime reliability.",
        coreRoles: ["cto", "devops", "engineer"],
      },
      {
        key: "product",
        label: "Product",
        level: "c",
        description: "Roadmap ownership, discovery, prioritization, and customer-facing outcomes.",
        coreRoles: ["ceo", "pm", "general"],
      },
      {
        key: "research",
        label: "Research",
        level: "c",
        description: "Exploration, experimentation, model evaluation, and applied science.",
        coreRoles: ["researcher", "engineer", "general"],
      },
      {
        key: "delivery",
        label: "Delivery",
        level: "a",
        description: "Specialists embedded in squads to execute against the plan.",
        coreRoles: ["engineer", "qa", "designer"],
      },
    ],
    operatingRules: [
      {
        key: "shared-platform",
        title: "Shared platform first",
        description: "Centralize foundation work so squads can move without duplicating infrastructure.",
      },
      {
        key: "matrix",
        title: "Matrix coordination",
        description: "Use explicit handoffs and cross-functional threads for work that spans departments.",
      },
      {
        key: "sdd",
        title: "SDD gate",
        description: "No implementation starts until the spec and acceptance criteria are clear.",
      },
    ],
    seedAgents: [
      { key: "platform", name: "Platform Lead", role: "cto", title: "Head of Platform", level: "c", reportsToKey: "ceo", departmentKey: "platform" },
      { key: "product", name: "Product Lead", role: "pm", title: "Head of Product", level: "c", reportsToKey: "ceo", departmentKey: "product" },
      { key: "research", name: "Research Lead", role: "researcher", title: "Head of Research", level: "c", reportsToKey: "ceo", departmentKey: "research" },
      { key: "infra", name: "Infrastructure Lead", role: "devops", title: "Infrastructure Manager", level: "b", reportsToKey: "platform", departmentKey: "platform" },
      { key: "squad", name: "Squad Engineer", role: "engineer", title: "Product Engineer", level: "a", reportsToKey: "product", departmentKey: "delivery" },
      { key: "qa", name: "Quality Specialist", role: "qa", title: "Quality Specialist", level: "specialist", reportsToKey: "product", departmentKey: "delivery" },
    ],
  },
  research_lab: {
    id: "research_lab",
    label: "Research lab",
    description: "Research-first structure with applied engineering, infra, and safety layers.",
    fit: "Matches OpenAI and Anthropic style orgs where research, product, and infrastructure move together.",
    rootTitle: "Chief Executive Officer",
    rootSubtitle: "Research-led AI company",
    departments: [
      {
        key: "research",
        label: "Research",
        level: "c",
        description: "Core model research, evals, experiments, and scientific direction.",
        coreRoles: ["researcher", "cto", "ceo"],
      },
      {
        key: "applied",
        label: "Applied engineering",
        level: "b",
        description: "Turns research into productized workflows, APIs, and tooling.",
        coreRoles: ["engineer", "general", "devops"],
      },
      {
        key: "safety",
        label: "Safety / policy",
        level: "c",
        description: "Governance, policy review, approval gates, and release safety.",
        coreRoles: ["general", "hr", "cfo"],
      },
      {
        key: "infra",
        label: "Infrastructure",
        level: "b",
        description: "Compute, deployment, observability, and operational resilience.",
        coreRoles: ["devops", "engineer"],
      },
    ],
    operatingRules: [
      {
        key: "evals",
        title: "Evaluation before release",
        description: "Use test suites and evals as a release gate for any material change.",
      },
      {
        key: "safety",
        title: "Safety review",
        description: "Escalate risky work early and keep approval gates explicit.",
      },
      {
        key: "collaboration",
        title: "Cross-functional collaboration",
        description: "Research, product, infra, and safety collaborate through managed interfaces, not ad hoc ownership changes.",
      },
    ],
    seedAgents: [
      { key: "research", name: "Research Lead", role: "researcher", title: "Head of Research", level: "c", reportsToKey: "ceo", departmentKey: "research" },
      { key: "applied", name: "Applied Lead", role: "engineer", title: "Applied Engineering Lead", level: "b", reportsToKey: "ceo", departmentKey: "applied" },
      { key: "infra", name: "Infra Lead", role: "devops", title: "Infrastructure Lead", level: "b", reportsToKey: "ceo", departmentKey: "infra" },
      { key: "safety", name: "Safety Lead", role: "general", title: "Safety / Policy Lead", level: "c", reportsToKey: "ceo", departmentKey: "safety" },
      { key: "research-ic", name: "Research Engineer", role: "researcher", title: "Research Engineer", level: "a", reportsToKey: "research", departmentKey: "research" },
      { key: "applied-ic", name: "Product Engineer", role: "engineer", title: "Applied Engineer", level: "specialist", reportsToKey: "applied", departmentKey: "applied" },
    ],
  },
  enterprise_platform: {
    id: "enterprise_platform",
    label: "Enterprise platform",
    description: "Mission-driven product, platform, customer, security, and operations layers.",
    fit: "Useful for Microsoft-style software organizations with broad product and enterprise responsibilities.",
    rootTitle: "Chief Executive Officer",
    rootSubtitle: "Enterprise software and cloud platform",
    departments: [
      {
        key: "product",
        label: "Product",
        level: "c",
        description: "Roadmap, requirements, and customer value delivery.",
        coreRoles: ["pm", "ceo", "general"],
      },
      {
        key: "platform",
        label: "Platform",
        level: "c",
        description: "Cloud, runtime, developer tooling, and shared services.",
        coreRoles: ["cto", "devops", "engineer"],
      },
      {
        key: "security",
        label: "Security",
        level: "b",
        description: "Identity, trust, compliance, and protection of customer data.",
        coreRoles: ["devops", "general", "hr"],
      },
      {
        key: "customer",
        label: "Customer success",
        level: "b",
        description: "Adoption, support, deployment readiness, and account outcomes.",
        coreRoles: ["general", "cmo", "hr"],
      },
      {
        key: "delivery",
        label: "Delivery",
        level: "a",
        description: "Program management, rollout coordination, and execution support.",
        coreRoles: ["general", "engineer", "qa"],
      },
    ],
    operatingRules: [
      {
        key: "enterprise",
        title: "Enterprise readiness",
        description: "Security, compliance, and supportability are part of the default delivery path.",
      },
      {
        key: "cross-team",
        title: "Cross-team control",
        description: "Use the org chart and approvals to coordinate shared work instead of overwriting ownership.",
      },
      {
        key: "sdd",
        title: "Plan before build",
        description: "Keep a spec, design, and validation path visible before implementation starts.",
      },
    ],
    seedAgents: [
      { key: "platform", name: "Platform Lead", role: "cto", title: "Platform Engineering Lead", level: "c", reportsToKey: "ceo", departmentKey: "platform" },
      { key: "product", name: "Product Lead", role: "pm", title: "Product Management Lead", level: "c", reportsToKey: "ceo", departmentKey: "product" },
      { key: "customer", name: "Customer Success Lead", role: "general", title: "Customer Success Lead", level: "b", reportsToKey: "ceo", departmentKey: "customer" },
      { key: "security", name: "Security Lead", role: "devops", title: "Security Engineering Lead", level: "b", reportsToKey: "ceo", departmentKey: "security" },
      { key: "program", name: "Program Lead", role: "general", title: "Program Management Lead", level: "a", reportsToKey: "product", departmentKey: "delivery" },
      { key: "support", name: "Support Specialist", role: "general", title: "Support Specialist", level: "specialist", reportsToKey: "customer", departmentKey: "customer" },
    ],
  },
  hardware_systems: {
    id: "hardware_systems",
    label: "Hardware systems",
    description: "Hardware, firmware, manufacturing, test, and reliability layers.",
    fit: "Good for Tesla-style organizations that ship hardware and software together at high volume.",
    rootTitle: "Chief Executive Officer",
    rootSubtitle: "Hardware-heavy, vertically integrated company",
    departments: [
      {
        key: "hardware",
        label: "Hardware",
        level: "c",
        description: "Mechanical, electrical, and system design leadership.",
        coreRoles: ["cto", "engineer", "general"],
      },
      {
        key: "firmware",
        label: "Firmware",
        level: "b",
        description: "Embedded software, hardware bring-up, and low-level integration.",
        coreRoles: ["engineer", "devops"],
      },
      {
        key: "manufacturing",
        label: "Manufacturing",
        level: "b",
        description: "Factory readiness, process design, throughput, and quality at scale.",
        coreRoles: ["general", "qa", "devops"],
      },
      {
        key: "reliability",
        label: "Reliability",
        level: "a",
        description: "Durability, field feedback, and corrective action loops.",
        coreRoles: ["devops", "qa", "engineer"],
      },
    ],
    operatingRules: [
      {
        key: "vertical",
        title: "Vertically integrated flow",
        description: "Design, software, manufacturing, and reliability work should stay tightly coordinated.",
      },
      {
        key: "quality",
        title: "Quality gate",
        description: "No release without test coverage, sign-off, and failure-mode review.",
      },
      {
        key: "sdd",
        title: "Traceable plan",
        description: "Every build needs a clear spec, risk review, and validation path before execution.",
      },
    ],
    seedAgents: [
      { key: "hardware", name: "Hardware Lead", role: "cto", title: "Hardware Engineering Lead", level: "c", reportsToKey: "ceo", departmentKey: "hardware" },
      { key: "firmware", name: "Firmware Lead", role: "engineer", title: "Firmware Lead", level: "b", reportsToKey: "ceo", departmentKey: "firmware" },
      { key: "manufacturing", name: "Manufacturing Lead", role: "general", title: "Manufacturing Lead", level: "b", reportsToKey: "ceo", departmentKey: "manufacturing" },
      { key: "reliability", name: "Reliability Lead", role: "devops", title: "Reliability Lead", level: "a", reportsToKey: "hardware", departmentKey: "reliability" },
      { key: "test", name: "Test Specialist", role: "qa", title: "Hardware Test Specialist", level: "specialist", reportsToKey: "hardware", departmentKey: "reliability" },
    ],
  },
  social_scale: {
    id: "social_scale",
    label: "Social scale",
    description: "Consumer product, infra, data, trust, and growth layers tuned for very large scale.",
    fit: "Good for X-style product organizations where platform reliability and audience systems matter.",
    rootTitle: "Chief Executive Officer",
    rootSubtitle: "Consumer internet at scale",
    departments: [
      {
        key: "product",
        label: "Product",
        level: "c",
        description: "Consumer features, product strategy, and prioritization.",
        coreRoles: ["pm", "ceo"],
      },
      {
        key: "infra",
        label: "Infrastructure",
        level: "c",
        description: "Platform resilience, services, deployment, and runtime safety.",
        coreRoles: ["cto", "devops", "engineer"],
      },
      {
        key: "data",
        label: "Data",
        level: "b",
        description: "Analytics, instrumentation, insights, and ranking signals.",
        coreRoles: ["general", "engineer", "researcher"],
      },
      {
        key: "trust",
        label: "Trust & safety",
        level: "b",
        description: "Policy enforcement, moderation, abuse prevention, and escalation handling.",
        coreRoles: ["general", "hr", "qa"],
      },
      {
        key: "growth",
        label: "Growth",
        level: "a",
        description: "Acquisition, activation, and experiments run under tight guardrails.",
        coreRoles: ["cmo", "general", "engineer"],
      },
    ],
    operatingRules: [
      {
        key: "scale",
        title: "Design for scale",
        description: "Assume high traffic, high blast radius, and the need for operational discipline.",
      },
      {
        key: "trust",
        title: "Trust is a product feature",
        description: "Safety and abuse prevention are first-class work, not afterthoughts.",
      },
      {
        key: "collaboration",
        title: "Collaborate through channels",
        description: "Cross-team changes should move through tasks, channels, and approvals with a clear owner.",
      },
    ],
    seedAgents: [
      { key: "product", name: "Product Lead", role: "pm", title: "Product Lead", level: "c", reportsToKey: "ceo", departmentKey: "product" },
      { key: "infra", name: "Infrastructure Lead", role: "devops", title: "Infrastructure Lead", level: "c", reportsToKey: "ceo", departmentKey: "infra" },
      { key: "data", name: "Data Lead", role: "general", title: "Data Platform Lead", level: "b", reportsToKey: "ceo", departmentKey: "data" },
      { key: "trust", name: "Trust Lead", role: "general", title: "Trust & Safety Lead", level: "b", reportsToKey: "ceo", departmentKey: "trust" },
      { key: "growth", name: "Growth Lead", role: "cmo", title: "Growth Lead", level: "a", reportsToKey: "ceo", departmentKey: "growth" },
      { key: "moderation", name: "Moderation Specialist", role: "general", title: "Moderation Specialist", level: "specialist", reportsToKey: "trust", departmentKey: "trust" },
    ],
  },
};

export function getHierarchyPresetDefinition(preset: HierarchyPreset | null | undefined): HierarchyPresetDefinition | null {
  if (!preset) return null;
  return HIERARCHY_PRESET_DEFINITIONS[preset] ?? null;
}

export function listHierarchyPresetDefinitions(): HierarchyPresetDefinition[] {
  return HIERARCHY_PRESETS.map((preset) => HIERARCHY_PRESET_DEFINITIONS[preset]);
}

export function getHierarchyPresetDepartments(preset: HierarchyPreset | null | undefined): HierarchyDepartmentDefinition[] {
  return getHierarchyPresetDefinition(preset)?.departments ?? [];
}

export function getHierarchyPresetOperatingRules(preset: HierarchyPreset | null | undefined): HierarchyOperatingRule[] {
  return getHierarchyPresetDefinition(preset)?.operatingRules ?? [];
}

export function getHierarchyPresetSeedAgents(preset: HierarchyPreset | null | undefined): HierarchySeedBlueprint[] {
  return getHierarchyPresetDefinition(preset)?.seedAgents ?? [];
}

/**
 * Find the department(s) a role belongs to within a given hierarchy preset.
 * Returns an array because a role can appear in multiple departments (e.g. "ceo" in leadership).
 */
export function getDepartmentsForRole(
  preset: HierarchyPreset | null | undefined,
  role: string,
): HierarchyDepartmentDefinition[] {
  const departments = getHierarchyPresetDepartments(preset);
  return departments.filter((d) => d.coreRoles.includes(role as AgentRole));
}

/**
 * Universal C-level role → department channel name mapping.
 * Used when the hierarchy preset doesn't explicitly map a role, or as a fallback.
 */
export const C_LEVEL_DEPARTMENT_CHANNELS: Record<string, { name: string; description: string }> = {
  ceo: { name: "Leadership", description: "Executive leadership, strategy, and cross-functional coordination" },
  coo: { name: "Operations", description: "Business operations, process optimization, and execution oversight" },
  cto: { name: "Engineering", description: "Technology, engineering, architecture, and platform decisions" },
  cfo: { name: "Finance", description: "Finance, budgeting, cost analysis, and financial planning" },
  cmo: { name: "Marketing", description: "Marketing strategy, growth, branding, and market analysis" },
  hr: { name: "People", description: "People operations, talent management, and organizational development" },
  chro: { name: "People", description: "People operations, talent management, and organizational development" },
  clo: { name: "Legal", description: "Legal affairs, compliance, contracts, and regulatory matters" },
  ciso: { name: "Security", description: "Information security, cybersecurity, and risk management" },
  cpo: { name: "Product", description: "Product strategy, roadmap, and product management" },
  cro: { name: "Revenue", description: "Revenue operations, sales strategy, and business development" },
};
