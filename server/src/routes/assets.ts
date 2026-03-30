/**
 * Asset routes — Elysia port.
 *
 * Handles image uploads (company logos, issue attachments) and content retrieval.
 * Elysia has native multipart/form-data handling, replacing multer.
 */

import { Elysia, t } from "elysia";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import type { Db } from "@clawdev/db";
import { assetService, logActivity } from "../services/index.js";
import type { StorageService } from "../storage/types.js";
import { isAllowedContentType, MAX_ATTACHMENT_BYTES } from "../attachment-types.js";

const SVG_CONTENT_TYPE = "image/svg+xml";

const ALLOWED_COMPANY_LOGO_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  SVG_CONTENT_TYPE,
]);

function sanitizeSvgBuffer(input: Buffer<ArrayBuffer>): Buffer<ArrayBuffer> | null {
  const raw = input.toString("utf8").trim();
  if (!raw) return null;

  const baseDom = new JSDOM("");
  const domPurify = createDOMPurify(
    baseDom.window as unknown as Parameters<typeof createDOMPurify>[0],
  );
  domPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    const attrName = data.attrName.toLowerCase();
    const attrValue = (data.attrValue ?? "").trim();

    if (attrName.startsWith("on")) {
      data.keepAttr = false;
      return;
    }

    if ((attrName === "href" || attrName === "xlink:href") && attrValue) {
      if (!attrValue.startsWith("#") || attrValue.startsWith("data:")) {
        data.keepAttr = false;
      }
    }
  });

  let parsedDom: JSDOM | null = null;
  try {
    const sanitized = domPurify.sanitize(raw, {
      USE_PROFILES: { svg: true, svgFilters: true, html: false },
      FORBID_TAGS: ["script", "foreignObject", "use", "image", "iframe", "object", "embed"],
      FORBID_CONTENTS: ["script", "foreignObject"],
      RETURN_TRUSTED_TYPE: false,
    });

    parsedDom = new JSDOM(sanitized, { contentType: SVG_CONTENT_TYPE });
    const document = parsedDom.window.document;
    const root = document.documentElement;
    if (!root || root.tagName.toLowerCase() !== "svg") return null;

    for (const el of Array.from(root.querySelectorAll("script, foreignObject, use, image, iframe, object, embed"))) {
      el.remove();
    }
    for (const style of Array.from(root.querySelectorAll("style"))) {
      if (style.textContent && /@import/i.test(style.textContent)) {
        style.remove();
      }
    }
    for (const el of Array.from(root.querySelectorAll("*"))) {
      for (const attr of Array.from(el.attributes)) {
        const attrName = attr.name.toLowerCase();
        const attrValue = attr.value.trim();
        if (attrName.startsWith("on")) {
          el.removeAttribute(attr.name);
          continue;
        }
        if ((attrName === "href" || attrName === "xlink:href") && attrValue && !attrValue.startsWith("#")) {
          el.removeAttribute(attr.name);
        }
      }
    }

    const output = root.outerHTML.trim();
    if (!output || !/^<svg[\s>]/i.test(output)) return null;
    return Buffer.from(output, "utf8");
  } catch {
    return null;
  } finally {
    parsedDom?.window.close();
    baseDom.window.close();
  }
}

