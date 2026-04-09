import { describe, expect, it } from "vitest";
import { deriveAuthProfileKeyFromEnvBindings } from "../services/secrets.js";

describe("deriveAuthProfileKeyFromEnvBindings", () => {
  it("returns a stable fingerprint for secret bindings", () => {
    const bindings = {
      ANTHROPIC_API_KEY: {
        type: "secret_ref",
        secretId: "11111111-1111-4111-8111-111111111111",
        version: "latest",
      },
      CLAUDE_HOME: {
        type: "plain",
        value: "/Users/julio/.claude",
      },
    };

    const first = deriveAuthProfileKeyFromEnvBindings(bindings);
    const second = deriveAuthProfileKeyFromEnvBindings({
      CLAUDE_HOME: {
        type: "plain",
        value: "/Users/julio/.claude",
      },
      ANTHROPIC_API_KEY: {
        type: "secret_ref",
        secretId: "11111111-1111-4111-8111-111111111111",
        version: "latest",
      },
    });

    expect(first).toBeTypeOf("string");
    expect(first).toHaveLength(64);
    expect(first).toBe(second);
  });

  it("changes when the secret reference changes", () => {
    const baseline = deriveAuthProfileKeyFromEnvBindings({
      ANTHROPIC_API_KEY: {
        type: "secret_ref",
        secretId: "11111111-1111-4111-8111-111111111111",
        version: "latest",
      },
    });
    const changed = deriveAuthProfileKeyFromEnvBindings({
      ANTHROPIC_API_KEY: {
        type: "secret_ref",
        secretId: "22222222-2222-4222-8222-222222222222",
        version: "latest",
      },
    });

    expect(baseline).not.toBe(changed);
  });
});
