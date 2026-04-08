import fs from "fs/promises";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { readFile } from "fs/promises";
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
import { classifyCopilotError, parseCopilotOutput } from "./parse.js";

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create a tmpdir with `.claude/skills/` (Copilot uses the same skills layout
 * as Claude Code) containing symlinks to ClawDev skills, so `--add-dir` makes
 * the Copilot CLI discover them as registered skills.
 */
async function buildSkillsDir(config: Record<string, unknown>): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "clawdev-copilot-skills-"));
  const target = path.join(tmp, ".claude", "skills");
  await fs.mkdir(target, { recursive: true });
  const availableEntries = await readClawDevRuntimeSkillEntries(config, __moduleDir);
  const desiredNames = new Set(
    resolveClawDevDesiredSkillNames(config, availableEntries),
  );
  for (const entry of availableEntries) {
    if (!desiredNames.has(entry.key)) continue;
    await fs.symlink(
      entry.source,
      path.join(target, entry.runtimeName),
    );
  }
  return tmp;
}

function firstNonEmptyLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function mapErrorCodeForResult(
  parsedErrorCode: ReturnType<typeof classifyCopilotError>,
): "quota_exceeded" | "auth_required" | "session_not_found" | "model_unavailable" | "runtime_extract_failed" | "rate_limited" | undefined {
  if (!parsedErrorCode) return undefined;
  return parsedErrorCode;
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, runtime, config, context, onLog, onMeta, onSpawn, authToken } = ctx;

  const promptTemplate = asString(
    config.promptTemplate,
    "You are agent {{agent.id}} ({{agent.name}}). Continue your ClawDev work.",
  );
  const command = asString(config.command, "copilot");
  const rawModel = asString(config.model, "");
  const [model, modelEffort] = rawModel.includes(":") ? rawModel.split(":", 2) : [rawModel, ""];
  const extraArgs = (() => {
    const fromExtraArgs = asStringArray(config.extraArgs);
    if (fromExtraArgs.length > 0) return fromExtraArgs;
    return asStringArray(config.args);
  })();

  const instructionsFilePath = asString(config.instructionsFilePath, "");
  const configDir = asString(config.configDir, "");
  const agent_name = asString(config.agent, "");
  const autopilot = config.autopilot === true;
  const maxAutopilotContinues = asNumber(config.maxAutopilotContinues, 0);
  const noAskUser = config.noAskUser === true;
  const noCustomInstructions = config.noCustomInstructions === true;
  const experimental = config.experimental === true;
  const continueSession = config.continueSession === true;
  const disableParallelToolsExecution = config.disableParallelToolsExecution === true;
  const disallowTempDir = config.disallowTempDir === true;
  const enableReasoningSummaries = config.enableReasoningSummaries === true;
  const stream = asString(config.stream, "");
  const sharePath = asString(config.sharePath, "");
  const shareGist = config.shareGist === true;
  const logLevel = asString(config.logLevel, "");
  const logDir = asString(config.logDir, "");
  const pluginDirs = asStringArray(config.pluginDirs);
  const yolo = config.yolo !== false; // default true
  const allowAllTools = config.allowAllTools === true;
  const allowAllPaths = config.allowAllPaths === true;
  const allowAllUrls = config.allowAllUrls === true;
  const allowTools = asStringArray(config.allowTools);
  const denyTools = asStringArray(config.denyTools);
  const allowUrls = asStringArray(config.allowUrls);
  const denyUrls = asStringArray(config.denyUrls);
  const availableTools = asStringArray(config.availableTools);
  const excludedTools = asStringArray(config.excludedTools);
  const addDirs = asStringArray(config.addDirs);
  const disableBuiltinMcps = config.disableBuiltinMcps === true;
  const disableMcpServers = asStringArray(config.disableMcpServers);
  const addGithubMcpTools = asStringArray(config.addGithubMcpTools);
  const addGithubMcpToolsets = asStringArray(config.addGithubMcpToolsets);
  const enableAllGithubMcpTools = config.enableAllGithubMcpTools === true;
  const additionalMcpConfig = asString(config.additionalMcpConfig, "");
  const secretEnvVars = asStringArray(config.secretEnvVars);

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
  const env: Record<string, string> = { ...buildClawDevEnv(agent, context) };
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
  const providerBaseUrl = asString(config.providerBaseUrl, "");
  const providerType = asString(config.providerType, "");
  const providerApiKey = asString(config.providerApiKey, "");
  const providerModel = asString(config.providerModel, "");
  if (providerBaseUrl) env.COPILOT_PROVIDER_BASE_URL = providerBaseUrl;
  if (providerType) env.COPILOT_PROVIDER_TYPE = providerType;
  if (providerApiKey) env.COPILOT_PROVIDER_API_KEY = providerApiKey;
  if (providerModel) env.COPILOT_MODEL = providerModel;

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

  let instructionsPrefix = "";
  if (instructionsFilePath) {
    try {
      instructionsPrefix = await readFile(instructionsFilePath, "utf8");
    } catch { /* ignore missing file */ }
  }

  // Inject ClawDev skill content into the prompt so the agent knows how to
  // use the API (hire_agent, create_issue, etc.) — Copilot CLI doesn't
  // support Claude Code's skill system natively.
  let skillsContent = "";
  try {
    const entries = await readClawDevRuntimeSkillEntries(config, __moduleDir);
    const desiredNames = new Set(resolveClawDevDesiredSkillNames(config, entries));
    await onLog("stderr", `[clawdev-copilot] Skills: moduleDir=${__moduleDir}, entries=${entries.length}, desired=${desiredNames.size}, keys=[${entries.map(e => e.key).join(", ")}]\n`);
    for (const entry of entries) {
      if (!desiredNames.has(entry.key)) continue;
      try {
        const md = await readFile(path.join(entry.source, "SKILL.md"), "utf8");
        if (md.trim()) {
          skillsContent += `\n\n---\n## Skill: ${entry.runtimeName}\n\n${md.trim()}\n`;
          await onLog("stderr", `[clawdev-copilot] Loaded skill: ${entry.runtimeName} (${md.length} chars)\n`);
        }
      } catch (err) {
        await onLog("stderr", `[clawdev-copilot] Failed to load skill ${entry.runtimeName}: ${err}\n`);
      }
    }
  } catch (err) {
    await onLog("stderr", `[clawdev-copilot] Skill loading error: ${err}\n`);
  }
  await onLog("stderr", `[clawdev-copilot] Total skills content: ${skillsContent.length} chars\n`);

  const prompt = joinPromptSections([
    instructionsPrefix,
    skillsContent,
    sessionHandoffNote,
    renderedPrompt,
  ]);

  const effort = modelEffort || asString(config.effort, "");

  // Mount ClawDev skills so the agent can use hire_agent, create_issue, etc.
  const skillsDir = await buildSkillsDir(config);

  const buildArgs = (resumeSessionId: string | null) => {
    const args: string[] = ["-p", prompt, "--output-format", "json"];

    // Permissions
    if (yolo) {
      args.push("--yolo");
    } else {
      if (allowAllTools) args.push("--allow-all-tools");
      if (allowAllPaths) args.push("--allow-all-paths");
      if (allowAllUrls) args.push("--allow-all-urls");
    }
    for (const t of allowTools) args.push("--allow-tool", t);
    for (const t of denyTools) args.push("--deny-tool", t);
    for (const u of allowUrls) args.push("--allow-url", u);
    for (const u of denyUrls) args.push("--deny-url", u);
    if (availableTools.length > 0) args.push("--available-tools", ...availableTools);
    if (excludedTools.length > 0) args.push("--excluded-tools", ...excludedTools);

    // Model and effort
    if (model) args.push("--model", model);
    if (effort) args.push("--effort", effort);

    // Agent behavior
    if (agent_name) args.push("--agent", agent_name);
    if (autopilot) args.push("--autopilot");
    if (maxAutopilotContinues > 0) args.push("--max-autopilot-continues", String(maxAutopilotContinues));
    if (noAskUser) args.push("--no-ask-user");
    if (noCustomInstructions) args.push("--no-custom-instructions");
    if (experimental) args.push("--experimental");
    if (continueSession) args.push("--continue");
    if (disableParallelToolsExecution) args.push("--disable-parallel-tools-execution");
    if (disallowTempDir) args.push("--disallow-temp-dir");
    if (enableReasoningSummaries) args.push("--enable-reasoning-summaries");
    if (stream === "on" || stream === "off") args.push("--stream", stream);
    if (sharePath) args.push("--share", sharePath);
    if (shareGist) args.push("--share-gist");
    if (logLevel) args.push("--log-level", logLevel);
    if (logDir) args.push("--log-dir", logDir);

    // Config
    if (configDir) args.push("--config-dir", configDir);

    // Directories (internal skills dir always included first)
    args.push("--add-dir", skillsDir);
    for (const d of addDirs) args.push("--add-dir", d);
    for (const pluginDir of pluginDirs) args.push("--plugin-dir", pluginDir);

    // MCP
    if (disableBuiltinMcps) args.push("--disable-builtin-mcps");
    for (const s of disableMcpServers) args.push("--disable-mcp-server", s);
    for (const t of addGithubMcpTools) args.push("--add-github-mcp-tool", t);
    for (const ts of addGithubMcpToolsets) args.push("--add-github-mcp-toolset", ts);
    if (enableAllGithubMcpTools) args.push("--enable-all-github-mcp-tools");
    if (additionalMcpConfig) args.push("--additional-mcp-config", additionalMcpConfig);

    // Security
    if (secretEnvVars.length > 0) args.push("--secret-env-vars", secretEnvVars.join(","));

    // Extra args and session
    if (extraArgs.length > 0) args.push(...extraArgs);
    if (resumeSessionId) args.push("--resume", resumeSessionId);

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
          if (idx === 1 && value === prompt) return `<prompt ${prompt.length} chars>`;
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
      stdin: "",
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
    const classifiedError = classifyCopilotError(`${parsedError}\n${attempt.proc.stderr}`);
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
          : classifiedError === "quota_exceeded" && attempt.parsed.quotaError
            ? `Copilot quota exceeded: ${attempt.parsed.quotaError.message}`
            : fallbackErrorMessage,
      errorCode: mapErrorCodeForResult(classifiedError),
      usage: attempt.parsed.usage,
      sessionId: resolvedSessionId,
      sessionParams: resolvedSessionParams,
      sessionDisplayId: resolvedSessionId,
      provider: providerBaseUrl ? (providerType || "custom") : "github",
      biller: providerBaseUrl ? (providerType || "custom") : "github",
      model: attempt.parsed.model || model || null,
      billingType: providerBaseUrl ? "api" : "subscription",
      costUsd: null,
      resultJson: {
        stdout: attempt.proc.stdout,
        stderr: attempt.proc.stderr,
        premiumRequests: attempt.parsed.premiumRequests,
        totalApiDurationMs: attempt.parsed.totalApiDurationMs,
        sessionDurationMs: attempt.parsed.sessionDurationMs,
        codeChanges: attempt.parsed.codeChanges,
        quotaError: attempt.parsed.quotaError,
      },
      summary: attempt.parsed.summary,
    };
  };

  try {
    const initial = await runAttempt(sessionId);
    const initialResult = toResult(initial);
    if (sessionId && initialResult.errorCode === "session_not_found") {
      await onLog(
        "stderr",
        `[clawdev] Copilot session "${sessionId}" is no longer valid; retrying without resume.\n`,
      );
      const retry = await runAttempt(null);
      return toResult(retry);
    }
    return initialResult;
  } finally {
    // Cleanup temp skills directory
    fs.rm(skillsDir, { recursive: true, force: true }).catch(() => {});
  }
}
