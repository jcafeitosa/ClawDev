import { describe, expect, it } from "vitest";
import {
  normalizeAdapterConfigForAdapterType,
  normalizeRuntimeConfigForAdapterType,
} from "../services/runtime-config.js";

describe("normalizeRuntimeConfigForAdapterType", () => {
  it("drops auto model selection for claude_local", () => {
    expect(
      normalizeRuntimeConfigForAdapterType("claude_local", { model: "auto", heartbeat: { enabled: true } }),
    ).toEqual({ heartbeat: { enabled: true } });

    expect(
      normalizeRuntimeConfigForAdapterType("claude_local", { model: " AUTO ", heartbeat: { enabled: true } }),
    ).toEqual({ heartbeat: { enabled: true } });
  });

  it("keeps explicit Claude models intact", () => {
    expect(
      normalizeRuntimeConfigForAdapterType("claude_local", { model: "claude-sonnet-4-6", heartbeat: { enabled: true } }),
    ).toEqual({ model: "claude-sonnet-4-6", heartbeat: { enabled: true } });
  });

  it("defaults codex_local auto to the adapter default model", () => {
    expect(
      normalizeRuntimeConfigForAdapterType("codex_local", { model: "auto", heartbeat: { enabled: true } }),
    ).toEqual({ model: "gpt-5.4-mini", heartbeat: { enabled: true } });

    expect(
      normalizeRuntimeConfigForAdapterType("codex_local", { heartbeat: { enabled: true } }),
    ).toEqual({ model: "gpt-5.4-mini", heartbeat: { enabled: true } });
  });

  it("leaves other adapters untouched", () => {
    expect(
      normalizeRuntimeConfigForAdapterType("cursor", { model: "auto", mode: "plan" }),
    ).toEqual({ model: "auto", mode: "plan" });
  });

  it("defaults skipGitRepoCheck for codex_local adapter configs", () => {
    expect(
      normalizeAdapterConfigForAdapterType("codex_local", { model: "gpt-5.3-codex" }),
    ).toEqual({ model: "gpt-5.3-codex", skipGitRepoCheck: true });

    expect(
      normalizeAdapterConfigForAdapterType("codex_local", { model: "auto", skipGitRepoCheck: false }),
    ).toEqual({ model: "gpt-5.4-mini", skipGitRepoCheck: false });

    expect(
      normalizeAdapterConfigForAdapterType("codex_local", { skipGitRepoCheck: false }),
    ).toEqual({ model: "gpt-5.4-mini", skipGitRepoCheck: false });
  });
});
