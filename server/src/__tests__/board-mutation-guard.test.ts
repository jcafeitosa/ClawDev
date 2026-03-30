import { describe, expect, it } from "vitest";
import { checkBoardMutation } from "../middleware/board-mutation-guard.js";

function makeRequest(method: string, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/mutate", { method, headers });
}

describe("boardMutationGuard", () => {
  it("allows safe methods for board actor", () => {
    const result = checkBoardMutation(
      makeRequest("GET"),
      { type: "board", userId: "board", source: "session" },
    );
    expect(result).toBeUndefined();
  });

  it("blocks board mutations without trusted origin", () => {
    const result = checkBoardMutation(
      makeRequest("POST"),
      { type: "board", userId: "board", source: "session" },
    );
    expect(result).toEqual({
      status: 403,
      body: { error: "Board mutation requires trusted browser origin" },
    });
  });

  it("allows local implicit board mutations without origin", () => {
    const result = checkBoardMutation(
      makeRequest("POST"),
      { type: "board", userId: "board", source: "local_implicit" },
    );
    expect(result).toBeUndefined();
  });

  it("allows board bearer-key mutations without origin", () => {
    const result = checkBoardMutation(
      makeRequest("POST"),
      { type: "board", userId: "board", source: "board_key" },
    );
    expect(result).toBeUndefined();
  });

  it("allows board mutations from trusted origin", () => {
    const result = checkBoardMutation(
      makeRequest("POST", { origin: "http://localhost:3100" }),
      { type: "board", userId: "board", source: "session" },
    );
    expect(result).toBeUndefined();
  });

  it("allows board mutations from trusted referer origin", () => {
    const result = checkBoardMutation(
      makeRequest("POST", { referer: "http://localhost:3100/issues/abc" }),
      { type: "board", userId: "board", source: "session" },
    );
    expect(result).toBeUndefined();
  });

  it("does not block authenticated agent mutations", () => {
    const result = checkBoardMutation(
      makeRequest("POST"),
      { type: "agent", agentId: "agent-1" },
    );
    expect(result).toBeUndefined();
  });
});
