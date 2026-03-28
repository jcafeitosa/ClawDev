import { Elysia } from "elysia";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import type { Db } from "@clawdev/db";
import { createAssetImageMetadataSchema } from "@clawdev/shared";
import type { StorageService } from "../storage/types.js";
import { assetService, logActivity } from "../services/index.js";
import { isAllowedContentType, MAX_ATTACHMENT_BYTES } from "../attachment-types.js";
import { badRequest, notFound, unprocessable } from "../errors.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { authPlugin } from "../plugins/auth.js";

const SVG_CONTENT_TYPE = "image/svg+xml";
const ALLOWED_COMPANY_LOGO_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  SVG_CONTENT_TYPE,
]);

function sanitizeSvgBuffer(input: Buffer): Buffer | null {
  const raw = input.toString("utf8").trim();
  if (!raw) return null;

  const baseDom = new JSDOM("");
  const domPurify = createDOMPurify(baseDom.window as unknown as Parameters<typeof createDOMPurify>[0]);
  domPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    const attrName = data.attrName.toLowerCase();
    const attrValue = (data.attrValue ?? "").trim();
    if (attrName.startsWith("on")) {
      data.keepAttr = false;
      return;
    }
    if ((attrName === "href" || attrName === "xlink:href") && attrValue && !attrValue.startsWith("#")) {
      data.keepAttr = false;
    }
  });

  let parsedDom: JSDOM | null = null;
  try {
    const sanitized = domPurify.sanitize(raw, {
      USE_PROFILES: { svg: true, svgFilters: true, html: false },
      FORBID_TAGS: ["script", "foreignObject"],
      FORBID_CONTENTS: ["script", "foreignObject"],
      RETURN_TRUSTED_TYPE: false,
    });

    parsedDom = new JSDOM(sanitized, { contentType: SVG_CONTENT_TYPE });
    const document = parsedDom.window.document;
    const root = document.documentElement;
    if (!root || root.tagName.toLowerCase() !== "svg") return null;

    for (const el of Array.from(root.querySelectorAll("script, foreignObject"))) {
      el.remove();
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

async function extractFileFromRequest(request: Request): Promise<{
  buffer: Buffer;
  contentType: string;
  originalName: string;
} | null> {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) return null;
  const arrayBuffer = await file.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: (file.type || "").toLowerCase(),
    originalName: file.name || "upload",
  };
}

