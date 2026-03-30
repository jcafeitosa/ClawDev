/**
 * Test helper — supertest-like client for Elysia apps.
 *
 * Usage:
 *   const client = testClient(app);
 *   const res = await client.get("/api/health");
 *   expect(res.status).toBe(200);
 *   expect(res.body.status).toBe("ok");
 */

import type { Elysia } from "elysia";

interface TestResponse {
  status: number;
  body: any;
  text: string;
  headers: Headers;
}

class TestRequestBuilder {
  private app: Elysia<any, any, any, any, any, any, any, any>;
  private method: string;
  private path: string;
  private reqHeaders: Record<string, string> = {};
  private reqBody?: string;

  constructor(app: any, method: string, path: string) {
    this.app = app;
    this.method = method;
    this.path = path;
  }

  set(key: string, value: string): this {
    this.reqHeaders[key] = value;
    return this;
  }

  send(body: any): this {
    this.reqBody = JSON.stringify(body);
    if (!this.reqHeaders["content-type"]) {
      this.reqHeaders["content-type"] = "application/json";
    }
    return this;
  }

  async then(resolve: (res: TestResponse) => void, reject?: (err: any) => void): Promise<void> {
    try {
      const url = `http://localhost${this.path}`;
      const init: RequestInit = {
        method: this.method,
        headers: this.reqHeaders,
      };
      if (this.reqBody && this.method !== "GET" && this.method !== "HEAD") {
        init.body = this.reqBody;
      }
      const response = await this.app.handle(new Request(url, init));
      const text = await response.text();
      let body: any;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
      resolve({ status: response.status, body, text, headers: response.headers });
    } catch (err) {
      if (reject) reject(err);
      else throw err;
    }
  }
}

export function testClient(app: any) {
  return {
    get: (path: string) => new TestRequestBuilder(app, "GET", path),
    post: (path: string) => new TestRequestBuilder(app, "POST", path),
    put: (path: string) => new TestRequestBuilder(app, "PUT", path),
    patch: (path: string) => new TestRequestBuilder(app, "PATCH", path),
    delete: (path: string) => new TestRequestBuilder(app, "DELETE", path),
  };
}