export function assetRoutes(db: Db, storage: StorageService) {
  const svc = assetService(db);

  return new Elysia()
    // Upload image/attachment for a company
    .post(
      "/companies/:companyId/assets/images",
      async (ctx: any) => {
        const { companyId } = ctx.params;
        const body = ctx.body;

        const file = body.file as File | undefined;
        if (!file) {
          ctx.set.status = 400;
          return { error: "Missing file field 'file'" };
        }

        const namespaceSuffix = (body.namespace as string) ?? "general";
        const contentType = (file.type || "").toLowerCase();

        if (contentType !== SVG_CONTENT_TYPE && !isAllowedContentType(contentType)) {
          ctx.set.status = 422;
          return { error: `Unsupported file type: ${contentType || "unknown"}` };
        }

        let fileBody = Buffer.from(await file.arrayBuffer() as ArrayBuffer);

        if (fileBody.length > MAX_ATTACHMENT_BYTES) {
          ctx.set.status = 422;
          return { error: `File exceeds ${MAX_ATTACHMENT_BYTES} bytes` };
        }

        if (contentType === SVG_CONTENT_TYPE) {
          const sanitized = sanitizeSvgBuffer(fileBody);
          if (!sanitized || sanitized.length <= 0) {
            ctx.set.status = 422;
            return { error: "SVG could not be sanitized" };
          }
          fileBody = sanitized;
        }

        if (fileBody.length <= 0) {
          ctx.set.status = 422;
          return { error: "Image is empty" };
        }

        const stored = await storage.putFile({
          companyId,
          namespace: `assets/${namespaceSuffix}`,
          originalFilename: file.name || null,
          contentType,
          body: fileBody,
        });

        const actor = ctx.actor;
        const asset = await svc.create(companyId, {
          provider: stored.provider,
          objectKey: stored.objectKey,
          contentType: stored.contentType,
          byteSize: stored.byteSize,
          sha256: stored.sha256,
          originalFilename: stored.originalFilename,
          createdByAgentId: actor?.agentId ?? null,
          createdByUserId: actor?.userId ?? null,
        });

        await logActivity(db, {
          companyId,
          actorType: actor?.type ?? "unknown",
          actorId: actor?.userId ?? "unknown",
          agentId: actor?.agentId ?? null,
          runId: actor?.runId ?? null,
          action: "asset.created",
          entityType: "asset",
          entityId: asset.id,
          details: {
            originalFilename: asset.originalFilename,
            contentType: asset.contentType,
            byteSize: asset.byteSize,
          },
        });

        ctx.set.status = 201;
        return {
          assetId: asset.id,
          companyId: asset.companyId,
          provider: asset.provider,
          objectKey: asset.objectKey,
          contentType: asset.contentType,
          byteSize: asset.byteSize,
          sha256: asset.sha256,
          originalFilename: asset.originalFilename,
          createdByAgentId: asset.createdByAgentId,
          createdByUserId: asset.createdByUserId,
          createdAt: asset.createdAt,
          updatedAt: asset.updatedAt,
          contentPath: `/api/assets/${asset.id}/content`,
        };
      },
    )

    // Upload company logo
    .post(
      "/companies/:companyId/logo",
      async (ctx: any) => {
        const { companyId } = ctx.params;
        const body = ctx.body;

        const file = body.file as File | undefined;
        if (!file) {
          ctx.set.status = 400;
          return { error: "Missing file field 'file'" };
        }

        const contentType = (file.type || "").toLowerCase();
        if (!ALLOWED_COMPANY_LOGO_CONTENT_TYPES.has(contentType)) {
          ctx.set.status = 422;
          return { error: `Unsupported image type: ${contentType || "unknown"}` };
        }

        let fileBody = Buffer.from(await file.arrayBuffer() as ArrayBuffer);

        if (fileBody.length > MAX_ATTACHMENT_BYTES) {
          ctx.set.status = 422;
          return { error: `Image exceeds ${MAX_ATTACHMENT_BYTES} bytes` };
        }

        if (contentType === SVG_CONTENT_TYPE) {
          const sanitized = sanitizeSvgBuffer(fileBody);
          if (!sanitized || sanitized.length <= 0) {
            ctx.set.status = 422;
            return { error: "SVG could not be sanitized" };
          }
          fileBody = sanitized;
        }

        if (fileBody.length <= 0) {
          ctx.set.status = 422;
          return { error: "Image is empty" };
        }

        const actor = ctx.actor;
        const stored = await storage.putFile({
          companyId,
          namespace: "assets/companies",
          originalFilename: file.name || null,
          contentType,
          body: fileBody,
        });

        const asset = await svc.create(companyId, {
          provider: stored.provider,
          objectKey: stored.objectKey,
          contentType: stored.contentType,
          byteSize: stored.byteSize,
          sha256: stored.sha256,
          originalFilename: stored.originalFilename,
          createdByAgentId: actor?.agentId ?? null,
          createdByUserId: actor?.userId ?? null,
        });

        await logActivity(db, {
          companyId,
          actorType: actor?.type ?? "unknown",
          actorId: actor?.userId ?? "unknown",
          agentId: actor?.agentId ?? null,
          runId: actor?.runId ?? null,
          action: "asset.created",
          entityType: "asset",
          entityId: asset.id,
          details: {
            originalFilename: asset.originalFilename,
            contentType: asset.contentType,
            byteSize: asset.byteSize,
            namespace: "assets/companies",
          },
        });

        ctx.set.status = 201;
        return {
          assetId: asset.id,
          companyId: asset.companyId,
          provider: asset.provider,
          objectKey: asset.objectKey,
          contentType: asset.contentType,
          byteSize: asset.byteSize,
          sha256: asset.sha256,
          originalFilename: asset.originalFilename,
          createdByAgentId: asset.createdByAgentId,
          createdByUserId: asset.createdByUserId,
          createdAt: asset.createdAt,
          updatedAt: asset.updatedAt,
          contentPath: `/api/assets/${asset.id}/content`,
        };
      },
    )

    // Get asset content
    .get(
      "/assets/:assetId/content",
      async ({ params, set }) => {
        const asset = await svc.getById(params.assetId);
        if (!asset) {
          set.status = 404;
          return { error: "Asset not found" };
        }

        const obj = await storage.getObject(asset.companyId, asset.objectKey);

        set.headers["content-type"] = asset.contentType;
        set.headers["cache-control"] = "public, max-age=31536000, immutable";
        return obj.stream;
      },
    );
}
