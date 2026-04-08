import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { agents, agentTeamMembers, agentTeams } from "@clawdev/db";
import { agentDelegationService } from "./agent-delegations.js";
import { agentMessageService } from "./agent-messages.js";
import { publishLiveEvent } from "./live-events.js";
import { agentHookService } from "./agent-hooks.js";
import { logger } from "../middleware/logger.js";

export function agentEscalationService(db: Db) {
  const delegations = agentDelegationService(db);
  const messaging = agentMessageService(db);
  const hookSvc = agentHookService(db);

  async function escalateToManager(
    companyId: string,
    agentId: string,
    opts: { issueId?: string; reason: string },
  ) {
    const agent = await db
      .select({ reportsTo: agents.reportsTo })
      .from(agents)
      .where(eq(agents.id, agentId))
      .then((rows) => rows[0] ?? null);

    if (!agent?.reportsTo) return null;

    const managerId = agent.reportsTo;

    const delegation = await delegations.delegate(companyId, agentId, {
      toAgentId: managerId,
      delegationType: "escalation",
      instructions: `Escalation: ${opts.reason}`,
      issueId: opts.issueId,
      metadata: { escalationReason: opts.reason, originalAgentId: agentId },
    });

    await messaging.send(companyId, {
      fromAgentId: agentId,
      toAgentId: managerId,
      messageType: "escalation",
      subject: "Escalation request",
      body: `Escalation: ${opts.reason}`,
      metadata: { delegationId: delegation.id },
    });

    publishLiveEvent({
      companyId,
      type: "escalation.created",
      payload: { agentId, managerId, reason: opts.reason },
    });

    hookSvc.fireEvent(companyId, agentId, "escalation.triggered" as any, {
      reason: opts.reason, toAgentId: managerId, issueId: opts.issueId,
    }).catch(err => logger.error({ err }, "hook fireEvent failed"));

    return delegation;
  }

  async function escalateToTeamLead(
    companyId: string,
    agentId: string,
    teamId: string,
    opts: { issueId?: string; reason: string },
  ) {
    const team = await db
      .select({ leadAgentId: agentTeams.leadAgentId })
      .from(agentTeams)
      .where(eq(agentTeams.id, teamId))
      .then((rows) => rows[0] ?? null);

    if (!team?.leadAgentId || team.leadAgentId === agentId) {
      return escalateToManager(companyId, agentId, opts);
    }

    const leadId = team.leadAgentId;

    const delegation = await delegations.delegate(companyId, agentId, {
      toAgentId: leadId,
      delegationType: "escalation",
      instructions: `Escalation: ${opts.reason}`,
      issueId: opts.issueId,
      metadata: { escalationReason: opts.reason, originalAgentId: agentId, teamId },
    });

    await messaging.send(companyId, {
      fromAgentId: agentId,
      toAgentId: leadId,
      messageType: "escalation",
      subject: "Escalation request",
      body: `Escalation: ${opts.reason}`,
      metadata: { delegationId: delegation.id },
    });

    publishLiveEvent({
      companyId,
      type: "escalation.created",
      payload: { agentId, managerId: leadId, reason: opts.reason },
    });

    hookSvc.fireEvent(companyId, agentId, "escalation.triggered" as any, {
      reason: opts.reason, toAgentId: leadId, issueId: opts.issueId,
    }).catch(err => logger.error({ err }, "hook fireEvent failed"));

    return delegation;
  }

  async function autoEscalateOnFailure(
    companyId: string,
    agentId: string,
    opts: { runId: string; issueId?: string; errorMessage?: string; failCount?: number },
  ) {
    if (opts.failCount !== undefined && opts.failCount < 3) return null;

    const reason = `Agent failed run ${opts.runId}${opts.errorMessage ? ": " + opts.errorMessage : ""}`;

    const membership = await db
      .select({ teamId: agentTeamMembers.teamId })
      .from(agentTeamMembers)
      .where(and(eq(agentTeamMembers.agentId, agentId), isNull(agentTeamMembers.removedAt)))
      .limit(1);

    if (membership.length > 0) {
      const teamId = membership[0].teamId;
      const team = await db
        .select({ leadAgentId: agentTeams.leadAgentId })
        .from(agentTeams)
        .where(eq(agentTeams.id, teamId))
        .limit(1);

      if (team.length > 0 && team[0].leadAgentId && team[0].leadAgentId !== agentId) {
        return escalateToTeamLead(companyId, agentId, teamId, {
          issueId: opts.issueId,
          reason,
        });
      }
    }

    return escalateToManager(companyId, agentId, { issueId: opts.issueId, reason });
  }

  async function autoEscalateOnTimeout(
    companyId: string,
    issueId: string,
    agentId: string,
    opts?: { timeoutMinutes?: number },
  ) {
    const reason = `Issue stale - no progress for ${opts?.timeoutMinutes ?? 60} minutes`;

    const membership = await db
      .select({ teamId: agentTeamMembers.teamId })
      .from(agentTeamMembers)
      .where(and(eq(agentTeamMembers.agentId, agentId), isNull(agentTeamMembers.removedAt)))
      .limit(1);

    if (membership.length > 0) {
      const teamId = membership[0].teamId;
      const team = await db
        .select({ leadAgentId: agentTeams.leadAgentId })
        .from(agentTeams)
        .where(eq(agentTeams.id, teamId))
        .limit(1);

      if (team.length > 0 && team[0].leadAgentId && team[0].leadAgentId !== agentId) {
        return escalateToTeamLead(companyId, agentId, teamId, { issueId, reason });
      }
    }

    return escalateToManager(companyId, agentId, { issueId, reason });
  }

  return { escalateToManager, escalateToTeamLead, autoEscalateOnFailure, autoEscalateOnTimeout };
}
