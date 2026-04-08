import type { AdapterEnvironmentCheck, AdapterEnvironmentTestContext, AdapterEnvironmentTestResult } from "@clawdev/adapter-utils";
import { asString, parseObject } from "@clawdev/adapter-utils/server-utils";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(ctx: AdapterEnvironmentTestContext): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const baseUrl = asString(config.baseUrl, "http://localhost:11434/v1").trim().replace(/\/$/, "");
  const model = asString(config.model, "").trim();
  const apiKey = asString(config.apiKey, "").trim();

  if (!baseUrl) {
    checks.push({
      code: "openai_compatible_base_url_missing",
      level: "error",
      message: "OpenAI-compatible adapter requires adapterConfig.baseUrl.",
      hint: "Set baseUrl to your local runtime, e.g. http://localhost:11434/v1, http://localhost:1234/v1, or http://localhost:8080/v1.",
    });
  } else {
    try {
      const res = await fetch(`${baseUrl}/models`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      });
      if (!res.ok) {
        checks.push({
          code: "openai_compatible_models_unreachable",
          level: "error",
          message: `GET /models failed with ${res.status} ${res.statusText}.`,
          detail: baseUrl,
        });
      } else {
        const body = (await res.json()) as { data?: unknown };
        const count = Array.isArray(body.data) ? body.data.length : 0;
        checks.push({
          code: "openai_compatible_models_reachable",
          level: "info",
          message: `Model endpoint reachable at ${baseUrl}.`,
          detail: `${count} model(s) reported.`,
        });
      }
    } catch (err) {
      checks.push({
        code: "openai_compatible_models_unreachable",
        level: "error",
        message: err instanceof Error ? err.message : "Could not reach OpenAI-compatible model endpoint.",
        detail: baseUrl,
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
