/**
 * Company document routes — REST surface for company-scoped documents.
 *
 * Mirrors the Paperclip document CRUD model:
 * - list documents by company
 * - get a document by id
 * - create a new document with revision 1
 * - update a document body with revision tracking
 * - list revisions for a document
 */

import { Elysia, t } from "elysia";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { documentRevisions, documents, issueDocuments, issues } from "@clawdev/db";
import { assertCompanyAccess, getActorInfo, type Actor } from "../middleware/authz.js";
import { badRequest, notFound } from "../errors.js";
import { logActivity } from "../services/index.js";

type DocumentRow = {
  id: string;
  companyId: string;
  issueId?: string | null;
  issueIdentifier?: string | null;
  issueTitle?: string | null;
  title: string | null;
  format: string;
  latestBody: string;
  latestRevisionId: string | null;
  latestRevisionNumber: number;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  updatedByAgentId: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapDocumentRow(row: DocumentRow) {
  return {
    id: row.id,
    companyId: row.companyId,
    issueId: row.issueId ?? null,
    issueIdentifier: row.issueIdentifier ?? null,
    issueTitle: row.issueTitle ?? null,
    title: row.title,
    format: row.format,
    body: row.latestBody,
    latestRevisionId: row.latestRevisionId,
    latestRevisionNumber: row.latestRevisionNumber,
    createdByAgentId: row.createdByAgentId,
    createdByUserId: row.createdByUserId,
    updatedByAgentId: row.updatedByAgentId,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function assertDocumentBody(body: any) {
  if (!body || typeof body !== "object") {
    throw badRequest("Invalid request body");
  }
  if (typeof body.body !== "string" || body.body.trim().length === 0) {
    throw badRequest('"body" is required');
  }
}

export function documentRoutes(db: Db) {
  async function getDocumentById(id: string) {
    const rows = await db
      .select({
        id: documents.id,
        companyId: documents.companyId,
        issueId: issueDocuments.issueId,
        issueIdentifier: issues.identifier,
        issueTitle: issues.title,
        title: documents.title,
        format: documents.format,
        latestBody: documents.latestBody,
        latestRevisionId: documents.latestRevisionId,
        latestRevisionNumber: documents.latestRevisionNumber,
        createdByAgentId: documents.createdByAgentId,
        createdByUserId: documents.createdByUserId,
        updatedByAgentId: documents.updatedByAgentId,
        updatedByUserId: documents.updatedByUserId,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .leftJoin(issueDocuments, eq(issueDocuments.documentId, documents.id))
      .leftJoin(issues, eq(issues.id, issueDocuments.issueId))
      .where(eq(documents.id, id))
      .limit(1);
    return (rows[0] ?? null) as DocumentRow | null;
  }

  async function listDocumentRevisions(documentId: string) {
    return db
      .select()
      .from(documentRevisions)
      .where(eq(documentRevisions.documentId, documentId))
      .orderBy(desc(documentRevisions.revisionNumber));
  }

  return new Elysia()
    .get(
      "/companies/:companyId/documents",
      async (ctx: any) => {
        const actor: Actor = ctx.actor;
        const { companyId } = ctx.params;
        const q = typeof ctx.query?.q === "string" ? ctx.query.q.trim() : "";
        assertCompanyAccess(actor, companyId);
        const filters = [eq(documents.companyId, companyId)];
        if (q) {
          const search = `%${q}%`;
          filters.push(
            or(
              ilike(documents.title, search),
              ilike(documents.format, search),
              ilike(documents.latestBody, search),
            )!,
          );
        }
        const rows = await db
          .select({
            id: documents.id,
            companyId: documents.companyId,
            issueId: issueDocuments.issueId,
            issueIdentifier: issues.identifier,
            issueTitle: issues.title,
            title: documents.title,
            format: documents.format,
            latestBody: documents.latestBody,
            latestRevisionId: documents.latestRevisionId,
            latestRevisionNumber: documents.latestRevisionNumber,
            createdByAgentId: documents.createdByAgentId,
            createdByUserId: documents.createdByUserId,
            updatedByAgentId: documents.updatedByAgentId,
            updatedByUserId: documents.updatedByUserId,
            createdAt: documents.createdAt,
            updatedAt: documents.updatedAt,
          })
          .from(documents)
          .leftJoin(issueDocuments, eq(issueDocuments.documentId, documents.id))
          .leftJoin(issues, eq(issues.id, issueDocuments.issueId))
          .where(and(...filters))
          .orderBy(desc(documents.updatedAt));
        return rows.map(mapDocumentRow);
      },
      {
        params: t.Object({ companyId: t.String() }),
        query: t.Object({ q: t.Optional(t.String()) }),
      },
    )

    .post(
      "/companies/:companyId/documents",
      async (ctx: any) => {
        const actor: Actor = ctx.actor;
        const { companyId } = ctx.params;
        const body = ctx.body as {
          title?: string | null;
          format?: string | null;
          body: string;
          changeSummary?: string | null;
        };
        assertCompanyAccess(actor, companyId);
        assertDocumentBody(body);

        const actorInfo = getActorInfo(actor);
        const now = new Date();
        const created = await db.transaction(async (tx) => {
          const [document] = await tx
            .insert(documents)
            .values({
              companyId,
              title: body.title ?? null,
              format: body.format ?? "markdown",
              latestBody: body.body,
              latestRevisionId: null,
              latestRevisionNumber: 1,
              createdByAgentId: actorInfo.agentId,
              createdByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : null,
              updatedByAgentId: actorInfo.agentId,
              updatedByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : null,
              createdAt: now,
              updatedAt: now,
            })
            .returning();

          const [revision] = await tx
            .insert(documentRevisions)
            .values({
              companyId,
              documentId: document.id,
              revisionNumber: 1,
              body: body.body,
              changeSummary: body.changeSummary ?? "Initial version",
              createdByAgentId: actorInfo.agentId,
              createdByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : null,
              createdAt: now,
            })
            .returning();

          const [updated] = await tx
            .update(documents)
            .set({ latestRevisionId: revision.id })
            .where(eq(documents.id, document.id))
            .returning();

          return {
            ...updated,
            latestBody: body.body,
            latestRevisionId: revision.id,
            latestRevisionNumber: 1,
          };
        });

        await logActivity(db, {
          companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          runId: actorInfo.runId,
          action: "document.created",
          entityType: "document",
          entityId: created.id,
          details: { title: created.title, format: created.format },
        });

        return mapDocumentRow(created);
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    .get(
      "/documents/:id",
      async (ctx: any) => {
        const actor: Actor = ctx.actor;
        const document = await getDocumentById(ctx.params.id);
        if (!document) throw notFound("Document not found");
        assertCompanyAccess(actor, document.companyId);
        return mapDocumentRow(document);
      },
      { params: t.Object({ id: t.String() }) },
    )

    .put(
      "/documents/:id",
      async (ctx: any) => {
        const actor: Actor = ctx.actor;
        const body = ctx.body as {
          title?: string | null;
          format?: string | null;
          body: string;
          changeSummary?: string | null;
        };
        assertDocumentBody(body);

        const existing = await getDocumentById(ctx.params.id);
        if (!existing) throw notFound("Document not found");
        assertCompanyAccess(actor, existing.companyId);

        const actorInfo = getActorInfo(actor);
        const now = new Date();
        const nextRevisionNumber = existing.latestRevisionNumber + 1;

        const updated = await db.transaction(async (tx) => {
          const [revision] = await tx
            .insert(documentRevisions)
            .values({
              companyId: existing.companyId,
              documentId: existing.id,
              revisionNumber: nextRevisionNumber,
              body: body.body,
              changeSummary: body.changeSummary ?? null,
              createdByAgentId: actorInfo.agentId,
              createdByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : null,
              createdAt: now,
            })
            .returning();

          const [row] = await tx
            .update(documents)
            .set({
              title: body.title ?? existing.title,
              format: body.format ?? existing.format,
              latestBody: body.body,
              latestRevisionId: revision.id,
              latestRevisionNumber: nextRevisionNumber,
              updatedByAgentId: actorInfo.agentId,
              updatedByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : null,
              updatedAt: now,
            })
            .where(eq(documents.id, existing.id))
            .returning();

          return {
            ...row,
            latestBody: body.body,
            latestRevisionNumber: nextRevisionNumber,
          };
        });

        await logActivity(db, {
          companyId: existing.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          runId: actorInfo.runId,
          action: "document.updated",
          entityType: "document",
          entityId: existing.id,
          details: { title: updated.title, format: updated.format },
        });

        return mapDocumentRow(updated);
      },
      { params: t.Object({ id: t.String() }) },
    )

    .delete(
      "/documents/:id",
      async (ctx: any) => {
        const actor: Actor = ctx.actor;
        const existing = await getDocumentById(ctx.params.id);
        if (!existing) throw notFound("Document not found");
        assertCompanyAccess(actor, existing.companyId);

        const actorInfo = getActorInfo(actor);
        await db.transaction(async (tx) => {
          await tx.delete(documents).where(eq(documents.id, existing.id));
        });

        await logActivity(db, {
          companyId: existing.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          runId: actorInfo.runId,
          action: "document.deleted",
          entityType: "document",
          entityId: existing.id,
          details: { title: existing.title, format: existing.format },
        });

        return mapDocumentRow(existing);
      },
      { params: t.Object({ id: t.String() }) },
    )

    .get(
      "/documents/:id/revisions",
      async (ctx: any) => {
        const actor: Actor = ctx.actor;
        const existing = await getDocumentById(ctx.params.id);
        if (!existing) throw notFound("Document not found");
        assertCompanyAccess(actor, existing.companyId);
        return listDocumentRevisions(existing.id);
      },
      { params: t.Object({ id: t.String() }) },
    );
}
