/** Shared types for the kitchen sink plugin UI. */

export type CompanyRecord = { id: string; name: string; issuePrefix?: string | null; status?: string | null };
export type ProjectRecord = { id: string; name: string; status?: string; path?: string | null };
export type IssueRecord = { id: string; title: string; status: string; projectId?: string | null };
export type GoalRecord = { id: string; title: string; status: string };
export type AgentRecord = { id: string; name: string; status: string };
export type HostIssueRecord = { id: string; title: string; status: string; priority?: string | null; createdAt?: string };
export type HostHeartbeatRunRecord = { id: string; status: string; invocationSource?: string | null; triggerDetail?: string | null; createdAt?: string; startedAt?: string | null; finishedAt?: string | null; agentId?: string | null };
export type HostLiveRunRecord = HostHeartbeatRunRecord & { agentName?: string | null; issueId?: string | null };

export type OverviewData = {
  pluginId: string;
  version: string;
  capabilities: string[];
  config: Record<string, unknown>;
  runtimeLaunchers: Array<{ id: string; displayName: string; placementZone: string }>;
  recentRecords: Array<{ id: string; source: string; message: string; createdAt: string; level: string; data?: unknown }>;
  counts: { companies: number; projects: number; issues: number; goals: number; agents: number; entities: number };
  lastJob: unknown;
  lastWebhook: unknown;
  lastProcessResult: unknown;
  streamChannels: Record<string, string>;
  safeCommands: Array<{ key: string; label: string; description: string }>;
  manifest: {
    jobs: Array<{ jobKey: string; displayName: string; schedule?: string }>;
    webhooks: Array<{ endpointKey: string; displayName: string }>;
    tools: Array<{ name: string; displayName: string; description: string }>;
  };
};

export type EntityRecord = { id: string; entityType: string; title: string | null; status: string | null; scopeKind: string; scopeId: string | null; externalId: string | null; data: unknown };

export type StateValueData = { scope: { scopeKind: string; scopeId?: string; namespace?: string; stateKey: string }; value: unknown };

export type PluginConfigData = {
  showSidebarEntry?: boolean;
  showSidebarPanel?: boolean;
  showProjectSidebarItem?: boolean;
  showCommentAnnotation?: boolean;
  showCommentContextMenuItem?: boolean;
  enableWorkspaceDemos?: boolean;
  enableProcessDemos?: boolean;
};

export type CommentContextData = {
  commentId: string;
  issueId: string;
  preview: string;
  length: number;
  copiedCount: number;
} | null;

export type ProcessResult = {
  commandKey: string;
  cwd: string;
  code: number | null;
  stdout: string;
  stderr: string;
  startedAt: string;
  finishedAt: string;
};
