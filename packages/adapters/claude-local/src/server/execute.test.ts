import { describe, expect, it } from "vitest";
import { sanitizeClaudeExtraArgs } from "./execute.js";

describe("sanitizeClaudeExtraArgs", () => {
  it("removes --model auto pairs", () => {
    expect(sanitizeClaudeExtraArgs(["--model", "auto", "--verbose"])).toEqual(["--verbose"]);
  });

  it("removes --model=auto flags", () => {
    expect(sanitizeClaudeExtraArgs(["--model=auto", "--verbose"])).toEqual(["--verbose"]);
  });

  it("keeps explicit models", () => {
    expect(sanitizeClaudeExtraArgs(["--model", "claude-sonnet-4-6", "--verbose"])).toEqual([
      "--model",
      "claude-sonnet-4-6",
      "--verbose",
    ]);
  });
});
