import { Elysia } from "elysia";
import { describe, expect, it } from "vitest";
import { accessRoutes } from "../routes/access.js";

function createApp() {
  return new Elysia({ prefix: "/api" }).use(accessRoutes({} as any));
}

async function req(app: any, method: string, path: string) {
  const res = await app.handle(new Request(`http://localhost${path}`, { method }));
  const text = await res.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body, text };
}

describe("skills routes", () => {
  it("publishes the available skills with Paperclip-compatible managed flags", async () => {
    const app = createApp();
    const res = await req(app, "GET", "/api/skills/available");

    expect(res.status).toBe(200);
    expect(res.body.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "paperclip", isPaperclipManaged: true }),
        expect.objectContaining({ name: "clawdev", isPaperclipManaged: false }),
        expect.objectContaining({ name: "para-memory-files", isPaperclipManaged: true }),
        expect.objectContaining({ name: "paperclip-create-plugin", isPaperclipManaged: true }),
      ]),
    );
    expect(res.body.skills.every((entry: { isPaperclipManaged?: unknown }) => "isPaperclipManaged" in entry)).toBe(
      true,
    );
  });

  it("publishes the Paperclip skill index", async () => {
    const app = createApp();
    const res = await req(app, "GET", "/api/skills/index");

    expect(res.status).toBe(200);
    expect(res.body.skills.map((entry: { name: string }) => entry.name)).toEqual([
      "paperclip",
      "para-memory-files",
      "paperclip-create-agent",
    ]);
  });

  it("serves the paperclip skill alias as markdown", async () => {
    const app = createApp();
    const res = await req(app, "GET", "/api/skills/paperclip");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Paperclip");
  });
});
