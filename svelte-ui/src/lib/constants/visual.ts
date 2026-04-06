export type VisualToken = {
  label: string;
  hex: string;
  dotClass: string;
  badgeClass: string;
};

export const DEFAULT_ENTITY_COLOR = "#3b82f6";

export const CHART_SERIES_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#f59e0b",
] as const;

export const ISSUE_STATUS_VISUALS: Record<string, VisualToken> = {
  backlog: {
    label: "Backlog",
    hex: "#64748b",
    dotClass: "bg-zinc-500",
    badgeClass: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
  },
  todo: {
    label: "To Do",
    hex: "#2563eb",
    dotClass: "bg-[#2563EB]",
    badgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  },
  in_progress: {
    label: "In Progress",
    hex: "#f97316",
    dotClass: "bg-[#F97316]",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  in_review: {
    label: "In Review",
    hex: "#8b5cf6",
    dotClass: "bg-purple-500",
    badgeClass: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  },
  blocked: {
    label: "Blocked",
    hex: "#ef4444",
    dotClass: "bg-[#EF4444]",
    badgeClass: "bg-red-500/15 text-red-700 dark:text-red-400",
  },
  done: {
    label: "Done",
    hex: "#10b981",
    dotClass: "bg-[#10B981]",
    badgeClass: "bg-green-500/15 text-green-700 dark:text-green-400",
  },
  cancelled: {
    label: "Cancelled",
    hex: "#6b7280",
    dotClass: "bg-zinc-600",
    badgeClass: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
  },
};

export const ISSUE_STATUS_ORDER: string[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
];

export const PRIORITY_VISUALS: Record<string, VisualToken> = {
  critical: {
    label: "P0",
    hex: "#ef4444",
    dotClass: "bg-[#EF4444]",
    badgeClass: "text-[#EF4444] bg-red-500/15 border-red-500/30",
  },
  high: {
    label: "P1",
    hex: "#f97316",
    dotClass: "bg-[#F97316]",
    badgeClass: "text-[#F97316] bg-orange-500/15 border-orange-500/30",
  },
  medium: {
    label: "P2",
    hex: "#f59e0b",
    dotClass: "bg-[#F59E0B]",
    badgeClass: "text-[#F59E0B] bg-yellow-500/15 border-yellow-500/30",
  },
  low: {
    label: "P3",
    hex: "#64748b",
    dotClass: "bg-zinc-500",
    badgeClass: "text-muted-foreground bg-zinc-500/15 border-zinc-500/30",
  },
};

export const PRIORITY_ORDER: string[] = ["critical", "high", "medium", "low"];

export const STATUS_BADGE_CLASSES: Record<string, string> = {
  // Issue / task statuses
  open: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  in_review: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  done: "bg-green-500/15 text-green-700 dark:text-green-400",
  closed: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
  blocked: "bg-red-500/15 text-red-700 dark:text-red-400",
  // Agent statuses
  active: "bg-green-500/15 text-green-700 dark:text-green-400",
  idle: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
  paused: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  terminated: "bg-red-500/15 text-red-700 dark:text-red-400",
  // Run statuses
  queued: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
  running: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  completed: "bg-green-500/15 text-green-700 dark:text-green-400",
  failed: "bg-red-500/15 text-red-700 dark:text-red-400",
  cancelled: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
  // Approval statuses
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  approved: "bg-green-500/15 text-green-700 dark:text-green-400",
  rejected: "bg-red-500/15 text-red-700 dark:text-red-400",
  // Routine statuses
  enabled: "bg-green-500/15 text-green-700 dark:text-green-400",
  disabled: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
};

export const AGENT_STATUS_DOT_CLASSES: Record<string, string> = {
  idle: "bg-emerald-500",
  running: "bg-blue-500",
  paused: "bg-yellow-500",
  error: "bg-red-500",
  terminated: "bg-zinc-500",
  pending_approval: "bg-amber-400",
};
