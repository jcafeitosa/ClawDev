/**
 * Health check route — simple standalone version for testing.
 * The full health endpoint with bootstrap status is in elysia-app.ts.
 */

import { Elysia } from "elysia";
import { serverVersion } from "../version.js";

export function healthRoutes() {
  return new Elysia()
    .get("/", () => ({ status: "ok", version: serverVersion }));
}
