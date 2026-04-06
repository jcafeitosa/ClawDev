import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AdapterExecutionContext, AdapterExecutionResult } from "@clawdev/adapter-utils";
import type { RunProcessResult } from "@clawdev/adapter-utils/server-utils";
import {
  asString,
  asNumber,
  asBoolean,
  asStringArray,
  parseObject,
  parseJson,
  buildClawDevEnv,
  readClawDevRuntimeSkillEntries,
  joinPromptSections,
  redactEnvForLogs,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  renderTemplate,
  runChildProcess,
} from "@clawdev/adapter-utils/server-utils";
import {
  parseClaudeStreamJson,
  describeClaudeFailure,
  detectClaudeLoginRequired,
  isClaudeMaxTurnsResult,
  isClaudeUnknownSessionError,
} from "./parse.js";
import { resolveClaudeDesiredSkillNames } from "./skills.js";

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));

export function normalizeClaudeModelArg(model: unknown): string | null {
  if (typeof model !== "string") return null;
  const trimmed = model.trim();
  if (!trimmed || trimmed.toLowerCase() === "auto") return null;
  return trimmed;
}

export function sanitizeClaudeExtraArgs(extraArgs: string[]): string[] {
  const sanitized: string[] = [];
  for (let i = 0; i < extraArgs.length; i += 1) {
    const arg = extraArgs[i]!;
    if (arg === "--model") {
      const next = extraArgs[i + 1];
      if (normalizeClaudeModelArg(next) === null) {
        i += 1;
        continue;
      }
      sanitized.push(arg, next!);
      i += 1;
      continue;
    }
    if (arg.startsWith("--model=")) {
      const value = arg.slice("--model=".length);
      if (normalizeClaudeModelArg(value) === null) continue;
    }
    sanitized.push(arg);
  }
  return sanitized;
}

/**
 * Create a tmpdir with `.claude/skills/` containing symlinks to skills from
 * the repo's `skills/` directory, so `--add-dir` makes Claude Code discover
 * them as proper registered skills.
 */
