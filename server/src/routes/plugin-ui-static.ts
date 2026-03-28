import { Elysia } from "elysia";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Db } from "@clawdev/db";
import { pluginRegistryService } from "../services/plugin-registry.js";
import { resolvePluginUiDir } from "../routes/plugin-ui-static.js";
import { logger } from "../middleware/logger.js";

const log = logger.child({ module: "plugin-ui-static" });

const CONTENT_HASH_PATTERN = /[.-][a-fA-F0-9]{8,}\.\w+$/;
const CACHE_CONTROL_IMMUTABLE = "public, max-age=31536000, immutable";
const CACHE_CONTROL_REVALIDATE = "public, max-age=0, must-revalidate";

const MIME_TYPES: Record<string, string> = {
  ".js": "application/javascript", ".mjs": "application/javascript",
  ".css": "text/css", ".json": "application/json",
  ".map": "application/json", ".html": "text/html",
  ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp",
  ".woff": "font/woff", ".woff2": "font/woff2",
  ".ttf": "font/ttf", ".eot": "application/vnd.ms-fontobject",
  ".ico": "image/x-icon", ".txt": "text/plain",
};

function computeETag(size: number, mtimeMs: number): string {
  return `"${createHash("md5").update(`${size}-${mtimeMs}`).digest("hex").slice(0, 16)}"`;
}

export interface ElysiaPluginUiStaticOptions {
  localPluginDir: string;
}

export function elysiaPluginUiStaticRoutes(db: Db, options: ElysiaPluginUiStaticOptions) {
  const registry = pluginRegistryService(db);

  return new Elysia()
    .get("/_plugins/:pluginId/ui/*", async ({ params, request, set }) => {
      const pluginId = params.pluginId;
      const rawFilePath = (params as Record<string, string>)["*"];

      if (!rawFilePath || rawFilePath.length === 0) {
        set.status = 400;
        return { error: "File path is required" };
      }

      // Step 1: Look up the plugin
      let plugin = null;
      try { plugin = await registry.getById(pluginId); } catch (error) {
        const maybeCode = typeof error === "object" && error !== null && "code" in error ? (error as { code?: unknown }).code : undefined;
        if (maybeCode !== "22P02") throw error;
      }
      if (!plugin) plugin = await registry.getByKey(pluginId);
      if (!plugin) { set.status = 404; return { error: "Plugin not found" }; }

      // Step 2: Verify ready + UI declared
      if (plugin.status !== "ready") { set.status = 403; return { error: `Plugin UI is not available (status: ${plugin.status})` }; }
      const manifest = plugin.manifestJson;
      if (!manifest?.entrypoints?.ui) { set.status = 404; return { error: "Plugin does not declare a UI bundle" }; }

      // Step 2b: Dev proxy
      try {
        const configRow = await registry.getConfig(plugin.id);
        const devUiUrl = configRow && typeof configRow === "object" && "configJson" in configRow
          ? ((configRow as { configJson: Record<string, unknown> }).configJson?.devUiUrl as string | undefined)
          : undefined;

        if (typeof devUiUrl === "string" && devUiUrl.length > 0) {
          if (process.env.NODE_ENV !== "production") {
            let decodedPath: string;
            try { decodedPath = decodeURIComponent(rawFilePath); } catch { set.status = 400; return { error: "Invalid file path" }; }
            if (decodedPath.includes("://") || decodedPath.startsWith("//") || decodedPath.startsWith("\\\\")) { set.status = 400; return { error: "Invalid file path" }; }
            const targetUrl = new URL(rawFilePath, devUiUrl.endsWith("/") ? devUiUrl : devUiUrl + "/");
            if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") { set.status = 400; return { error: "devUiUrl must use http or https protocol" }; }
            const devHost = targetUrl.hostname;
            const isLoopback = devHost === "localhost" || devHost === "127.0.0.1" || devHost === "::1" || devHost === "[::1]";
            if (!isLoopback) { set.status = 400; return { error: "devUiUrl must target localhost" }; }
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 10_000);
              try {
                const upstream = await fetch(targetUrl.href, { signal: controller.signal });
                if (!upstream.ok) { set.status = upstream.status; return { error: `Dev server returned ${upstream.status}` }; }
                const contentType = upstream.headers.get("content-type");
                const body = await upstream.arrayBuffer();
                const headers: Record<string, string> = { "cache-control": "no-cache, no-store, must-revalidate", "access-control-allow-origin": "*" };
                if (contentType) headers["content-type"] = contentType;
                return new Response(body, { headers });
              } finally { clearTimeout(timeout); }
            } catch { /* fall through to static serving */ }
          }
        }
      } catch { /* config lookup failure — fall through */ }

      // Step 3: Resolve UI directory
      const uiDir = resolvePluginUiDir(options.localPluginDir, plugin.packageName, manifest.entrypoints.ui, plugin.packagePath);
      if (!uiDir) { set.status = 404; return { error: "Plugin UI directory not found" }; }

      // Step 4: Resolve file path + traversal prevention
      const resolvedFilePath = path.resolve(uiDir, rawFilePath);
      let fileStat: fs.Stats;
      try { fileStat = fs.statSync(resolvedFilePath); } catch { set.status = 404; return { error: "File not found" }; }

      let realFilePath: string;
      let realUiDir: string;
      try { realFilePath = fs.realpathSync(resolvedFilePath); realUiDir = fs.realpathSync(uiDir); } catch { set.status = 404; return { error: "File not found" }; }
      const relative = path.relative(realUiDir, realFilePath);
      if (relative.startsWith("..") || path.isAbsolute(relative)) { set.status = 403; return { error: "Access denied" }; }
      if (!fileStat.isFile()) { set.status = 404; return { error: "File not found" }; }

      // Step 5: Cache + ETag
      const basename = path.basename(resolvedFilePath);
      const isContentHashed = CONTENT_HASH_PATTERN.test(basename);
      const headers: Record<string, string> = { "access-control-allow-origin": "*" };

      if (isContentHashed) {
        headers["cache-control"] = CACHE_CONTROL_IMMUTABLE;
      } else {
        headers["cache-control"] = CACHE_CONTROL_REVALIDATE;
        const etag = computeETag(fileStat.size, fileStat.mtimeMs);
        headers["etag"] = etag;
        const ifNoneMatch = request.headers.get("if-none-match");
        if (ifNoneMatch === etag) return new Response(null, { status: 304, headers });
      }

      // Step 6: Content-Type
      const ext = path.extname(resolvedFilePath).toLowerCase();
      const contentType = MIME_TYPES[ext];
      if (contentType) headers["content-type"] = contentType;

      // Step 7: Serve file using Bun.file() for optimal performance
      try {
        const fileContent = fs.readFileSync(resolvedFilePath);
        return new Response(fileContent, { headers });
      } catch (err) {
        log.error({ err, pluginId: plugin.id, filePath: resolvedFilePath }, "plugin-ui-static: error serving file");
        set.status = 500;
        return { error: "Failed to serve file" };
      }
    });
}
