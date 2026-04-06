export interface AgentTeam {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  leadAgentId: string | null;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentTeamMember {
  id: string;
  teamId: string;
  agentId: string;
  role: string;
  joinedAt: Date;
  removedAt: Date | null;
  addedByAgentId: string | null;
  addedByUserId: string | null;
}

export interface AgentTeamDetail extends AgentTeam {
  members: (AgentTeamMember & { agentName: string; agentRole: string; agentStatus: string })[];
  memberCount: number;
  taskCounts: { pending: number; inProgress: number; completed: number };
}

export interface AgentTeamListItem extends AgentTeam {
  memberCount: number;
  leadAgentName: string | null;
}

export interface AgentMessage {
  id: string;
  companyId: string;
  fromAgentId: string;
  toAgentId: string | null;
  toTeamId: string | null;
  threadId: string | null;
  parentMessageId: string | null;
  messageType: AgentMessageType;
  subject: string | null;
  body: string;
  metadata: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}

export type AgentMessageType =
  | "chat"
  | "delegation"
  | "consultation"
  | "review_request"
  | "escalation"
  | "status_update"
  | "decision";

export interface AgentMessageWithSender extends AgentMessage {
  fromAgentName: string;
  fromAgentRole: string;
}

export interface TeamTask {
  id: string;
  teamId: string;
  companyId: string;
  issueId: string | null;
  title: string;
  description: string | null;
  status: TeamTaskStatus;
  assignedAgentId: string | null;
  claimedByAgentId: string | null;
  createdByAgentId: string;
  priority: string;
  dependsOnTaskIds: string[];
  metadata: Record<string, unknown>;
  claimedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export type TeamTaskStatus =
  | "pending"
  | "claimed"
  | "in_progress"
  | "completed"
  | "blocked"
  | "cancelled";

export interface TeamTaskWithAgent extends TeamTask {
  assignedAgentName: string | null;
  claimedByAgentName: string | null;
  createdByAgentName: string;
}

export interface AgentDelegation {
  id: string;
  companyId: string;
  fromAgentId: string;
  toAgentId: string;
  issueId: string | null;
  teamTaskId: string | null;
  delegationType: DelegationType;
  status: DelegationStatus;
  instructions: string;
  result: string | null;
  metadata: Record<string, unknown>;
  acceptedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export type DelegationType = "task" | "review" | "consultation" | "escalation";
export type DelegationStatus = "pending" | "accepted" | "rejected" | "completed" | "cancelled";

export interface AgentDelegationWithAgents extends AgentDelegation {
  fromAgentName: string;
  toAgentName: string;
}
