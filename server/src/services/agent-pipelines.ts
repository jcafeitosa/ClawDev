import { and, eq, desc, sql } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { agentPipelines, pipelineExecutions, agents } from "@clawdev/db";
import type { PipelineStep, StepResult } from "@clawdev/db";
import { publishLiveEvent } from "./live-events.js";
import { agentDelegationService } from "./agent-delegations.js";

export function agentPipelineService(db: Db) {
  const delegations = agentDelegationService(db);

  // ── Pipeline CRUD ──────────────────────────────────────────────────

  async function list(companyId: string, opts?: { status?: string; teamId?: string }) {
    const conditions = [eq(agentPipelines.companyId, companyId)];
    if (opts?.status) conditions.push(eq(agentPipelines.status, opts.status));
    if (opts?.teamId) conditions.push(eq(agentPipelines.teamId, opts.teamId));

    return db
      .select({
        pipeline: agentPipelines,
        executionCount: sql<number>`(
          SELECT count(*) FROM pipeline_executions pe
          WHERE pe.pipeline_id = ${agentPipelines.id}
        )`.as("execution_count"),
        lastRunAt: sql<string | null>`(
          SELECT max(pe.started_at) FROM pipeline_executions pe
          WHERE pe.pipeline_id = ${agentPipelines.id}
        )`.as("last_run_at"),
      })
      .from(agentPipelines)
      .where(and(...conditions))
      .orderBy(desc(agentPipelines.updatedAt));
  }

  async function getById(pipelineId: string) {
    const rows = await db
      .select()
      .from(agentPipelines)
      .where(eq(agentPipelines.id, pipelineId));
    return rows[0] ?? null;
  }

  async function create(
    companyId: string,
    data: {
      name: string;
      description?: string;
      steps: PipelineStep[];
      triggerType?: string;
      teamId?: string;
      metadata?: Record<string, unknown>;
    },
    createdBy?: { agentId?: string; userId?: string },
  ) {
    const [pipeline] = await db
      .insert(agentPipelines)
      .values({
        companyId,
        name: data.name,
        description: data.description,
        steps: data.steps,
        triggerType: data.triggerType ?? "manual",
        teamId: data.teamId,
        createdByAgentId: createdBy?.agentId,
        createdByUserId: createdBy?.userId,
        metadata: data.metadata ?? {},
      })
      .returning();

    publishLiveEvent({
      companyId,
      type: "pipeline.created",
      payload: { pipelineId: pipeline.id, name: pipeline.name },
    });

    return pipeline;
  }

  async function update(pipelineId: string, data: Partial<{
    name: string;
    description: string;
    steps: PipelineStep[];
    triggerType: string;
    status: string;
    metadata: Record<string, unknown>;
  }>) {
    const [updated] = await db
      .update(agentPipelines)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agentPipelines.id, pipelineId))
      .returning();
    return updated ?? null;
  }

  async function remove(pipelineId: string) {
    const [deleted] = await db
      .delete(agentPipelines)
      .where(eq(agentPipelines.id, pipelineId))
      .returning();
    return deleted ?? null;
  }

  // ── Execution ──────────────────────────────────────────────────────

  async function execute(
    pipelineId: string,
    opts?: { issueId?: string; context?: Record<string, unknown>; triggeredByAgentId?: string; triggeredByUserId?: string },
  ) {
    const pipeline = await getById(pipelineId);
    if (!pipeline) return null;
    if (pipeline.status !== "active") return null;

    const steps = pipeline.steps as PipelineStep[];
    const initialResults: StepResult[] = steps.map((step, i) => ({
      stepIndex: i,
      agentId: step.agentId,
      status: step.dependsOn.length === 0 ? "running" : "pending",
      startedAt: step.dependsOn.length === 0 ? new Date().toISOString() : undefined,
    }));

    const [execution] = await db
      .insert(pipelineExecutions)
      .values({
        pipelineId,
        companyId: pipeline.companyId,
        issueId: opts?.issueId,
        triggeredByAgentId: opts?.triggeredByAgentId,
        triggeredByUserId: opts?.triggeredByUserId,
        status: "running",
        currentStep: 0,
        stepResults: initialResults,
        context: opts?.context ?? {},
      })
      .returning();

    // Create delegations for steps with no dependencies (ready to run)
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].dependsOn.length === 0) {
        await delegations.delegate(pipeline.companyId, opts?.triggeredByAgentId ?? steps[i].agentId, {
          toAgentId: steps[i].agentId,
          delegationType: "task",
          instructions: `Pipeline "${pipeline.name}" step ${i + 1}: ${steps[i].action}`,
          metadata: {
            pipelineId,
            executionId: execution.id,
            stepIndex: i,
            stepAction: steps[i].action,
            stepConfig: steps[i].config,
          },
        });
      }
    }

    publishLiveEvent({
      companyId: pipeline.companyId,
      type: "pipeline.execution.started",
      payload: { pipelineId, executionId: execution.id, pipelineName: pipeline.name },
    });

    return execution;
  }

  async function getExecution(executionId: string) {
    const rows = await db
      .select()
      .from(pipelineExecutions)
      .where(eq(pipelineExecutions.id, executionId));
    return rows[0] ?? null;
  }

  async function listExecutions(pipelineId: string, opts?: { status?: string; limit?: number }) {
    const conditions = [eq(pipelineExecutions.pipelineId, pipelineId)];
    if (opts?.status) conditions.push(eq(pipelineExecutions.status, opts.status));

    return db
      .select()
      .from(pipelineExecutions)
      .where(and(...conditions))
      .orderBy(desc(pipelineExecutions.startedAt))
      .limit(opts?.limit ?? 20);
  }

  async function handleStepResult(
    executionId: string,
    stepIndex: number,
    result: { status: "completed" | "failed"; result?: string; error?: string },
  ) {
    const execution = await getExecution(executionId);
    if (!execution || execution.status !== "running") return null;

    const pipeline = await getById(execution.pipelineId);
    if (!pipeline) return null;

    const steps = pipeline.steps as PipelineStep[];
    const stepResults = [...(execution.stepResults as StepResult[])];

    // Update the completed step
    stepResults[stepIndex] = {
      ...stepResults[stepIndex],
      status: result.status,
      result: result.result,
      error: result.error,
      completedAt: new Date().toISOString(),
    };

    // Check if any pending steps can now run
    const newlyReady: number[] = [];
    for (let i = 0; i < steps.length; i++) {
      if (stepResults[i].status !== "pending") continue;
      const deps = steps[i].dependsOn;
      const allDepsCompleted = deps.every((d) => stepResults[d]?.status === "completed");
      const anyDepFailed = deps.some((d) => stepResults[d]?.status === "failed");

      if (anyDepFailed) {
        stepResults[i] = { ...stepResults[i], status: "skipped", completedAt: new Date().toISOString() };
      } else if (allDepsCompleted) {
        stepResults[i] = { ...stepResults[i], status: "running", startedAt: new Date().toISOString() };
        newlyReady.push(i);
      }
    }

    // Determine overall status
    const allDone = stepResults.every((s) => ["completed", "failed", "skipped"].includes(s.status));
    const anyFailed = stepResults.some((s) => s.status === "failed");
    const overallStatus = allDone ? (anyFailed ? "failed" : "completed") : "running";

    const [updated] = await db
      .update(pipelineExecutions)
      .set({
        stepResults,
        currentStep: Math.max(...stepResults.filter((s) => s.status === "running").map((_, i) => i), stepIndex),
        status: overallStatus,
        completedAt: allDone ? new Date() : undefined,
        error: anyFailed ? "One or more steps failed" : undefined,
      })
      .where(eq(pipelineExecutions.id, executionId))
      .returning();

    // Create delegations for newly ready steps
    for (const i of newlyReady) {
      await delegations.delegate(pipeline.companyId, steps[stepIndex].agentId, {
        toAgentId: steps[i].agentId,
        delegationType: "task",
        instructions: `Pipeline "${pipeline.name}" step ${i + 1}: ${steps[i].action}`,
        metadata: {
          pipelineId: pipeline.id,
          executionId,
          stepIndex: i,
          stepAction: steps[i].action,
          stepConfig: steps[i].config,
          previousStepResult: result.result,
        },
      });
    }

    publishLiveEvent({
      companyId: pipeline.companyId,
      type: "pipeline.execution.updated",
      payload: {
        pipelineId: pipeline.id,
        executionId,
        stepIndex,
        stepStatus: result.status,
        overallStatus,
      },
    });

    return updated;
  }

  async function cancelExecution(executionId: string) {
    const execution = await getExecution(executionId);
    if (!execution || execution.status !== "running") return null;

    const stepResults = (execution.stepResults as StepResult[]).map((s) =>
      s.status === "pending" || s.status === "running"
        ? { ...s, status: "skipped" as const, completedAt: new Date().toISOString() }
        : s,
    );

    const [updated] = await db
      .update(pipelineExecutions)
      .set({
        status: "cancelled",
        stepResults,
        completedAt: new Date(),
      })
      .where(eq(pipelineExecutions.id, executionId))
      .returning();

    if (updated) {
      publishLiveEvent({
        companyId: updated.companyId,
        type: "pipeline.execution.updated",
        payload: { executionId, status: "cancelled" },
      });
    }

    return updated;
  }

  return {
    list,
    getById,
    create,
    update,
    remove,
    execute,
    getExecution,
    listExecutions,
    handleStepResult,
    cancelExecution,
  };
}