export function assetRoutes(db: Db, authPlugin: ReturnType<typeof authPlugin>, storage: StorageService) {
  const svc = assetService(db);

  return new Elysia()
    .use(authPlugin)
    .post("/companies/:companyId/assets/images", async ({ params, request, actor, set }) => {
      assertCompanyAccess(actor, params.companyId);
      const file = await extractFileFromRequest(request);
      if (!file) throw badRequest("Missing file field 'file'");
      if (file.buffer.length > MAX_ATTACHMENT_BYTES) throw unprocessable(`File exceeds ${MAX_ATTACHMENT_BYTES} bytes`);

      const parsedMeta = createAssetImageMetadataSchema.safeParse(
        Object.fromEntries((await request.clone().formData()).entries()),
      );
      if (!parsedMeta.success) throw badRequest("Invalid image metadata");

      const namespaceSuffix = parsedMeta.data.namespace ?? "general";
      if (file.contentType !== SVG_CONTENT_TYPE && !isAllowedContentType(file.contentType)) {
        throw unprocessable(`Unsupported file type: ${file.contentType || "unknown"}`);
      }

      let fileBody = file.buffer;
      if (file.contentType === SVG_CONTENT_TYPE) {
        const sanitized = sanitizeSvgBuffer(file.buffer);
        if (!sanitized || sanitized.length <= 0) throw unprocessable("SVG could not be sanitized");
        fileBody = sanitized;
      }
      if (fileBody.length <= 0) throw unprocessable("Image is empty");

      const actorInfo = getActorInfo(actor);
      const stored = await storage.putFile({
        companyId: params.companyId,
        namespace: `assets/${namespaceSuffix}`,
        originalFilename: file.originalName || null,
        contentType: file.contentType,
        body: fileBody,
      });

      const asset = await svc.create(params.companyId, {
        provider: stored.provider,
        objectKey: stored.objectKey,
        contentType: stored.contentType,
        byteSize: stored.byteSize,
        sha256: stored.sha256,
        originalFilename: stored.originalFilename,
        createdByAgentId: actorInfo.agentId,
        createdByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : null,
      });

      await logActivity(db, {
        companyId: params.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        runId: actorInfo.runId,
        action: "asset.created",
        entityType: "asset",
        entityId: asset.id,
        details: { originalFilename: asset.originalFilename, contentType: asset.contentType, byteSize: asset.byteSize },
      });

      set.status = 201;
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
    })
    .post("/companies/:companyId/logo", async ({ params, request, actor, set }) => {
      assertCompanyAccess(actor, params.companyId);
      const file = await extractFileFromRequest(request);
      if (!file) throw badRequest("Missing file field 'file'");
      if (file.buffer.length > MAX_ATTACHMENT_BYTES) throw unprocessable(`Image exceeds ${MAX_ATTACHMENT_BYTES} bytes`);
      if (!ALLOWED_COMPANY_LOGO_CONTENT_TYPES.has(file.contentType)) {
        throw unprocessable(`Unsupported image type: ${file.contentType || "unknown"}`);
      }

      let fileBody = file.buffer;
      if (file.contentType === SVG_CONTENT_TYPE) {
        const sanitized = sanitizeSvgBuffer(file.buffer);
        if (!sanitized || sanitized.length <= 0) throw unprocessable("SVG could not be sanitized");
        fileBody = sanitized;
      }
      if (fileBody.length <= 0) throw unprocessable("Image is empty");

      const actorInfo = getActorInfo(actor);
      const stored = await storage.putFile({
        companyId: params.companyId,
        namespace: "assets/companies",
        originalFilename: file.originalName || null,
        contentType: file.contentType,
        body: fileBody,
      });

      const asset = await svc.create(params.companyId, {
        provider: stored.provider,
        objectKey: stored.objectKey,
        contentType: stored.contentType,
        byteSize: stored.byteSize,
        sha256: stored.sha256,
        originalFilename: stored.originalFilename,
        createdByAgentId: actorInfo.agentId,
        createdByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : null,
      });

      await logActivity(db, {
        companyId: params.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        runId: actorInfo.runId,
        action: "asset.created",
        entityType: "asset",
        entityId: asset.id,
        details: { originalFilename: asset.originalFilename, contentType: asset.contentType, byteSize: asset.byteSize, namespace: "assets/companies" },
      });

      set.status = 201;
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
    })
    .get("/assets/:assetId/content", async ({ params, actor, set }) => {
      const asset = await svc.getById(params.assetId);
      if (!asset) throw notFound("Asset not found");
      assertCompanyAccess(actor, asset.companyId);

      const object = await storage.getObject(asset.companyId, asset.objectKey);
      const responseContentType = asset.contentType || object.contentType || "application/octet-stream";

      set.headers["content-type"] = responseContentType;
      set.headers["content-length"] = String(asset.byteSize || object.contentLength || 0);
      set.headers["cache-control"] = "private, max-age=60";
      set.headers["x-content-type-options"] = "nosniff";
      if (responseContentType === SVG_CONTENT_TYPE) {
        set.headers["content-security-policy"] = "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'";
      }
      const filename = asset.originalFilename ?? "asset";
      set.headers["content-disposition"] = `inline; filename="${filename.replaceAll('"', '')}"`;

      // Convert Node readable stream to Web ReadableStream for Elysia
      const nodeStream = object.stream;
      const webStream = new ReadableStream({
        start(controller) {
          nodeStream.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
          nodeStream.on("end", () => controller.close());
          nodeStream.on("error", (err: Error) => controller.error(err));
        },
      });

      return new Response(webStream, {
        status: 200,
        headers: Object.fromEntries(
          Object.entries(set.headers).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
        ),
      });
    });
}
