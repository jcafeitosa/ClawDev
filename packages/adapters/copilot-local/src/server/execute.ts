import path from "node:path";
import type { AdapterExecutionContext, AdapterExecutionResult } from "@clawdev/adapter-utils";
import {
  asString,
  asNumber,
  asStringArray,
  parseObject,
  buildClawDevEnv,
  redactEnvForLogs,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  readClawDevRuntimeSkillEntries,
  resolveClawDevDesiredSkillNames,
  renderTemplate,
  joinPromptSections,
  runChildProcess,
} from "@clawdev/adapter-utils/server-utils";
import { parseCopilotOutput } from "./parse.js";

function firstNonEmptyLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, runtime, config, context, onLog, onMeta, onSpawn, authToken } = ctx;

  const promptTemplate = asString(
    config.promptTemplate,
    "You are agent {{agent.id}} ({{agent.name}}). Continue your ClawDev work.",
  );
  const command = asString(config.command, "copilot");
  const model = asString(config.model, "");
  const extraArgs = (() => {
    const fromExtraArgs = asStringArray(config.extraArgs);
    if (fromExtraArgs.length > 0) return fromExtraArgs;
    return asStringArray(config.args);
  })();

  const workspaceContext = parseObject(context.clawdevWorkspace);
  const workspaceCwd = asString(workspaceContext.cwd, "");
  const workspaceSource = asString(workspaceContext.source, "");
  const workspaceStrategy = asString(workspaceContext.strategy, "");
  const workspaceId = asString(workspaceContext.workspaceId, "");
  const workspaceRepoUrl = asString(workspaceContext.repoUrl, "");
  const workspaceRepoRef = asString(workspaceContext.repoRef, "");
  const workspaceBranch = asString(workspaceContext.branchName, "");
  const workspaceWorktreePath = asString(workspaceContext.worktreePath, "");
  const agentHome = asString(workspaceContext.agentHome, "");
  const runtimeServices = Array.isArray(context.clawdevRuntimeServices)
    ? context.clawdevRuntimeServices.filter(
        (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
      )
    : [];
  const runtimePrimaryUrl = asString(context.clawdevRuntimePrimaryUrl, "");
  const configuredCwd = asString(config.cwd, "");
  const useConfiguredInsteadOfAgentHome = workspaceSource === "agent_home" && configuredCwd.length > 0;
  const effectiveWorkspaceCwd = useConfiguredInsteadOfAgentHome ? "" : workspaceCwd;
  const cwd = effectiveWorkspaceCwd || configuredCwd || process.cwd();
  const envConfig = parseObject(config.env);
  await ensureAbsoluteDirectory(cwd, { createIfMissing: true });

  const hasExplicitApiKey =
    typeof envConfig.CLAWDEV_API_KEY === "string" && envConfig.CLAWDEV_API_KEY.trim().length > 0;
  const env: Record<string, string> = { ...buildClawDevEnv(agent) };
  env.CLAWDEV_RUN_ID = runId;

  const wakeTaskId =
    (typeof context.taskId === "string" && context.taskId.trim().length > 0 && context.taskId.trim()) ||
    (typeof context.issueId === "string" && context.issueId.trim().length > 0 && context.issueId.trim()) ||
    null;
  const wakeReason =
    typeof context.wakeReason === "string" && context.wakeReason.trim().length > 0
      ? context.wakeReason.trim()
      : null;
  const wakeCommentId =
    (typeof context.wakeCommentId === "string" && context.wakeCommentId.trim().length > 0 && context.wakeCommentId.trim()) ||
    (typeof context.commentId === "string" && context.commentId.trim().length > 0 && context.commentId.trim()) ||
    null;
  const approvalId =
    typeof context.approvalId === "string" && context.approvalId.trim().length > 0
      ? context.approvalId.trim()
      : null;
  const approvalStatus =
    typeof context.approvalStatus === "string" && context.approvalStatus.trim().length > 0
      ? context.approvalStatus.trim()
      : null;
  const linkedIssueIds = Array.isArray(context.issueIds)
    ? context.issueIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  if (wakeTaskId) env.CLAWDEV_TASK_ID = wakeTaskId;
  if (wakeReason) env.CLAWDEV_WAKE_REASON = wakeReason;
  if (wakeCommentId) env.CLAWDEV_WAKE_COMMENT_ID = wakeCommentId;
  if (approvalId) env.CLAWDEV_APPROVAL_ID = approvalId;
  if (approvalStatus) env.CLAWDEV_APPROVAL_STATUS = approvalStatus;
  if (linkedIssueIds.length > 0) env.CLAWDEV_LINKED_ISSUE_IDS = linkedIssueIds.join(",");
  if (effectiveWorkspaceCwd) env.CLAWDEV_WORKSPACE_CWD = effectiveWorkspaceCwd;
  if (workspaceSource) env.CLAWDEV_WORKSPACE_SOURCE = workspaceSource;
  if (workspaceStrategy) env.CLAWDEV_WORKSPACE_STRATEGY = workspaceStrategy;
  if (workspaceId) env.CLAWDEV_WORKSPACE_ID = workspaceId;
  if (workspaceRepoUrl) env.CLAWDEV_WORKSPACE_REPO_URL = workspaceRepoUrl;
  if (workspaceRepoRef) env.CLAWDEV_WORKSPACE_REPO_REF = workspaceRepoRef;
  if (workspaceBranch) env.CLAWDEV_WORKSPACE_BRANCH = workspaceBranch;
  if (workspaceWorktreePath) env.CLAWDEV_WORKSPACE_WORKTREE_PATH = workspaceWorktreePath;
  if (agentHome) env.AGENT_HOME = agentHome;
  if (runtimeServices.length > 0) env.CLAWDEV_RUNTIME_SERVICES_JSON = JSON.stringify(runtimeServices);
  if (runtimePrimaryUrl) env.CLAWDEV_RUNTIME_PRIMARY_URL = runtimePrimaryUrl;

  for (const [k, v] of Object.entries(envConfig)) {
    if (typeof v === "string") env[k] = v;
  }
  if (!hasExplicitApiKey && authToken) {
    env.CLAWDEV_API_KEY = authToken;
  }
  const effectiveEnv = Object.fromEntries(
    Object.entries({ ...process.env, ...env }).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  const runtimeEnv = ensurePathInEnv(effectiveEnv);
  await ensureCommandResolvable(command, cwd, runtimeEnv);

  const timeoutSec = asNumber(config.timeoutSec, 0);
  const graceSec = asNumber(config.graceSec, 20);

  const runtimeSessionParams = parseObject(runtime.sessionParams);
  const runtimeSessionId = asString(runtimeSessionParams.sessionId, runtime.sessionId ?? "");
  const runtimeSessionCwd = asString(runtimeSessionParams.cwd, "");
  const canResumeSession =
    runtimeSessionId.length > 0 &&
    (runtimeSessionCwd.length === 0 || path.resolve(runtimeSessionCwd) === path.resolve(cwd));
  const sessionId = canResumeSession ? runtimeSessionId : null;
  if (runtimeSessionId && !canResumeSession) {
    await onLog(
      "stdout",
      `[clawdev] Copilot session "${runtimeSessionId}" was saved for cwd "${runtimeSessionCwd}" and will not be resumed in "${cwd}".\n`,
    );
  }

  const templateData = {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId, source: "on_demand" },
    context,
  };
  const renderedPrompt = renderTemplate(promptTemplate, templateData);
  const sessionHandoffNote = asString(context.clawdevSessionHandoffMarkdown, "").trim();
  const prompt = joinPromptSections([
    sessionHandoffNote,
    renderedPrompt,
  ]);

  const buildArgs = (resumeSessionId: string | null) => {
    const args: string[] = [];
    if (model) args.push("--model", model);
    if (extraArgs.length > 0) args.push(...extraArgs);
    if (resumeSessionId) args.push("--session", resumeSessionId);
    args.push("-");
    return args;
  };

  const runAttempt = async (resumeSessionId: string | null) => {
    const args = buildArgs(resumeSessionId);
    if (onMeta) {
      await onMeta({
        adapterType: "copilot_local",
        command,
        cwd,
        commandArgs: args.map((value, idx) => {
          if (idx === args.length - 1 && value !== "-") return `<prompt ${prompt.length} chars>`;
          return value;
        }),
        env: redactEnvForLogs(env),
        prompt,
        context,
      });
    }

    const proc = await runChildProcess(runId, command, args, {
      cwd,
      env,
      stdin: prompt,
      timeoutSec,
      graceSec,
      onSpawn,
      onLog,
    });
    return {
      proc,
      parsed: parseCopilotOutput(proc.stdout),
    };
  };

  const toResult = (
    attempt: {
      proc: { exitCode: number | null; signal: string | null; timedOut: boolean; stdout: string; stderr: string };
      parsed: ReturnType<typeof parseCopilotOutput>;
    },
  ): AdapterExecutionResult => {
    if (attempt.proc.timedOut) {
      return {
        exitCode: attempt.proc.exitCode,
        signal: attempt.proc.signal,
        timedOut: true,
        errorMessage: `Timed out after ${timeoutSec}s`,
      };
    }

    const resolvedSessionId = attempt.parsed.sessionId ?? runtimeSessionId ?? runtime.sessionId ?? null;
    const resolvedSessionParams = resolvedSessionId
      ? ({
        sessionId: resolvedSessionId,
        cwd,
        ...(workspaceId ? { workspaceId } : {}),
        ...(workspaceRepoUrl ? { repoUrl: workspaceRepoUrl } : {}),
        ...(workspaceRepoRef ? { repoRef: workspaceRepoRef } : {}),
      } as Record<string, unknown>)
      : null;
    const parsedError = typeof attempt.parsed.errorMessage === "string" ? attempt.parsed.errorMessage.trim() : "";
    const stderrLine = firstNonEmptyLine(attempt.proc.stderr);
    const fallbackErrorMessage =
      parsedError ||
      stderrLine ||
      `Copilot exited with code ${attempt.proc.exitCode ?? -1}`;

    return {
      exitCode: attempt.proc.exitCode,
      signal: attempt.proc.signal,
      timedOut: false,
      errorMessage:
        (attempt.proc.exitCode ?? 0) === 0
          ? null
          : fallbackErrorMessage,
      usage: attempt.parsed.usage,
      sessionId: resolvedSessionId,
      sessionParams: resolvedSessionParams,
      sessionDisplayId: resolvedSessionId,
      provider: "github",
      biller: "github",
      model: model || "copilot",
      billingType: "subscription",
      costUsd: null,
      resultJson: {
        stdout: attempt.proc.stdout,
        stderr: attempt.proc.stderr,
      },
      summary: attempt.parsed.summary,
    };
  };

  const initial = await runAttempt(sessionId);
  return toResult(initial);
}
