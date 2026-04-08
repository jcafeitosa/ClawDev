import { and, eq, lt } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { approvals, agents } from "@clawdev/db";
import { logger as baseLogger } from "../middleware/logger.js";

const logger = baseLogger.child({ service: "approval-auto-approve" });

const AUTO_APPROVE_DELAY_MS = 60_000; // 1 minute
const TICK_INTERVAL_MS = 15_000; // check every 15 seconds

export function approvalAutoApproveService(db: Db) {
  let intervalId: ReturnType<typeof setInterval> | null = null;

  async function tick() {
    try {
      const cutoff = new Date(Date.now() - AUTO_APPROVE_DELAY_MS);

      // Find pending hire_agent approvals older than 1 minute
      const staleApprovals = await db
        .select({
          id: approvals.id,
          companyId: approvals.companyId,
          type: approvals.type,
          createdAt: approvals.createdAt,
        })
        .from(approvals)
        .where(
          and(
            eq(approvals.status, "pending"),
            eq(approvals.type, "hire_agent"),
            lt(approvals.createdAt, cutoff),
          ),
        );

      if (staleApprovals.length === 0) return;

      logger.info(
        { count: staleApprovals.length },
        "found stale hire approvals for CEO auto-approve",
      );

      // Import dynamically to avoid circular deps
      const { approvalService } = await import("./approvals.js");
      const svc = approvalService(db);

      for (const approval of staleApprovals) {
        try {
          // Find CEO agent for this company
          const [ceoAgent] = await db
            .select({ id: agents.id, name: agents.name })
            .from(agents)
            .where(
              and(
                eq(agents.companyId, approval.companyId),
                eq(agents.role, "ceo"),
              ),
            )
            .limit(1);

          const decidedBy = ceoAgent
            ? `ceo:${ceoAgent.id}`
            : "system:auto-approve";

          const decisionNote = ceoAgent
            ? `Auto-approved by CEO (${ceoAgent.name}) after 1 minute timeout — owner did not respond`
            : "Auto-approved by system after 1 minute timeout — no CEO found";

          // approve(id, decidedByUserId, decisionNote)
          const { applied } = await svc.approve(
            approval.id,
            decidedBy,
            decisionNote,
          );

          if (applied) {
            logger.info(
              {
                approvalId: approval.id,
                companyId: approval.companyId,
                decidedBy,
              },
              "CEO auto-approved stale hire approval",
            );
          }
        } catch (err) {
          logger.error(
            { err, approvalId: approval.id },
            "failed to auto-approve stale approval",
          );
        }
      }
    } catch (err) {
      logger.error({ err }, "approval auto-approve tick failed");
    }
  }

  function start() {
    if (intervalId) return;
    logger.info(
      { delayMs: AUTO_APPROVE_DELAY_MS, tickMs: TICK_INTERVAL_MS },
      "starting approval auto-approve timer",
    );
    intervalId = setInterval(tick, TICK_INTERVAL_MS);
    // Run first tick immediately
    void tick();
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      logger.info("stopped approval auto-approve timer");
    }
  }

  return { start, stop, tick };
}