async function buildSkillsDir(config: Record<string, unknown>): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "clawdev-skills-"));
  const target = path.join(tmp, ".claude", "skills");
  await fs.mkdir(target, { recursive: true });
  const availableEntries = await readClawDevRuntimeSkillEntries(config, __moduleDir);
  const desiredNames = new Set(
    resolveClaudeDesiredSkillNames(
      config,
      availableEntries,
    ),
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

interface ClaudeExecutionInput {
  runId: string;
  agent: AdapterExecutionContext["agent"];
  config: Record<string, unknown>;
  context: Record<string, unknown>;
  authToken?: string;
}

interface ClaudeRuntimeConfig {
  command: string;
  cwd: string;
  workspaceId: string | null;
  workspaceRepoUrl: string | null;
  workspaceRepoRef: string | null;
  env: Record<string, string>;
  timeoutSec: number;
  graceSec: number;
  extraArgs: string[];
}

function buildLoginResult(input: {
  proc: RunProcessResult;
  loginUrl: string | null;
}) {
  return {
    exitCode: input.proc.exitCode,
    signal: input.proc.signal,
    timedOut: input.proc.timedOut,
    stdout: input.proc.stdout,
    stderr: input.proc.stderr,
    loginUrl: input.loginUrl,
  };
}

function hasNonEmptyEnvValue(env: Record<string, string>, key: string): boolean {
  const raw = env[key];
  return typeof raw === "string" && raw.trim().length > 0;
}

function resolveClaudeBillingType(env: Record<string, string>): "api" | "subscription" {
  // Claude uses API-key auth when ANTHROPIC_API_KEY is present; otherwise rely on local login/session auth.
  return hasNonEmptyEnvValue(env, "ANTHROPIC_API_KEY") ? "api" : "subscription";
}

async function buildClaudeRuntimeConfig(input: ClaudeExecutionInput): Promise<ClaudeRuntimeConfig> {
  const { runId, agent, config, context, authToken } = input;

  const command = asString(config.command, "claude");
  const workspaceContext = parseObject(context.clawdevWorkspace);
  const workspaceCwd = asString(workspaceContext.cwd, "");
  const workspaceSource = asString(workspaceContext.source, "");
  const workspaceStrategy = asString(workspaceContext.strategy, "");
  const workspaceId = asString(workspaceContext.workspaceId, "") || null;
  const workspaceRepoUrl = asString(workspaceContext.repoUrl, "") || null;
  const workspaceRepoRef = asString(workspaceContext.repoRef, "") || null;
  const workspaceBranch = asString(workspaceContext.branchName, "") || null;
  const workspaceWorktreePath = asString(workspaceContext.worktreePath, "") || null;
  const agentHome = asString(workspaceContext.agentHome, "") || null;
  const workspaceHints = Array.isArray(context.clawdevWorkspaces)
    ? context.clawdevWorkspaces.filter(
        (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
      )
    : [];
  const runtimeServiceIntents = Array.isArray(context.clawdevRuntimeServiceIntents)
    ? context.clawdevRuntimeServiceIntents.filter(
        (value): value is Record<string, unknown> => typeof value === "object" && value !== null,
      )
    : [];
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
  await ensureAbsoluteDirectory(cwd, { createIfMissing: true });

  const envConfig = parseObject(config.env);
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

  if (wakeTaskId) {
    env.CLAWDEV_TASK_ID = wakeTaskId;
  }
  if (wakeReason) {
    env.CLAWDEV_WAKE_REASON = wakeReason;
  }
  if (wakeCommentId) {
    env.CLAWDEV_WAKE_COMMENT_ID = wakeCommentId;
  }
  if (approvalId) {
    env.CLAWDEV_APPROVAL_ID = approvalId;
  }
  if (approvalStatus) {
    env.CLAWDEV_APPROVAL_STATUS = approvalStatus;
  }
  if (linkedIssueIds.length > 0) {
    env.CLAWDEV_LINKED_ISSUE_IDS = linkedIssueIds.join(",");
  }
  if (effectiveWorkspaceCwd) {
    env.CLAWDEV_WORKSPACE_CWD = effectiveWorkspaceCwd;
  }
  if (workspaceSource) {
    env.CLAWDEV_WORKSPACE_SOURCE = workspaceSource;
  }
  if (workspaceStrategy) {
    env.CLAWDEV_WORKSPACE_STRATEGY = workspaceStrategy;
  }
  if (workspaceId) {
    env.CLAWDEV_WORKSPACE_ID = workspaceId;
  }
  if (workspaceRepoUrl) {
    env.CLAWDEV_WORKSPACE_REPO_URL = workspaceRepoUrl;
  }
  if (workspaceRepoRef) {
    env.CLAWDEV_WORKSPACE_REPO_REF = workspaceRepoRef;
  }
  if (workspaceBranch) {
    env.CLAWDEV_WORKSPACE_BRANCH = workspaceBranch;
  }
  if (workspaceWorktreePath) {
    env.CLAWDEV_WORKSPACE_WORKTREE_PATH = workspaceWorktreePath;
  }
  if (agentHome) {
    env.AGENT_HOME = agentHome;
  }
  if (workspaceHints.length > 0) {
    env.CLAWDEV_WORKSPACES_JSON = JSON.stringify(workspaceHints);
  }
  if (runtimeServiceIntents.length > 0) {
    env.CLAWDEV_RUNTIME_SERVICE_INTENTS_JSON = JSON.stringify(runtimeServiceIntents);
  }
  if (runtimeServices.length > 0) {
    env.CLAWDEV_RUNTIME_SERVICES_JSON = JSON.stringify(runtimeServices);
  }
  if (runtimePrimaryUrl) {
    env.CLAWDEV_RUNTIME_PRIMARY_URL = runtimePrimaryUrl;
  }

  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") env[key] = value;
  }

  if (!hasExplicitApiKey && authToken) {
    env.CLAWDEV_API_KEY = authToken;
  }

  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });
  await ensureCommandResolvable(command, cwd, runtimeEnv);

  const timeoutSec = asNumber(config.timeoutSec, 0);
  const graceSec = asNumber(config.graceSec, 20);
  const extraArgs = (() => {
    const fromExtraArgs = asStringArray(config.extraArgs);
    if (fromExtraArgs.length > 0) return fromExtraArgs;
    return asStringArray(config.args);
  })();

  return {
    command,
    cwd,
    workspaceId,
    workspaceRepoUrl,
    workspaceRepoRef,
    env,
    timeoutSec,
    graceSec,
    extraArgs,
  };
}

