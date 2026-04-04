import { describe, expect, it } from "vitest";
import { rewriteApiNotFoundResponse } from "../elysia-app.js";

describe("rewriteApiNotFoundResponse", () => {
  it("rewrites the default API 404 body to Paperclip's contract", async () => {
    const request = new Request("http://localhost/api/does-not-exist");
    const response = new Response(JSON.stringify({ error: "Not found" }), { status: 404 });

    const rewritten = await rewriteApiNotFoundResponse(request, 404, response);

    expect(rewritten).toBeInstanceOf(Response);
    expect(rewritten?.status).toBe(404);
    const body = await rewritten!.json();
    expect(body).toEqual({ error: "API route not found" });
  });

  it("does not rewrite non-API requests", async () => {
    const request = new Request("http://localhost/does-not-exist");
    const response = new Response(JSON.stringify({ error: "Not found" }), { status: 404 });

    await expect(rewriteApiNotFoundResponse(request, 404, response)).resolves.toBeNull();
  });
});
