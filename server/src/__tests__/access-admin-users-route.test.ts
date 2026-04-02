import { Elysia } from "elysia";
import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../errors.js";
import { accessRoutes } from "../routes/access.js";

const rows = [
  {
    id: "user-1",
    name: "Ada",
    email: "ada@example.com",
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    isInstanceAdmin: true,
  },
  {
    id: "user-2",
    name: "Grace",
    email: "grace@example.com",
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    isInstanceAdmin: false,
  },
];

function createDbStub() {
  const select = vi.fn((fields: Record<string, unknown>) => {
    const isAdminsQuery = Object.prototype.hasOwnProperty.call(fields, "userId")
      && Object.prototype.hasOwnProperty.call(fields, "role")
      && Object.prototype.hasOwnProperty.call(fields, "createdAt")
      && Object.prototype.hasOwnProperty.call(fields, "updatedAt");

    if (isAdminsQuery) {
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(async () => [{ userId: "user-1" }]),
          })),
        })),
      };
    }

    return {
      from: vi.fn(() => ({
        orderBy: vi.fn(async () => rows),
      })),
    };
  });

  return { select };
}

function createApp() {
  return new Elysia({ prefix: "/api" })
    .onError(({ error, set }) => {
      if (error instanceof HttpError) {
        set.status = error.status;
        return { error: error.message };
      }
      set.status = 500;
      return { error: error instanceof Error ? error.message : String(error) };
    })
    .derive(() => ({
      actor: {
        type: "board",
        source: "local_implicit",
        userId: "board-user",
        companyIds: [],
        isInstanceAdmin: true,
      },
    }))
    .use(accessRoutes(createDbStub() as any));
}

async function req(app: any, method: string, path: string) {
  const res = await app.handle(new Request(`http://localhost${path}`, { method }));
  const text = await res.text();
  return { status: res.status, body: JSON.parse(text) };
}

describe("access admin users route", () => {
  it("lists instance users with admin flags", async () => {
    const app = createApp();
    const res = await req(app, "GET", "/api/admin/users");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ id: "user-1", isInstanceAdmin: true });
    expect(res.body[1]).toMatchObject({ id: "user-2", isInstanceAdmin: false });
  });
});