export async function runClaudeLogin(input: {
  runId: string;
  agent: AdapterExecutionContext["agent"];
  config: Record<string, unknown>;
  context?: Record<string, unknown>;
  authToken?: string;
  onLog?: (stream: "stdout" | "stderr", chunk: string) => Promise<void>;
}) {
  const onLog = input.onLog ?? (async () => {});
  const runtime = await buildClaudeRuntimeConfig({
    runId: input.runId,
    agent: input.agent,
    config: input.config,
    context: input.context ?? {},
    authToken: input.authToken,
  });

  const proc = await runChildProcess(input.runId, runtime.command, ["login"], {
    cwd: runtime.cwd,
    env: runtime.env,
    timeoutSec: runtime.timeoutSec,
    graceSec: runtime.graceSec,
    onLog,
  });

  const loginMeta = detectClaudeLoginRequired({
    parsed: null,
    stdout: proc.stdout,
    stderr: proc.stderr,
  });

  return buildLoginResult({
    proc,
    loginUrl: loginMeta.loginUrl,
  });
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, runtime, config, context, onLog, onMeta, onSpawn, authToken } = ctx;

  const promptTemplate = asString(
    config.promptTemplate,
    "You are agent {{agent.id}} ({{agent.name}}). Continue your ClawDev work.",
  );
  const model = normalizeClaudeModelArg(asString(config.model, ""));
  const effort = asString(config.effort, "");
  const chrome = asBoolean(config.chrome, false);
  const maxTurns = asNumber(config.maxTurnsPerRun, 0);
  const dangerouslySkipPermissions = asBoolean(config.dangerouslySkipPermissions, false);
  const instructionsFilePath = asString(config.instructionsFilePath, "").trim();

  // Session fields
  const noSessionPersistence = config.noSessionPersistence === true;
  const forkSession = config.forkSession === true;
  const sessionName = asString(config.sessionName, "");

  // Permission fields
  const allowDangerouslySkipPermissions = config.allowDangerouslySkipPermissions === true;
  const permissionMode = asString(config.permissionMode, "");
  const allowedTools = asStringArray(config.allowedTools);
  const disallowedTools = asStringArray(config.disallowedTools);
  const tools = asStringArray(config.tools);

  // Budget fields
  const maxBudgetUsd = asNumber(config.maxBudgetUsd, 0);
  const fallbackModel = asString(config.fallbackModel, "");

  // System prompt fields
  const systemPrompt = asString(config.systemPrompt, "");
  const appendSystemPrompt = asString(config.appendSystemPrompt, "");

  // MCP fields
  const mcpConfigs = asStringArray(config.mcpConfig);
  const strictMcpConfig = config.strictMcpConfig === true;
  const pluginDirs = asStringArray(config.pluginDirs);

  // Directory fields
  const addDirs = asStringArray(config.addDirs);

  // Agent fields
  const agentName = asString(config.agent, "");

  // Advanced fields
  const bare = config.bare === true;
  const brief = config.brief === true;
  const verbose = config.verbose !== false; // default true to preserve existing behavior
  const betas = asStringArray(config.betas);
  const disableSlashCommands = config.disableSlashCommands === true;
  const jsonSchema = asString(config.jsonSchema, "");
  const instructionsFileDir = instructionsFilePath ? `${path.dirname(instructionsFilePath)}/` : "";
  const commandNotes = instructionsFilePath
    ? [
        `Injected agent instructions via --append-system-prompt-file ${instructionsFilePath} (with path directive appended)`,
      ]
    : [];

  const runtimeConfig = await buildClaudeRuntimeConfig({
    runId,
    agent,
    config,
    context,
    authToken,
  });
  const {
    command,
    cwd,
    workspaceId,
    workspaceRepoUrl,
    workspaceRepoRef,
    env,
    timeoutSec,
    graceSec,
    extraArgs,
  } = runtimeConfig;
  const sanitizedExtraArgs = sanitizeClaudeExtraArgs(extraArgs);
  const effectiveEnv = Object.fromEntries(
    Object.entries({ ...process.env, ...env }).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  const billingType = resolveClaudeBillingType(effectiveEnv);
  const skillsDir = await buildSkillsDir(config);

  // When instructionsFilePath is configured, create a combined temp file that
  // includes both the file content and the path directive, so we only need
  // --append-system-prompt-file (Claude CLI forbids using both flags together).
  let effectiveInstructionsFilePath: string | undefined = instructionsFilePath;
  if (instructionsFilePath) {
    try {
      const instructionsContent = await fs.readFile(instructionsFilePath, "utf-8");
      const pathDirective = `\nThe above agent instructions were loaded from ${instructionsFilePath}. Resolve any relative file references from ${instructionsFileDir}.`;
      const combinedPath = path.join(skillsDir, "agent-instructions.md");
      await fs.writeFile(combinedPath, instructionsContent + pathDirective, "utf-8");
      effectiveInstructionsFilePath = combinedPath;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await onLog(
        "stderr",
        `[clawdev] Warning: could not read agent instructions file "${instructionsFilePath}": ${reason}\n`,
      );
      effectiveInstructionsFilePath = undefined;
    }
  }

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
      `[clawdev] Claude session "${runtimeSessionId}" was saved for cwd "${runtimeSessionCwd}" and will not be resumed in "${cwd}".\n`,
    );
  }
  const bootstrapPromptTemplate = asString(config.bootstrapPromptTemplate, "");
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
  const renderedBootstrapPrompt =
    !sessionId && bootstrapPromptTemplate.trim().length > 0
      ? renderTemplate(bootstrapPromptTemplate, templateData).trim()
      : "";
  const sessionHandoffNote = asString(context.clawdevSessionHandoffMarkdown, "").trim();

  // Inject channel message context so the agent knows what was asked
  let channelMessageContext = "";
  const ctxWakeReason = typeof context.wakeReason === "string" ? context.wakeReason.trim() : "";
  if (ctxWakeReason === "channel_message_received") {
    const channelId = typeof context.channelId === "string" ? context.channelId : "";
    const messageId = typeof context.messageId === "string" ? context.messageId : "";
    const senderName = typeof context.senderDisplayName === "string" ? context.senderDisplayName : "someone";
    const bodyPreview = typeof context.bodyPreview === "string" ? context.bodyPreview : "";
    const channelName = typeof context.channelName === "string" ? context.channelName : "";
    channelMessageContext = [
      `## Wake Context: Channel Message`,
      `You were woken because ${senderName} sent a message${channelName ? ` in #${channelName}` : ""}.`,
      bodyPreview ? `**Message:** "${bodyPreview}"` : "",
      `**Channel ID:** ${channelId}`,
      messageId ? `**Message ID:** ${messageId}` : "",
      ``,
      `Read recent channel messages with: GET /api/channels/${channelId}/messages?limit=10`,
      `Then respond helpfully. Your stdout will be posted as a reply in the channel.`,
      `Focus on answering the question directly. Be concise and useful.`,
    ].filter(Boolean).join("\n");
  }

  const prompt = joinPromptSections([
    renderedBootstrapPrompt,
    sessionHandoffNote,
    channelMessageContext,
    renderedPrompt,
  ]);
  const promptMetrics = {
    promptChars: prompt.length,
    bootstrapPromptChars: renderedBootstrapPrompt.length,
    sessionHandoffChars: sessionHandoffNote.length,
    heartbeatPromptChars: renderedPrompt.length,
  };

  const buildClaudeArgs = (resumeSessionId: string | null) => {
    const args = ["--print", "-", "--output-format", "stream-json"];
    if (verbose) args.push("--verbose");
    if (resumeSessionId) args.push("--resume", resumeSessionId);
    if (dangerouslySkipPermissions) args.push("--dangerously-skip-permissions");
    if (chrome) args.push("--chrome");
    if (model) args.push("--model", model);
    if (effort) args.push("--effort", effort);
    if (maxTurns > 0) args.push("--max-turns", String(maxTurns));
    if (effectiveInstructionsFilePath) {
      args.push("--append-system-prompt-file", effectiveInstructionsFilePath);
    }

    // Session
    if (noSessionPersistence) args.push("--no-session-persistence");
    if (forkSession) args.push("--fork-session");
    if (sessionName) args.push("--name", sessionName);

    // Permissions
    if (allowDangerouslySkipPermissions) args.push("--allow-dangerously-skip-permissions");
    if (permissionMode) args.push("--permission-mode", permissionMode);
    for (const t of allowedTools) args.push("--allowedTools", t);
    for (const t of disallowedTools) args.push("--disallowedTools", t);
    if (tools.length > 0) args.push("--tools", ...tools);

    // Budget
    if (maxBudgetUsd > 0) args.push("--max-budget-usd", String(maxBudgetUsd));
    if (fallbackModel) args.push("--fallback-model", fallbackModel);

    // System prompts
    if (systemPrompt) args.push("--system-prompt", systemPrompt);
    if (appendSystemPrompt) args.push("--append-system-prompt", appendSystemPrompt);

    // MCP
    for (const cfg of mcpConfigs) args.push("--mcp-config", cfg);
    if (strictMcpConfig) args.push("--strict-mcp-config");
    for (const dir of pluginDirs) args.push("--plugin-dir", dir);

    // Directories (internal skills dir always included)
    args.push("--add-dir", skillsDir);
    for (const dir of addDirs) args.push("--add-dir", dir);

    // Agent
    if (agentName) args.push("--agent", agentName);

    // Advanced
    if (bare) args.push("--bare");
    if (brief) args.push("--brief");
    for (const beta of betas) args.push("--betas", beta);
    if (disableSlashCommands) args.push("--disable-slash-commands");
    if (jsonSchema) args.push("--json-schema", jsonSchema);

    if (sanitizedExtraArgs.length > 0) args.push(...sanitizedExtraArgs);
    return args;
  };

  const parseFallbackErrorMessage = (proc: RunProcessResult) => {
    const stderrLine =
      proc.stderr
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean) ?? "";

    if ((proc.exitCode ?? 0) === 0) {
      return "Failed to parse claude JSON output";
    }

    return stderrLine
      ? `Claude exited with code ${proc.exitCode ?? -1}: ${stderrLine}`
      : `Claude exited with code ${proc.exitCode ?? -1}`;
  };

  const runAttempt = async (resumeSessionId: string | null) => {
    const args = buildClaudeArgs(resumeSessionId);
    if (onMeta) {
      await onMeta({
        adapterType: "claude_local",
        command,
        cwd,
        commandArgs: args,
        commandNotes,
        env: redactEnvForLogs(env),
        prompt,
        promptMetrics,
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

    const parsedStream = parseClaudeStreamJson(proc.stdout);
    const parsed = parsedStream.resultJson ?? parseJson(proc.stdout);
    return { proc, parsedStream, parsed };
  };

  const toAdapterResult = (
    attempt: {
      proc: RunProcessResult;
      parsedStream: ReturnType<typeof parseClaudeStreamJson>;
      parsed: Record<string, unknown> | null;
    },
    opts: { fallbackSessionId: string | null; clearSessionOnMissingSession?: boolean },
  ): AdapterExecutionResult => {
    const { proc, parsedStream, parsed } = attempt;
    const loginMeta = detectClaudeLoginRequired({
      parsed,
      stdout: proc.stdout,
      stderr: proc.stderr,
    });
    const errorMeta =
      loginMeta.loginUrl != null
        ? {
            loginUrl: loginMeta.loginUrl,
          }
        : undefined;

    if (proc.timedOut) {
      return {
        exitCode: proc.exitCode,
        signal: proc.signal,
        timedOut: true,
        errorMessage: `Timed out after ${timeoutSec}s`,
        errorCode: "timeout",
        errorMeta,
        clearSession: Boolean(opts.clearSessionOnMissingSession),
      };
    }

    if (!parsed) {
      return {
        exitCode: proc.exitCode,
        signal: proc.signal,
        timedOut: false,
        errorMessage: parseFallbackErrorMessage(proc),
        errorCode: loginMeta.requiresLogin ? "claude_auth_required" : null,
        errorMeta,
        resultJson: {
          stdout: proc.stdout,
          stderr: proc.stderr,
        },
        clearSession: Boolean(opts.clearSessionOnMissingSession),
      };
    }

    const usage =
      parsedStream.usage ??
      (() => {
        const usageObj = parseObject(parsed.usage);
        return {
          inputTokens: asNumber(usageObj.input_tokens, 0),
          cachedInputTokens: asNumber(usageObj.cache_read_input_tokens, 0),
          outputTokens: asNumber(usageObj.output_tokens, 0),
        };
      })();

    const resolvedSessionId =
      parsedStream.sessionId ??
      (asString(parsed.session_id, opts.fallbackSessionId ?? "") || opts.fallbackSessionId);
    const resolvedSessionParams = resolvedSessionId
      ? ({
        sessionId: resolvedSessionId,
        cwd,
        ...(workspaceId ? { workspaceId } : {}),
        ...(workspaceRepoUrl ? { repoUrl: workspaceRepoUrl } : {}),
        ...(workspaceRepoRef ? { repoRef: workspaceRepoRef } : {}),
      } as Record<string, unknown>)
      : null;
    const clearSessionForMaxTurns = isClaudeMaxTurnsResult(parsed);

    const effectiveModel = parsedStream.model || asString(parsed.model, "") || model || null;

    return {
      exitCode: proc.exitCode,
      signal: proc.signal,
      timedOut: false,
      errorMessage:
        (proc.exitCode ?? 0) === 0
          ? null
          : describeClaudeFailure(parsed) ?? `Claude exited with code ${proc.exitCode ?? -1}`,
      errorCode: loginMeta.requiresLogin ? "claude_auth_required" : null,
      errorMeta,
      usage,
      sessionId: resolvedSessionId,
      sessionParams: resolvedSessionParams,
      sessionDisplayId: resolvedSessionId,
      provider: "anthropic",
      biller: "anthropic",
      model: effectiveModel,
      billingType,
      costUsd: parsedStream.costUsd ?? asNumber(parsed.total_cost_usd, 0),
      resultJson: parsed,
      summary: parsedStream.summary || asString(parsed.result, ""),
      clearSession: clearSessionForMaxTurns || Boolean(opts.clearSessionOnMissingSession && !resolvedSessionId),
    };
  };

  try {
    const initial = await runAttempt(sessionId ?? null);
    if (
      sessionId &&
      !initial.proc.timedOut &&
      (initial.proc.exitCode ?? 0) !== 0 &&
      initial.parsed &&
      isClaudeUnknownSessionError(initial.parsed)
    ) {
      await onLog(
        "stdout",
        `[clawdev] Claude resume session "${sessionId}" is unavailable; retrying with a fresh session.\n`,
      );
      const retry = await runAttempt(null);
      return toAdapterResult(retry, { fallbackSessionId: null, clearSessionOnMissingSession: true });
    }

    return toAdapterResult(initial, { fallbackSessionId: runtimeSessionId || runtime.sessionId });
  } finally {
    fs.rm(skillsDir, { recursive: true, force: true }).catch(() => {});
  }
}
