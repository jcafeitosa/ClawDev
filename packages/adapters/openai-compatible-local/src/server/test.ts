import type { AdapterEnvironmentCheck, AdapterEnvironmentTestContext, AdapterEnvironmentTestResult } from "@clawdev/adapter-utils";
import { asString, parseObject } from "@clawdev/adapter-utils/server-utils";
import { resolveOpenAICompatibleBaseUrlCandidates } from "./shared.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function classifyHttpFailure(status: number, bodyText: string): {
  code: string;
  level: AdapterEnvironmentCheck["level"];
  message: string;
  detail: string;
  hint: string;
} {
  const excerpt = bodyText.trim().replace(/\s+/g, " ").slice(0, 160);
  if (status === 401 || status === 403) {
    return {
      code: "openai_compatible_auth_required",
      level: "warn",
      message: "Authentication required for the OpenAI-compatible runtime.",
      detail: `${status} ${excerpt || "auth required"}`,
      hint: "Set adapterConfig.apiKey or configure the local runtime with the correct credentials.",
    };
  }
  if (status === 402 || status === 429) {
    return {
      code: "openai_compatible_quota_exceeded",
      level: "warn",
      message: "Quota or credits exhausted for the OpenAI-compatible runtime.",
      detail: `${status} ${excerpt || "quota exhausted"}`,
      hint: "Check provider billing/credits or switch to another configured account.",
    };
  }
  if (status === 404) {
    return {
      code: "openai_compatible_models_missing",
      level: "warn",
      message: "The OpenAI-compatible runtime is reachable, but no model catalog is exposed.",
      detail: `${status} ${excerpt || "models endpoint missing"}`,
      hint: "Expose at least one model in the local runtime and retry discovery.",
    };
  }
  return {
    code: "openai_compatible_models_unreachable",
    level: "warn",
    message: "Could not reach an OpenAI-compatible model endpoint.",
    detail: `${status} ${excerpt || "request failed"}`,
    hint: "Start Ollama, LM Studio, llama.cpp, or set adapterConfig.baseUrl.",
  };
}

export async function testEnvironment(ctx: AdapterEnvironmentTestContext): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const candidateBaseUrls = resolveOpenAICompatibleBaseUrlCandidates(config.baseUrl);
  const model = asString(config.model, "").trim();
  const apiKey = asString(config.apiKey, "").trim();

  if (candidateBaseUrls.length === 0) {
    checks.push({
      code: "openai_compatible_base_url_missing",
      level: "info",
      message: "No explicit OpenAI-compatible base URL configured; discovery will probe local defaults.",
      hint: "Set adapterConfig.baseUrl if you want to pin a specific runtime.",
    });
  } else {
    let reachableCount = 0;
    for (const baseUrl of candidateBaseUrls) {
      try {
        const res = await fetch(`${baseUrl}/models`, {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        });
        if (!res.ok) {
          const bodyText = await res.text().catch(() => "");
          checks.push(classifyHttpFailure(res.status, bodyText));
          continue;
        }
        const body = (await res.json()) as { data?: unknown };
        const count = Array.isArray(body.data) ? body.data.length : 0;
        reachableCount += 1;
        checks.push({
          code: "openai_compatible_models_reachable",
          level: "info",
          message: `Model endpoint reachable at ${baseUrl}.`,
          detail: `${count} model(s) reported.`,
        });
      } catch (err) {
        checks.push({
          code: "openai_compatible_models_unreachable",
          level: "warn",
          message: "Could not reach an OpenAI-compatible model endpoint.",
          detail: err instanceof Error ? err.message : String(err),
          hint: "Start Ollama, LM Studio, llama.cpp, or set adapterConfig.baseUrl.",
        });
      }
    }
    if (reachableCount === 0 && checks.every((check) => check.code !== "openai_compatible_models_unreachable")) {
      checks.push({
        code: "openai_compatible_models_unreachable",
        level: "warn",
        message: "Could not reach any local OpenAI-compatible model endpoint.",
        detail: candidateBaseUrls.join(", "),
        hint: "Start Ollama, LM Studio, llama.cpp, or set adapterConfig.baseUrl.",
      });
    }
  }

  if (model) {
    checks.push({
      code: "openai_compatible_model_configured",
      level: "info",
      message: `Configured model: ${model}`,
    });
  } else {
    checks.push({
      code: "openai_compatible_model_missing",
      level: "warn",
      message: "No model configured. Discovery should be used to pick an available model.",
    });
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
