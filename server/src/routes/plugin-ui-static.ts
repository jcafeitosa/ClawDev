/**
 * Plugin UI static file serving — Elysia port.
 *
 * Serves plugin UI bundles from the plugin's dist/ui/ directory.
 * See PLUGIN_SPEC.md §19.0.3 (Bundle Serving).
 *
 * Security: path traversal prevented via realpath + containment check.
 * Cache: content-hashed files → immutable; others → ETag-based revalidation.
 */

import { Elysia } from "elysia";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import type { Db } from "@clawdev/db";
import { pluginRegistryService } from "../services/plugin-registry.js";
import { logger } from "../middleware/logger.js";

const CONTENT_HASH_PATTERN = /[.-][a-fA-F0-9]{8,}\.\w+$/;
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
const CACHE_CONTROL_IMMUTABLE = `public, max-age=${ONE_YEAR_SECONDS}, immutable`;
const CACHE_CONTROL_REVALIDATE = "public, max-age=0, must-revalidate";

const MIME_TYPES: Record<string, string> = {
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};

function computeETag(size: number, mtimeMs: number): string {
  const hash = crypto
    .createHash("md5")
    .update(`v2:${size}-${mtimeMs}`)
    .digest("hex")
    .slice(0, 16);
  return `"${hash}"`;
}

function resolvePluginUiDir(
  localPluginDir: string,
  packageName: string,
  entrypointsUi: string,
  packagePath?: string | null,
): string | null {
  if (packagePath) {
    const resolvedPackagePath = path.resolve(packagePath);
    if (fs.existsSync(resolvedPackagePath)) {
      const uiDirFromPackagePath = path.resolve(resolvedPackagePath, entrypointsUi);
      if (uiDirFromPackagePath.startsWith(resolvedPackagePath) && fs.existsSync(uiDirFromPackagePath)) {
        return uiDirFromPackagePath;
      }
    }
  }

  let packageRoot: string;
  if (packageName.startsWith("@")) {
    packageRoot = path.join(localPluginDir, "node_modules", ...packageName.split("/"));
  } else {
    packageRoot = path.join(localPluginDir, "node_modules", packageName);
  }

  if (!fs.existsSync(packageRoot)) {
    const directPath = path.join(localPluginDir, packageName);
    if (fs.existsSync(directPath)) {
      packageRoot = directPath;
    } else {
      return null;
    }
  }

  const uiDir = path.resolve(packageRoot, entrypointsUi);
  if (!fs.existsSync(uiDir)) {
    return null;
  }

  return uiDir;
}

export interface PluginUiStaticRouteOptions {
  localPluginDir: string;
}

export function pluginUiStaticRoutes(db: Db, options: PluginUiStaticRouteOptions) {
  const registry = pluginRegistryService(db);
  const log = logger.child({ service: "plugin-ui-static" });

  return new Elysia()
    .get(
      "/_plugins/:pluginId/ui/*",
      async ({ params, set, request }) => {
        const { pluginId } = params;
        const rawFilePath = (params as Record<string, string>)["*"];

        if (!rawFilePath || rawFilePath.length === 0) {
          set.status = 400;
          return { error: "File path is required" };
        }

        // Look up plugin
        let plugin = null;
        try {
          plugin = await registry.getById(pluginId);
        } catch (error) {
          const maybeCode =
            typeof error === "object" && error !== null && "code" in error
              ? (error as { code?: unknown }).code
              : undefined;
          if (maybeCode !== "22P02") throw error;
        }
        if (!plugin) plugin = await registry.getByKey(pluginId);

        if (!plugin) {
          set.status = 404;
          return { error: "Plugin not found" };
        }

        if (plugin.status !== "ready") {
          set.status = 403;
          return { error: `Plugin UI is not available (status: ${plugin.status})` };
        }

        const manifest = plugin.manifestJson;
        if (!manifest?.entrypoints?.ui) {
          set.status = 404;
          return { error: "Plugin does not declare a UI bundle" };
        }

        // Resolve UI directory
        const uiDir = resolvePluginUiDir(
          options.localPluginDir,
          plugin.packageName,
          manifest.entrypoints.ui,
          plugin.packagePath,
        );

        if (!uiDir) {
          log.warn(
            { pluginId: plugin.id, pluginKey: plugin.pluginKey, packageName: plugin.packageName },
            "plugin-ui-static: UI directory not found on disk",
          );
          set.status = 404;
          return { error: "Plugin UI directory not found" };
        }

        // Resolve file path and prevent traversal
        const resolvedFilePath = path.resolve(uiDir, rawFilePath);

        let fileStat: fs.Stats;
        try {
          fileStat = fs.statSync(resolvedFilePath);
        } catch {
          set.status = 404;
          return { error: "File not found" };
        }

        // Symlink traversal check
        let realFilePath: string;
        let realUiDir: string;
        try {
          realFilePath = fs.realpathSync(resolvedFilePath);
          realUiDir = fs.realpathSync(uiDir);
        } catch {
          set.status = 404;
          return { error: "File not found" };
        }

        const relative = path.relative(realUiDir, realFilePath);
        if (relative.startsWith("..") || path.isAbsolute(relative)) {
          set.status = 403;
          return { error: "Access denied" };
        }

        if (!fileStat.isFile()) {
          set.status = 404;
          return { error: "File not found" };
        }

        // Cache strategy
        const basename = path.basename(resolvedFilePath);
        const isContentHashed = CONTENT_HASH_PATTERN.test(basename);

        if (isContentHashed) {
          set.headers["cache-control"] = CACHE_CONTROL_IMMUTABLE;
        } else {
          set.headers["cache-control"] = CACHE_CONTROL_REVALIDATE;
          const etag = computeETag(fileStat.size, fileStat.mtimeMs);
          set.headers["etag"] = etag;

          const ifNoneMatch = request.headers.get("if-none-match");
          if (ifNoneMatch === etag) {
            set.status = 304;
            return "";
          }
        }

        // Content-Type
        const ext = path.extname(resolvedFilePath).toLowerCase();
        const contentType = MIME_TYPES[ext];
        if (contentType) {
          set.headers["content-type"] = contentType;
        }

        // CORS
        set.headers["access-control-allow-origin"] = "*";

        // Send file
        return (globalThis as any).Bun?.file?.(resolvedFilePath) ?? new Response(fs.readFileSync(resolvedFilePath));
      },
    );
}
