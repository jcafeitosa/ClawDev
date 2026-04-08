import type { AdapterExecutionContext, AdapterExecutionResult } from "@clawdev/adapter-utils";
import {
  asNumber,
  asString,
  parseObject,
  ensureAbsoluteDirectory,
} from "@clawdev/adapter-utils/server-utils";
import { resolveOpenAICompatibleBaseUrlCandidates } from "./shared.js";

function normalizeBaseUrl(input: unknown): string {
  return asString(input, "").trim().replace(/\/$/, "");
}

function firstTextBlock(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value !== "object" || value === null) return "";
  const rec = value as Record<string, unknown>;
  const content = rec.content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const item of content) {
      if (typeof item === "string") {
        if (item.trim()) parts.push(item.trim());
        continue;
      }
      if (typeof item !== "object" || item === null) continue;
      const block = item as Record<string, unknown>;
      const text = asString(block.text, "").trim();
      if (text) parts.push(text);
    }
    return parts.join("\n").trim();
  }
  return asString(rec.text, "").trim();
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, config, context, onLog } = ctx;
  const promptTemplate = asString(config.promptTemplate, "You are agent {{agent.id}} ({{agent.name}}). Continue your ClawDev work.");
  const candidateBaseUrls = resolveOpenAICompatibleBaseUrlCandidates(config.baseUrl);
  const model = asString(config.model, "").trim();
  const apiKey = asString(config.apiKey, "").trim();
  const systemPrompt = asString(config.systemPrompt, "").trim();
  const temperature = asNumber(config.temperature, 0.2);
  const maxTokens = asNumber(config.maxTokens, 1024);
  const cwd = asString(config.cwd, process.cwd());
  await ensureAbsoluteDirectory(cwd, { createIfMissing: true });

  const workspaceContext = parseObject(context.clawdevWorkspace);
  const taskPrompt = promptTemplate
    .replaceAll("{{agent.id}}", agent.id)
    .replaceAll("{{agent.name}}", agent.name);

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: taskPrompt });

  if (candidateBaseUrls.length === 0) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "No OpenAI-compatible baseUrl configured or discoverable.",
      resultJson: { response: "No OpenAI-compatible baseUrl configured or discoverable.", model, workspaceContext },
      summary: null,
    };
  }

  const classifyFailure = (status: number, bodyText: string) => {
    const excerpt = bodyText.trim().replace(/\s+/g, " ").slice(0, 160);
    if (status === 401 || status === 403) {
      return {
        errorCode: "auth_required",
        errorMessage: `${status} authentication required${excerpt ? ` — ${excerpt}` : ""}`,
      };
    }
    if (status === 402 || status === 429) {
      return {
        errorCode: "quota_exceeded",
        errorMessage: `${status} quota or credits exhausted${excerpt ? ` — ${excerpt}` : ""}`,
      };
    }
    if (status === 404) {
      return {
        errorCode: "model_unavailable",
        errorMessage: `${status} model endpoint unavailable${excerpt ? ` — ${excerpt}` : ""}`,
      };
    }
    return {
      errorCode: "unavailable",
      errorMessage: `${status} ${excerpt || "request failed"}`,
    };
  };

  let lastError: string | null = null;
  for (const candidateBaseUrl of candidateBaseUrls) {
    const baseUrl = normalizeBaseUrl(candidateBaseUrl);
    if (!baseUrl) continue;
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: false,
        }),
      });

      const bodyText = await response.text();
      if (!response.ok) {
        const classified = classifyFailure(response.status, bodyText);
        lastError = classified.errorMessage;
        await onLog("stderr", `[clawdev] OpenAI-compatible request failed at ${baseUrl}: ${classified.errorMessage}\n`);
        continue;
      }

      let parsed: unknown = null;
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        parsed = null;
      }
      const record = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
      const choice0 = Array.isArray(record?.choices) ? record?.choices[0] : null;
      const choice0Record = typeof choice0 === "object" && choice0 !== null ? (choice0 as Record<string, unknown>) : null;
      const message = choice0Record ? firstTextBlock(choice0Record.message ?? choice0Record.delta) : "";
      const summary = message || asString(record?.output_text, "").trim() || bodyText.slice(0, 500);

      return {
        exitCode: 0,
        signal: null,
        timedOut: false,
        sessionParams: null,
        provider: "openai",
        model,
        resultJson: record ?? { response: bodyText, baseUrl },
        summary,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      await onLog("stderr", `[clawdev] OpenAI-compatible request failed at ${baseUrl}: ${lastError}\n`);
      continue;
    }
  }

      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorCode: lastError?.includes("quota") || lastError?.includes("credits") ? "quota_exceeded" : "unavailable",
        errorMessage: lastError ?? "All OpenAI-compatible baseUrl candidates failed.",
        resultJson: { response: lastError ?? "All OpenAI-compatible baseUrl candidates failed.", model, workspaceContext },
        summary: null,
  };
}
