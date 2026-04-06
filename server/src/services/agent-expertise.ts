import { eq, sql, and } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { agents, companySkills } from "@clawdev/db";
import { agentMessageService } from "./agent-messages.js";

export function agentExpertiseService(db: Db) {
  async function findExperts(
    companyId: string,
    opts: { skills: string[]; limit?: number },
  ) {
    const { skills, limit = 5 } = opts;

    if (skills.length === 0) {
      return [];
    }

    // Build parameterized ILIKE conditions for each skill
    const skillConditions = skills.map(
      (skill) =>
        sql`(${agents.capabilities} ILIKE ${"%" + skill + "%"} OR ${agents.role} ILIKE ${"%" + skill + "%"})`,
    );

    // Count how many skills each agent matches for sorting
    const matchCountExpr = sql<number>`(${sql.join(
      skills.map(
        (skill) =>
          sql`CASE WHEN (${agents.capabilities} ILIKE ${"%" + skill + "%"} OR ${agents.role} ILIKE ${"%" + skill + "%"}) THEN 1 ELSE 0 END`,
      ),
      sql` + `,
    )})`;

    const rows = await db
      .select({
        agent: agents,
        matchCount: matchCountExpr.as("match_count"),
      })
      .from(agents)
      .where(
        and(
          eq(agents.companyId, companyId),
          sql`(${sql.join(skillConditions, sql` OR `)})`,
        ),
      )
      .orderBy(sql`match_count DESC`)
      .limit(limit);

    return rows;
  }

  async function requestConsultation(
    companyId: string,
    fromAgentId: string,
    opts: {
      question: string;
      context?: string;
      skillTags?: string[];
    },
  ) {
    const skills = opts.skillTags ?? [];
    const experts = await findExperts(companyId, { skills, limit: 1 });

    if (experts.length === 0) {
      return { expert: null, message: null };
    }

    const expert = experts[0];
    const messaging = agentMessageService(db);

    const body = opts.context
      ? `${opts.question}\n\nContext:\n${opts.context}`
      : opts.question;

    const message = await messaging.send(companyId, {
      fromAgentId,
      toAgentId: expert.agent.id,
      messageType: "consultation",
      subject: opts.question.slice(0, 120),
      body,
      metadata: { skillTags: opts.skillTags },
    });

    return { expert: expert.agent, message };
  }

  return { findExperts, requestConsultation };
}
