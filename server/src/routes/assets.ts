/**
 * Asset routes — Elysia port.
 *
 * Handles image uploads (company logos, issue attachments) and content retrieval.
 * Elysia has native multipart/form-data handling, replacing multer.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { assetService, logActivity } from "../services/index.js";
import type { StorageService } from "../storage/types.js";
import { isAllowedContentType, MAX_ATTACHMENT_BYTES } from "../attachment-types.js";

const ALLOWED_COMPANY_LOGO_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

export function assetRoutes(db: Db, storage: StorageService) {
  const assets = assetService(db, storage);

  return new Elysia({ prefix: "/assets" })
    // Upload image for a company
    .post(
      "/companies/:companyId/images",
      async ({ params, body }) => {
        const file = body.file;
        if (!file) return new Response("No file provided", { status: 400 });

        const contentType = file.type;
        if (!ALLOWED_COMPANY_LOGO_CONTENT_TYPES.has(contentType)) {
          return new Response(`Unsupported content type: ${contentType}`, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        if (buffer.length > MAX_ATTACHMENT_BYTES) {
          return new Response("File too large", { status: 413 });
        }

        const result = await assets.uploadImage({
          companyId: params.companyId,
          buffer,
          contentType,
          filename: file.name,
        });

        return result;
      },
      {
        params: t.Object({ companyId: t.String() }),
        body: t.Object({ file: t.File() }),
      },
    )

    // Get asset content
    .get(
      "/:assetId/content",
      async ({ params, set }) => {
        const asset = await assets.getContent(params.assetId);
        if (!asset) return new Response("Not found", { status: 404 });

        set.headers["content-type"] = asset.contentType;
        set.headers["cache-control"] = "public, max-age=31536000, immutable";
        return asset.buffer;
      },
      { params: t.Object({ assetId: t.String() }) },
    );
}
