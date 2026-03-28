import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import {
  addIssueCommentSchema,
  createIssueAttachmentMetadataSchema,
  createIssueWorkProductSchema,
  createIssueLabelSchema,
  checkoutIssueSchema,
  createIssueSchema,
  linkIssueApprovalSchema,
  issueDocumentKeySchema,
  updateIssueWorkProductSchema,
  upsertIssueDocumentSchema,
  updateIssueSchema,
} from "@clawdev/shared";
import type { StorageService } from "../storage/types.js";
import {
  accessService,
  agentService,
  executionWorkspaceService,
  goalService,
  heartbeatService,
  issueApprovalService,
  issueService,
  documentService,
  logActivity,
  projectService,
  routineService,
  workProductService,
} from "../services/index.js";
import { logger } from "../middleware/logger.js";
import { badRequest, forbidden, HttpError, notFound, unauthorized, unprocessable } from "../errors.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { shouldWakeAssigneeOnCheckout } from "../routes/issues-checkout-wakeup.js";
import { isAllowedContentType, MAX_ATTACHMENT_BYTES } from "../attachment-types.js";
import { queueIssueAssignmentWakeup } from "../services/issue-assignment-wakeup.js";
import { authPlugin, type Actor } from "../plugins/auth.js";

const MAX_ISSUE_COMMENT_LIMIT = 500;

export function issueRoutes(db: Db, authPlugin: ReturnType<typeof authPlugin>, storage: StorageService) {
  const svc = issueService(db);
  const access = accessService(db);
  const heartbeat = heartbeatService(db);
  const agentsSvc = agentService(db);
  const projectsSvc = projectService(db);
  const goalsSvc = goalService(db);
  const issueApprovalsSvc = issueApprovalService(db);
  const executionWorkspacesSvc = executionWorkspaceService(db);
  const workProductsSvc = workProductService(db);
  const documentsSvc = documentService(db);
  const routinesSvc = routineService(db);

  function withContentPath<T extends { id: string }>(attachment: T) {
    return { ...attachment, contentPath: `/api/attachments/${attachment.id}/content` };
  }

  function canCreateAgentsLegacy(agent: { permissions: Record<string, unknown> | null | undefined; role: string }) {
    if (agent.role === "ceo") return true;
    if (!agent.permissions || typeof agent.permissions !== "object") return false;
    return Boolean((agent.permissions as Record<string, unknown>).canCreateAgents);
  }

  async function assertCanAssignTasks(actor: Actor, companyId: string) {
    assertCompanyAccess(actor, companyId);
    if (actor.type === "board") {
      if (actor.source === "local_implicit" || actor.isInstanceAdmin) return;
      const allowed = await access.canUser(companyId, actor.userId!, "tasks:assign");
      if (!allowed) throw forbidden("Missing permission: tasks:assign");
      return;
    }
    if (actor.type === "agent") {
      if (!actor.agentId) throw forbidden("Agent authentication required");
      const allowedByGrant = await access.hasPermission(companyId, "agent", actor.agentId, "tasks:assign");
      if (allowedByGrant) return;
      const actorAgent = await agentsSvc.getById(actor.agentId);
      if (actorAgent && actorAgent.companyId === companyId && canCreateAgentsLegacy(actorAgent)) return;
      throw forbidden("Missing permission: tasks:assign");
    }
    throw unauthorized();
  }

  function requireAgentRunId(actor: Actor): string | null {
    if (actor.type !== "agent") return null;
    const runId = actor.runId?.trim();
    if (runId) return runId;
    return null;
  }

  async function assertAgentRunCheckoutOwnership(actor: Actor, issue: { id: string; companyId: string; status: string; assigneeAgentId: string | null }) {
    if (actor.type !== "agent") return true;
    if (!actor.agentId) throw forbidden("Agent authentication required");
    if (issue.status !== "in_progress" || issue.assigneeAgentId !== actor.agentId) return true;
    const runId = requireAgentRunId(actor);
    if (!runId) throw unauthorized("Agent run id required");
    const ownership = await svc.assertCheckoutOwner(issue.id, actor.agentId, runId);
    if (ownership.adoptedFromRunId) {
      const actorInfo = getActorInfo(actor);
      await logActivity(db, { companyId: issue.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "issue.checkout_lock_adopted", entityType: "issue", entityId: issue.id, details: { previousCheckoutRunId: ownership.adoptedFromRunId, checkoutRunId: runId, reason: "stale_checkout_run" } });
    }
    return true;
  }

  async function assertCanManageIssueApprovalLinks(actor: Actor, companyId: string) {
    assertCompanyAccess(actor, companyId);
    if (actor.type === "board") return;
    if (!actor.agentId) throw forbidden("Agent authentication required");
    const actorAgent = await agentsSvc.getById(actor.agentId);
    if (!actorAgent || actorAgent.companyId !== companyId) throw forbidden("Forbidden");
    if (actorAgent.role === "ceo" || Boolean(actorAgent.permissions?.canCreateAgents)) return;
    throw forbidden("Missing permission to link approvals");
  }

  async function normalizeIssueIdentifier(rawId: string): Promise<string> {
    if (/^[A-Z]+-\d+$/i.test(rawId)) { const issue = await svc.getByIdentifier(rawId); if (issue) return issue.id; }
    return rawId;
  }

  async function resolveIssueProjectAndGoal(issue: { companyId: string; projectId: string | null; goalId: string | null }) {
    const [project, directGoal] = await Promise.all([issue.projectId ? projectsSvc.getById(issue.projectId) : null, issue.goalId ? goalsSvc.getById(issue.goalId) : null]);
    if (directGoal) return { project, goal: directGoal };
    const projectGoalId = project?.goalId ?? project?.goalIds[0] ?? null;
    if (projectGoalId) return { project, goal: await goalsSvc.getById(projectGoalId) };
    if (!issue.projectId) return { project, goal: await goalsSvc.getDefaultCompanyGoal(issue.companyId) };
    return { project, goal: null };
  }

  async function extractFileFromRequest(request: Request): Promise<{ buffer: Buffer; contentType: string; originalName: string } | null> {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) return null;
    return { buffer: Buffer.from(await file.arrayBuffer()), contentType: (file.type || "").toLowerCase(), originalName: file.name || "upload" };
  }

  return new Elysia()
    .use(authPlugin)

    .get("/issues", ({ set }) => { set.status = 400; return { error: "Missing companyId in path. Use /api/companies/{companyId}/issues." }; })

    .get("/companies/:companyId/issues", async ({ params, query, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      const q = query as Record<string, string>;
      const resolveMe = (raw: string | undefined) => raw === "me" && actor.type === "board" ? actor.userId : raw;
      const assigneeUserId = resolveMe(q.assigneeUserId);
      const touchedByUserId = resolveMe(q.touchedByUserId);
      const inboxArchivedByUserId = resolveMe(q.inboxArchivedByUserId);
      const unreadForUserId = resolveMe(q.unreadForUserId);
      if (q.assigneeUserId === "me" && (!assigneeUserId || actor.type !== "board")) throw forbidden("assigneeUserId=me requires board authentication");
      if (q.touchedByUserId === "me" && (!touchedByUserId || actor.type !== "board")) throw forbidden("touchedByUserId=me requires board authentication");
      if (q.inboxArchivedByUserId === "me" && (!inboxArchivedByUserId || actor.type !== "board")) throw forbidden("inboxArchivedByUserId=me requires board authentication");
      if (q.unreadForUserId === "me" && (!unreadForUserId || actor.type !== "board")) throw forbidden("unreadForUserId=me requires board authentication");
      return svc.list(params.companyId, { status: q.status, assigneeAgentId: q.assigneeAgentId, participantAgentId: q.participantAgentId, assigneeUserId, touchedByUserId, inboxArchivedByUserId, unreadForUserId, projectId: q.projectId, parentId: q.parentId, labelId: q.labelId, originKind: q.originKind, originId: q.originId, includeRoutineExecutions: q.includeRoutineExecutions === "true" || q.includeRoutineExecutions === "1", q: q.q });
    })

    .get("/companies/:companyId/labels", async ({ params, actor }) => { assertCompanyAccess(actor, params.companyId); return svc.listLabels(params.companyId); })

    .post("/companies/:companyId/labels", async ({ params, body, actor, set }) => {
      assertCompanyAccess(actor, params.companyId);
      const parsed = createIssueLabelSchema.parse(body);
      const label = await svc.createLabel(params.companyId, parsed);
      const actorInfo = getActorInfo(actor);
      await logActivity(db, { companyId: params.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "label.created", entityType: "label", entityId: label.id, details: { name: label.name, color: label.color } });
      set.status = 201;
      return label;
    })

    .delete("/labels/:labelId", async ({ params, actor }) => {
      const existing = await svc.getLabelById(params.labelId);
      if (!existing) throw notFound("Label not found");
      assertCompanyAccess(actor, existing.companyId);
      const removed = await svc.deleteLabel(params.labelId);
      if (!removed) throw notFound("Label not found");
      const actorInfo = getActorInfo(actor);
      await logActivity(db, { companyId: removed.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "label.deleted", entityType: "label", entityId: removed.id, details: { name: removed.name, color: removed.color } });
      return removed;
    })

    .get("/issues/:id", async ({ params, actor }) => {
      const id = await normalizeIssueIdentifier(params.id);
      const issue = await svc.getById(id);
      if (!issue) throw notFound("Issue not found");
      assertCompanyAccess(actor, issue.companyId);
      const [{ project, goal }, ancestors, mentionedProjectIds, documentPayload] = await Promise.all([resolveIssueProjectAndGoal(issue), svc.getAncestors(issue.id), svc.findMentionedProjectIds(issue.id), documentsSvc.getIssueDocumentPayload(issue)]);
      const mentionedProjects = mentionedProjectIds.length > 0 ? await projectsSvc.listByIds(issue.companyId, mentionedProjectIds) : [];
      const currentExecutionWorkspace = issue.executionWorkspaceId ? await executionWorkspacesSvc.getById(issue.executionWorkspaceId) : null;
      const workProducts = await workProductsSvc.listForIssue(issue.id);
      return { ...issue, goalId: goal?.id ?? issue.goalId, ancestors, ...documentPayload, project: project ?? null, goal: goal ?? null, mentionedProjects, currentExecutionWorkspace, workProducts };
    })

    .get("/issues/:id/heartbeat-context", async ({ params, query, actor }) => {
      const id = await normalizeIssueIdentifier(params.id);
      const issue = await svc.getById(id);
      if (!issue) throw notFound("Issue not found");
      assertCompanyAccess(actor, issue.companyId);
      const q = query as Record<string, string>;
      const wakeCommentId = q.wakeCommentId?.trim() || null;
      const [{ project, goal }, ancestors, commentCursor, wakeComment] = await Promise.all([resolveIssueProjectAndGoal(issue), svc.getAncestors(issue.id), svc.getCommentCursor(issue.id), wakeCommentId ? svc.getComment(wakeCommentId) : null]);
      return { issue: { id: issue.id, identifier: issue.identifier, title: issue.title, description: issue.description, status: issue.status, priority: issue.priority, projectId: issue.projectId, goalId: goal?.id ?? issue.goalId, parentId: issue.parentId, assigneeAgentId: issue.assigneeAgentId, assigneeUserId: issue.assigneeUserId, updatedAt: issue.updatedAt }, ancestors: ancestors.map((a) => ({ id: a.id, identifier: a.identifier, title: a.title, status: a.status, priority: a.priority })), project: project ? { id: project.id, name: project.name, status: project.status, targetDate: project.targetDate } : null, goal: goal ? { id: goal.id, title: goal.title, status: goal.status, level: goal.level, parentId: goal.parentId } : null, commentCursor, wakeComment: wakeComment && wakeComment.issueId === issue.id ? wakeComment : null };
    })

    .get("/issues/:id/work-products", async ({ params, actor }) => { const id = await normalizeIssueIdentifier(params.id); const issue = await svc.getById(id); if (!issue) throw notFound("Issue not found"); assertCompanyAccess(actor, issue.companyId); return workProductsSvc.listForIssue(issue.id); })

    .get("/issues/:id/documents", async ({ params, actor }) => { const id = await normalizeIssueIdentifier(params.id); const issue = await svc.getById(id); if (!issue) throw notFound("Issue not found"); assertCompanyAccess(actor, issue.companyId); return documentsSvc.listIssueDocuments(issue.id); })

    .get("/issues/:id/documents/:key", async ({ params, actor }) => {
      const id = await normalizeIssueIdentifier(params.id);
      const issue = await svc.getById(id);
      if (!issue) throw notFound("Issue not found");
      assertCompanyAccess(actor, issue.companyId);
      const keyParsed = issueDocumentKeySchema.safeParse(String(params.key ?? "").trim().toLowerCase());
      if (!keyParsed.success) throw badRequest("Invalid document key");
      const doc = await documentsSvc.getIssueDocumentByKey(issue.id, keyParsed.data);
      if (!doc) throw notFound("Document not found");
      return doc;
    })

    .put("/issues/:id/documents/:key", async ({ params, body, actor, set }) => {
      const id = await normalizeIssueIdentifier(params.id);
      const issue = await svc.getById(id);
      if (!issue) throw notFound("Issue not found");
      assertCompanyAccess(actor, issue.companyId);
      const keyParsed = issueDocumentKeySchema.safeParse(String(params.key ?? "").trim().toLowerCase());
      if (!keyParsed.success) throw badRequest("Invalid document key");
      const parsed = upsertIssueDocumentSchema.parse(body);
      const actorInfo = getActorInfo(actor);
      const result = await documentsSvc.upsertIssueDocument({ issueId: issue.id, key: keyParsed.data, title: (parsed as Record<string, unknown>).title as string ?? null, format: (parsed as Record<string, unknown>).format as string, body: (parsed as Record<string, unknown>).body as string, changeSummary: (parsed as Record<string, unknown>).changeSummary as string ?? null, baseRevisionId: (parsed as Record<string, unknown>).baseRevisionId as string ?? null, createdByAgentId: actorInfo.agentId ?? null, createdByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : null });
      await logActivity(db, { companyId: issue.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: result.created ? "issue.document_created" : "issue.document_updated", entityType: "issue", entityId: issue.id, details: { key: result.document.key, documentId: result.document.id, title: result.document.title, format: result.document.format, revisionNumber: result.document.latestRevisionNumber } });
      set.status = result.created ? 201 : 200;
      return result.document;
    })

    .get("/issues/:id/documents/:key/revisions", async ({ params, actor }) => {
      const id = await normalizeIssueIdentifier(params.id);
      const issue = await svc.getById(id);
      if (!issue) throw notFound("Issue not found");
      assertCompanyAccess(actor, issue.companyId);
      const keyParsed = issueDocumentKeySchema.safeParse(String(params.key ?? "").trim().toLowerCase());
      if (!keyParsed.success) throw badRequest("Invalid document key");
      return documentsSvc.listIssueDocumentRevisions(issue.id, keyParsed.data);
    })

    .delete("/issues/:id/documents/:key", async ({ params, actor }) => {
      const id = await normalizeIssueIdentifier(params.id);
      const issue = await svc.getById(id);
      if (!issue) throw notFound("Issue not found");
      assertCompanyAccess(actor, issue.companyId);
      if (actor.type !== "board") throw forbidden("Board authentication required");
      const keyParsed = issueDocumentKeySchema.safeParse(String(params.key ?? "").trim().toLowerCase());
      if (!keyParsed.success) throw badRequest("Invalid document key");
      const removed = await documentsSvc.deleteIssueDocument(issue.id, keyParsed.data);
      if (!removed) throw notFound("Document not found");
      const actorInfo = getActorInfo(actor);
      await logActivity(db, { companyId: issue.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "issue.document_deleted", entityType: "issue", entityId: issue.id, details: { key: removed.key, documentId: removed.id, title: removed.title } });
      return { ok: true };
    })

    .post("/issues/:id/work-products", async ({ params, body, actor, set }) => {
      const id = await normalizeIssueIdentifier(params.id);
      const issue = await svc.getById(id);
      if (!issue) throw notFound("Issue not found");
      assertCompanyAccess(actor, issue.companyId);
      const parsed = createIssueWorkProductSchema.parse(body);
      const product = await workProductsSvc.createForIssue(issue.id, issue.companyId, { ...parsed, projectId: (parsed as Record<string, unknown>).projectId as string ?? issue.projectId ?? null });
      if (!product) throw unprocessable("Invalid work product payload");
      const actorInfo = getActorInfo(actor);
      await logActivity(db, { companyId: issue.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "issue.work_product_created", entityType: "issue", entityId: issue.id, details: { workProductId: product.id, type: product.type, provider: product.provider } });
      set.status = 201;
      return product;
    })

    .patch("/work-products/:id", async ({ params, body, actor }) => {
      const existing = await workProductsSvc.getById(params.id);
      if (!existing) throw notFound("Work product not found");
      assertCompanyAccess(actor, existing.companyId);
      const parsed = updateIssueWorkProductSchema.parse(body);
      const product = await workProductsSvc.update(params.id, parsed);
      if (!product) throw notFound("Work product not found");
      const actorInfo = getActorInfo(actor);
      await logActivity(db, { companyId: existing.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "issue.work_product_updated", entityType: "issue", entityId: existing.issueId, details: { workProductId: product.id, changedKeys: Object.keys(parsed).sort() } });
      return product;
    })

    .delete("/work-products/:id", async ({ params, actor }) => {
      const existing = await workProductsSvc.getById(params.id);
      if (!existing) throw notFound("Work product not found");
      assertCompanyAccess(actor, existing.companyId);
      const removed = await workProductsSvc.remove(params.id);
      if (!removed) throw notFound("Work product not found");
      const actorInfo = getActorInfo(actor);
      await logActivity(db, { companyId: existing.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "issue.work_product_deleted", entityType: "issue", entityId: existing.issueId, details: { workProductId: removed.id, type: removed.type } });
      return removed;
    })

    .post("/issues/:id/read", async ({ params, actor }) => {
      const id = await normalizeIssueIdentifier(params.id);
      const issue = await svc.getById(id);
      if (!issue) throw notFound("Issue not found");
      assertCompanyAccess(actor, issue.companyId);
      if (actor.type !== "board") throw forbidden("Board authentication required");
      if (!actor.userId) throw forbidden("Board user context required");
      const readState = await svc.markRead(issue.companyId, issue.id, actor.userId, new Date());
      const actorInfo = getActorInfo(actor);
      await logActivity(db, { companyId: issue.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "issue.read_marked", entityType: "issue", entityId: issue.id, details: { userId: actor.userId, lastReadAt: readState.lastReadAt } });
      return readState;
    })

    .post("/issues/:id/inbox-archive", async ({ params, actor }) => {
      const id = await normalizeIssueIdentifier(params.id);
      const issue = await svc.getById(id);
      if (!issue) throw notFound("Issue not found");
      assertCompanyAccess(actor, issue.companyId);
      if (actor.type !== "board") throw forbidden("Board authentication required");
      if (!actor.userId) throw forbidden("Board user context required");
      const archiveState = await svc.archiveInbox(issue.companyId, issue.id, actor.userId, new Date());
      const actorInfo = getActorInfo(actor);
      await logActivity(db, { companyId: issue.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "issue.inbox_archived", entityType: "issue", entityId: issue.id, details: { userId: actor.userId, archivedAt: archiveState.archivedAt } });
      return archiveState;
    })

    .delete("/issues/:id/inbox-archive", async ({ params, actor }) => {
      const id = await normalizeIssueIdentifier(params.id);
      const issue = await svc.getById(id);
      if (!issue) throw notFound("Issue not found");
      assertCompanyAccess(actor, issue.companyId);
      if (actor.type !== "board") throw forbidden("Board authentication required");
      if (!actor.userId) throw forbidden("Board user context required");
      const removed = await svc.unarchiveInbox(issue.companyId, issue.id, actor.userId);
      const actorInfo = getActorInfo(actor);
      await logActivity(db, { companyId: issue.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "issue.inbox_unarchived", entityType: "issue", entityId: issue.id, details: { userId: actor.userId } });
      return removed ?? { ok: true };
    })

    .get("/issues/:id/approvals", async ({ params, actor }) => {
      const id = await normalizeIssueIdentifier(params.id);
      const issue = await svc.getById(id);
      if (!issue) throw notFound("Issue not found");
      assertCompanyAccess(actor, issue.companyId);
      return issueApprovalsSvc.listApprovalsForIssue(id);
    })

    .post("/issues/:id/approvals", async ({ params, body, actor, set }) => {
      const id = await normalizeIssueIdentifier(params.id);
      const issue = await svc.getById(id);
      if (!issue) throw notFound("Issue not found");
      await assertCanManageIssueApprovalLinks(actor, issue.companyId);
      const parsed = linkIssueApprovalSchema.parse(body);
      const actorInfo = getActorInfo(actor);
      await issueApprovalsSvc.link(id, (parsed as Record<string, unknown>).approvalId as string, { agentId: actorInfo.agentId, userId: actorInfo.actorType === "user" ? actorInfo.actorId : null });
      await logActivity(db, { companyId: issue.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "issue.approval_linked", entityType: "issue", entityId: issue.id, details: { approvalId: (parsed as Record<string, unknown>).approvalId } });
      set.status = 201;
      return issueApprovalsSvc.listApprovalsForIssue(id);
    })

    .delete("/issues/:id/approvals/:approvalId", async ({ params, actor }) => {
      const id = await normalizeIssueIdentifier(params.id);
      const issue = await svc.getById(id);
      if (!issue) throw notFound("Issue not found");
      await assertCanManageIssueApprovalLinks(actor, issue.companyId);
      await issueApprovalsSvc.unlink(id, params.approvalId);
      const actorInfo = getActorInfo(actor);
      await logActivity(db, { companyId: issue.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "issue.approval_unlinked", entityType: "issue", entityId: issue.id, details: { approvalId: params.approvalId } });
      return { ok: true };
    })

    .post("/companies/:companyId/issues", async ({ params, body, actor, set }) => {
      assertCompanyAccess(actor, params.companyId);
      const parsed = createIssueSchema.parse(body) as Record<string, unknown>;
      if (parsed.assigneeAgentId || parsed.assigneeUserId) await assertCanAssignTasks(actor, params.companyId);
      const actorInfo = getActorInfo(actor);
      const issue = await svc.create(params.companyId, { ...parsed, createdByAgentId: actorInfo.agentId, createdByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : null } as Parameters<typeof svc.create>[1]);
      await logActivity(db, { companyId: params.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "issue.created", entityType: "issue", entityId: issue.id, details: { title: issue.title, identifier: issue.identifier } });
      void queueIssueAssignmentWakeup({ heartbeat, issue, reason: "issue_assigned", mutation: "create", contextSource: "issue.create", requestedByActorType: actorInfo.actorType, requestedByActorId: actorInfo.actorId });
      set.status = 201;
      return issue;
    })

    .patch("/issues/:id", async ({ params, body, actor }) => {
      const id = await normalizeIssueIdentifier(params.id);
      const existing = await svc.getById(id);
      if (!existing) throw notFound("Issue not found");
      assertCompanyAccess(actor, existing.companyId);
      const parsed = updateIssueSchema.parse(body) as Record<string, unknown>;
      const assigneeWillChange = (parsed.assigneeAgentId !== undefined && parsed.assigneeAgentId !== existing.assigneeAgentId) || (parsed.assigneeUserId !== undefined && parsed.assigneeUserId !== existing.assigneeUserId);
      const isAgentReturningToCreator = actor.type === "agent" && !!actor.agentId && existing.assigneeAgentId === actor.agentId && parsed.assigneeAgentId === null && typeof parsed.assigneeUserId === "string" && !!existing.createdByUserId && parsed.assigneeUserId === existing.createdByUserId;
      if (assigneeWillChange && !isAgentReturningToCreator) await assertCanAssignTasks(actor, existing.companyId);
      await assertAgentRunCheckoutOwnership(actor, existing);
      const actorInfo = getActorInfo(actor);
      const isClosed = existing.status === "done" || existing.status === "cancelled";
      const { comment: commentBody, reopen: reopenRequested, hiddenAt: hiddenAtRaw, ...updateFields } = parsed;
      if (hiddenAtRaw !== undefined) (updateFields as Record<string, unknown>).hiddenAt = hiddenAtRaw ? new Date(hiddenAtRaw as string) : null;
      if (commentBody && reopenRequested === true && isClosed && (updateFields as Record<string, unknown>).status === undefined) (updateFields as Record<string, unknown>).status = "todo";
      let issue;
      try { issue = await svc.update(id, updateFields as Parameters<typeof svc.update>[1]); } catch (err) { if (err instanceof HttpError && err.status === 422) logger.warn({ issueId: id, companyId: existing.companyId, error: (err as Error).message }, "issue update rejected with 422"); throw err; }
      if (!issue) throw notFound("Issue not found");
      await routinesSvc.syncRunStatusForIssue(issue.id);
      if (actorInfo.runId) await heartbeat.reportRunActivity(actorInfo.runId).catch((err: unknown) => logger.warn({ err, runId: actorInfo.runId }, "failed to clear detached run warning after issue activity"));
      const previous: Record<string, unknown> = {};
      for (const key of Object.keys(updateFields)) { if (key in existing && (existing as Record<string, unknown>)[key] !== (updateFields as Record<string, unknown>)[key]) previous[key] = (existing as Record<string, unknown>)[key]; }
      const hasFieldChanges = Object.keys(previous).length > 0;
      const reopened = commentBody && reopenRequested === true && isClosed && previous.status !== undefined && issue.status === "todo";
      await logActivity(db, { companyId: issue.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "issue.updated", entityType: "issue", entityId: issue.id, details: { ...updateFields, identifier: issue.identifier, ...(commentBody ? { source: "comment" } : {}), ...(reopened ? { reopened: true, reopenedFrom: existing.status } : {}), _previous: hasFieldChanges ? previous : undefined } });
      let comment = null;
      if (commentBody) {
        comment = await svc.addComment(id, commentBody as string, { agentId: actorInfo.agentId ?? undefined, userId: actorInfo.actorType === "user" ? actorInfo.actorId : undefined });
        await logActivity(db, { companyId: issue.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "issue.comment_added", entityType: "issue", entityId: issue.id, details: { commentId: comment.id, bodySnippet: comment.body.slice(0, 120), identifier: issue.identifier, issueTitle: issue.title, ...(reopened ? { reopened: true, reopenedFrom: existing.status, source: "comment" } : {}), ...(hasFieldChanges ? { updated: true } : {}) } });
      }
      // Merge wakeups
      void (async () => {
        const wakeups = new Map<string, Parameters<typeof heartbeat.wakeup>[1]>();
        if (assigneeWillChange && issue.assigneeAgentId && issue.status !== "backlog") wakeups.set(issue.assigneeAgentId, { source: "assignment", triggerDetail: "system", reason: "issue_assigned", payload: { issueId: issue.id, mutation: "update" }, requestedByActorType: actorInfo.actorType, requestedByActorId: actorInfo.actorId, contextSnapshot: { issueId: issue.id, source: "issue.update" } });
        const statusChangedFromBacklog = existing.status === "backlog" && issue.status !== "backlog" && parsed.status !== undefined;
        if (!assigneeWillChange && statusChangedFromBacklog && issue.assigneeAgentId) wakeups.set(issue.assigneeAgentId, { source: "automation", triggerDetail: "system", reason: "issue_status_changed", payload: { issueId: issue.id, mutation: "update" }, requestedByActorType: actorInfo.actorType, requestedByActorId: actorInfo.actorId, contextSnapshot: { issueId: issue.id, source: "issue.status_change" } });
        if (commentBody && comment) { let mentionedIds: string[] = []; try { mentionedIds = await svc.findMentionedAgents(issue.companyId, commentBody as string); } catch (err) { logger.warn({ err, issueId: id }, "failed to resolve @-mentions"); } for (const mid of mentionedIds) { if (wakeups.has(mid)) continue; if (actorInfo.actorType === "agent" && actorInfo.actorId === mid) continue; wakeups.set(mid, { source: "automation", triggerDetail: "system", reason: "issue_comment_mentioned", payload: { issueId: id, commentId: comment.id }, requestedByActorType: actorInfo.actorType, requestedByActorId: actorInfo.actorId, contextSnapshot: { issueId: id, taskId: id, commentId: comment.id, wakeCommentId: comment.id, wakeReason: "issue_comment_mentioned", source: "comment.mention" } }); } }
        for (const [agentId, wakeup] of wakeups) heartbeat.wakeup(agentId, wakeup).catch((err: unknown) => logger.warn({ err, issueId: issue.id, agentId }, "failed to wake agent on issue update"));
      })();
      return { ...issue, comment };
    })

    .delete("/issues/:id", async ({ params, actor }) => {
      const id = await normalizeIssueIdentifier(params.id);
      const existing = await svc.getById(id);
      if (!existing) throw notFound("Issue not found");
      assertCompanyAccess(actor, existing.companyId);
      const attachments = await svc.listAttachments(id);
      const issue = await svc.remove(id);
      if (!issue) throw notFound("Issue not found");
      for (const att of attachments) { try { await storage.deleteObject(att.companyId, att.objectKey); } catch (err) { logger.warn({ err, issueId: id, attachmentId: att.id }, "failed to delete attachment object during issue delete"); } }
      const actorInfo = getActorInfo(actor);
      await logActivity(db, { companyId: issue.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "issue.deleted", entityType: "issue", entityId: issue.id });
      return issue;
    })

    .post("/issues/:id/checkout", async ({ params, body, actor }) => {
      const id = await normalizeIssueIdentifier(params.id);
      const issue = await svc.getById(id);
      if (!issue) throw notFound("Issue not found");
      assertCompanyAccess(actor, issue.companyId);
      const parsed = checkoutIssueSchema.parse(body) as Record<string, unknown>;
      if (issue.projectId) { const project = await projectsSvc.getById(issue.projectId); if (project?.pausedAt) throw forbidden(project.pauseReason === "budget" ? "Project is paused because its budget hard-stop was reached" : "Project is paused"); }
      if (actor.type === "agent" && actor.agentId !== parsed.agentId) throw forbidden("Agent can only checkout as itself");
      const checkoutRunId = requireAgentRunId(actor);
      if (actor.type === "agent" && !checkoutRunId) throw unauthorized("Agent run id required");
      const updated = await svc.checkout(id, parsed.agentId as string, (parsed.expectedStatuses as string[] | undefined) ?? [], checkoutRunId);
      const actorInfo = getActorInfo(actor);
      await logActivity(db, { companyId: issue.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "issue.checked_out", entityType: "issue", entityId: issue.id, details: { agentId: parsed.agentId } });
      if (shouldWakeAssigneeOnCheckout({ actorType: actor.type, actorAgentId: actor.type === "agent" ? actor.agentId ?? null : null, checkoutAgentId: parsed.agentId as string, checkoutRunId })) void heartbeat.wakeup(parsed.agentId as string, { source: "assignment", triggerDetail: "system", reason: "issue_checked_out", payload: { issueId: issue.id, mutation: "checkout" }, requestedByActorType: actorInfo.actorType, requestedByActorId: actorInfo.actorId, contextSnapshot: { issueId: issue.id, source: "issue.checkout" } }).catch((err: unknown) => logger.warn({ err, issueId: issue.id }, "failed to wake assignee on issue checkout"));
      return updated;
    })

    .post("/issues/:id/release", async ({ params, actor }) => {
      const id = await normalizeIssueIdentifier(params.id);
      const existing = await svc.getById(id);
      if (!existing) throw notFound("Issue not found");
      assertCompanyAccess(actor, existing.companyId);
      await assertAgentRunCheckoutOwnership(actor, existing);
      const actorRunId = requireAgentRunId(actor);
      if (actor.type === "agent" && !actorRunId) throw unauthorized("Agent run id required");
      const released = await svc.release(id, actor.type === "agent" ? actor.agentId : undefined, actorRunId);
      if (!released) throw notFound("Issue not found");
      const actorInfo = getActorInfo(actor);
      await logActivity(db, { companyId: released.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "issue.released", entityType: "issue", entityId: released.id });
      return released;
    })

    .get("/issues/:id/comments", async ({ params, query, actor }) => {
      const id = await normalizeIssueIdentifier(params.id);
      const issue = await svc.getById(id);
      if (!issue) throw notFound("Issue not found");
      assertCompanyAccess(actor, issue.companyId);
      const q = query as Record<string, string>;
      const afterCommentId = q.after?.trim() || q.afterCommentId?.trim() || null;
      const order = q.order?.trim().toLowerCase() === "asc" ? "asc" as const : "desc" as const;
      const limitRaw = q.limit ? Number(q.limit) : null;
      const limit = limitRaw && Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), MAX_ISSUE_COMMENT_LIMIT) : null;
      return svc.listComments(id, { afterCommentId, order, limit });
    })

    .get("/issues/:id/comments/:commentId", async ({ params, actor }) => {
      const id = await normalizeIssueIdentifier(params.id);
      const issue = await svc.getById(id);
      if (!issue) throw notFound("Issue not found");
      assertCompanyAccess(actor, issue.companyId);
      const comment = await svc.getComment(params.commentId);
      if (!comment || comment.issueId !== id) throw notFound("Comment not found");
      return comment;
    })

    .post("/issues/:id/comments", async ({ params, body, actor, set }) => {
      const id = await normalizeIssueIdentifier(params.id);
      const issue = await svc.getById(id);
      if (!issue) throw notFound("Issue not found");
      assertCompanyAccess(actor, issue.companyId);
      await assertAgentRunCheckoutOwnership(actor, issue);
      const parsed = addIssueCommentSchema.parse(body) as Record<string, unknown>;
      const actorInfo = getActorInfo(actor);
      const reopenRequested = parsed.reopen === true;
      const interruptRequested = parsed.interrupt === true;
      const isClosed = issue.status === "done" || issue.status === "cancelled";
      let reopened = false;
      let reopenFromStatus: string | null = null;
      let interruptedRunId: string | null = null;
      let currentIssue = issue;
      if (reopenRequested && isClosed) {
        const reopenedIssue = await svc.update(id, { status: "todo" });
        if (!reopenedIssue) throw notFound("Issue not found");
        reopened = true; reopenFromStatus = issue.status; currentIssue = reopenedIssue;
        await logActivity(db, { companyId: currentIssue.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "issue.updated", entityType: "issue", entityId: currentIssue.id, details: { status: "todo", reopened: true, reopenedFrom: reopenFromStatus, source: "comment", identifier: currentIssue.identifier } });
      }
      if (interruptRequested) {
        if (actor.type !== "board") throw forbidden("Only board users can interrupt active runs from issue comments");
        let runToInterrupt = currentIssue.executionRunId ? await heartbeat.getRun(currentIssue.executionRunId) : null;
        if ((!runToInterrupt || runToInterrupt.status !== "running") && currentIssue.assigneeAgentId) { const activeRun = await heartbeat.getActiveRunForAgent(currentIssue.assigneeAgentId); const ctx = activeRun?.contextSnapshot as Record<string, unknown> | null; if (activeRun && activeRun.status === "running" && typeof ctx?.issueId === "string" && ctx.issueId === currentIssue.id) runToInterrupt = activeRun; }
        if (runToInterrupt && runToInterrupt.status === "running") { const cancelled = await heartbeat.cancelRun(runToInterrupt.id); if (cancelled) { interruptedRunId = cancelled.id; await logActivity(db, { companyId: cancelled.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "heartbeat.cancelled", entityType: "heartbeat_run", entityId: cancelled.id, details: { agentId: cancelled.agentId, source: "issue_comment_interrupt", issueId: currentIssue.id } }); } }
      }
      const comment = await svc.addComment(id, parsed.body as string, { agentId: actorInfo.agentId ?? undefined, userId: actorInfo.actorType === "user" ? actorInfo.actorId : undefined });
      if (actorInfo.runId) await heartbeat.reportRunActivity(actorInfo.runId).catch((err: unknown) => logger.warn({ err, runId: actorInfo.runId }, "failed to clear detached run warning after issue comment"));
      await logActivity(db, { companyId: currentIssue.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "issue.comment_added", entityType: "issue", entityId: currentIssue.id, details: { commentId: comment.id, bodySnippet: comment.body.slice(0, 120), identifier: currentIssue.identifier, issueTitle: currentIssue.title, ...(reopened ? { reopened: true, reopenedFrom: reopenFromStatus, source: "comment" } : {}), ...(interruptedRunId ? { interruptedRunId } : {}) } });
      // Merge wakeups
      void (async () => {
        const wakeups = new Map<string, Parameters<typeof heartbeat.wakeup>[1]>();
        const assigneeId = currentIssue.assigneeAgentId;
        const selfComment = actorInfo.actorType === "agent" && actorInfo.actorId === assigneeId;
        const skipWake = selfComment || isClosed;
        if (assigneeId && (reopened || !skipWake)) {
          wakeups.set(assigneeId, { source: "automation", triggerDetail: "system", reason: reopened ? "issue_reopened_via_comment" : "issue_commented", payload: { issueId: currentIssue.id, commentId: comment.id, ...(reopened ? { reopenedFrom: reopenFromStatus } : {}), mutation: "comment", ...(interruptedRunId ? { interruptedRunId } : {}) }, requestedByActorType: actorInfo.actorType, requestedByActorId: actorInfo.actorId, contextSnapshot: { issueId: currentIssue.id, taskId: currentIssue.id, commentId: comment.id, source: reopened ? "issue.comment.reopen" : "issue.comment", wakeReason: reopened ? "issue_reopened_via_comment" : "issue_commented", ...(reopened ? { reopenedFrom: reopenFromStatus } : {}), ...(interruptedRunId ? { interruptedRunId } : {}) } });
        }
        let mentionedIds: string[] = []; try { mentionedIds = await svc.findMentionedAgents(issue.companyId, parsed.body as string); } catch (err) { logger.warn({ err, issueId: id }, "failed to resolve @-mentions"); }
        for (const mid of mentionedIds) { if (wakeups.has(mid)) continue; if (actorInfo.actorType === "agent" && actorInfo.actorId === mid) continue; wakeups.set(mid, { source: "automation", triggerDetail: "system", reason: "issue_comment_mentioned", payload: { issueId: id, commentId: comment.id }, requestedByActorType: actorInfo.actorType, requestedByActorId: actorInfo.actorId, contextSnapshot: { issueId: id, taskId: id, commentId: comment.id, wakeCommentId: comment.id, wakeReason: "issue_comment_mentioned", source: "comment.mention" } }); }
        for (const [agentId, wakeup] of wakeups) heartbeat.wakeup(agentId, wakeup).catch((err: unknown) => logger.warn({ err, issueId: currentIssue.id, agentId }, "failed to wake agent on issue comment"));
      })();
      set.status = 201;
      return comment;
    })

    .get("/issues/:id/attachments", async ({ params, actor }) => {
      const id = await normalizeIssueIdentifier(params.id);
      const issue = await svc.getById(id);
      if (!issue) throw notFound("Issue not found");
      assertCompanyAccess(actor, issue.companyId);
      const attachments = await svc.listAttachments(id);
      return attachments.map(withContentPath);
    })

    .post("/companies/:companyId/issues/:issueId/attachments", async ({ params, request, actor, set }) => {
      assertCompanyAccess(actor, params.companyId);
      const issueId = await normalizeIssueIdentifier(params.issueId);
      const issue = await svc.getById(issueId);
      if (!issue) throw notFound("Issue not found");
      if (issue.companyId !== params.companyId) throw unprocessable("Issue does not belong to company");
      const file = await extractFileFromRequest(request);
      if (!file) throw badRequest("Missing file field 'file'");
      if (file.buffer.length > MAX_ATTACHMENT_BYTES) throw unprocessable(`Attachment exceeds ${MAX_ATTACHMENT_BYTES} bytes`);
      if (!isAllowedContentType(file.contentType)) throw unprocessable(`Unsupported attachment type: ${file.contentType || "unknown"}`);
      if (file.buffer.length <= 0) throw unprocessable("Attachment is empty");
      const parsedMeta = createIssueAttachmentMetadataSchema.safeParse(Object.fromEntries((await request.clone().formData()).entries()));
      if (!parsedMeta.success) throw badRequest("Invalid attachment metadata");
      const actorInfo = getActorInfo(actor);
      const stored = await storage.putFile({ companyId: params.companyId, namespace: `issues/${issueId}`, originalFilename: file.originalName || null, contentType: file.contentType, body: file.buffer });
      const attachment = await svc.createAttachment({ issueId, issueCommentId: parsedMeta.data.issueCommentId ?? null, provider: stored.provider, objectKey: stored.objectKey, contentType: stored.contentType, byteSize: stored.byteSize, sha256: stored.sha256, originalFilename: stored.originalFilename, createdByAgentId: actorInfo.agentId, createdByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : null });
      await logActivity(db, { companyId: params.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "issue.attachment_added", entityType: "issue", entityId: issueId, details: { attachmentId: attachment.id, originalFilename: attachment.originalFilename, contentType: attachment.contentType, byteSize: attachment.byteSize } });
      set.status = 201;
      return withContentPath(attachment);
    })

    .get("/attachments/:attachmentId/content", async ({ params, actor, set }) => {
      const attachment = await svc.getAttachmentById(params.attachmentId);
      if (!attachment) throw notFound("Attachment not found");
      assertCompanyAccess(actor, attachment.companyId);
      const object = await storage.getObject(attachment.companyId, attachment.objectKey);
      const ct = attachment.contentType || object.contentType || "application/octet-stream";
      const filename = attachment.originalFilename ?? "attachment";
      const headers: Record<string, string> = { "content-type": ct, "content-length": String(attachment.byteSize || object.contentLength || 0), "cache-control": "private, max-age=60", "content-disposition": `inline; filename="${filename.replaceAll('"', '')}"` };
      const nodeStream = object.stream;
      const webStream = new ReadableStream({ start(controller) { nodeStream.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk))); nodeStream.on("end", () => controller.close()); nodeStream.on("error", (err: Error) => controller.error(err)); } });
      return new Response(webStream, { status: 200, headers });
    })

    .delete("/attachments/:attachmentId", async ({ params, actor }) => {
      const attachment = await svc.getAttachmentById(params.attachmentId);
      if (!attachment) throw notFound("Attachment not found");
      assertCompanyAccess(actor, attachment.companyId);
      try { await storage.deleteObject(attachment.companyId, attachment.objectKey); } catch (err) { logger.warn({ err, attachmentId: params.attachmentId }, "storage delete failed while removing attachment"); }
      const removed = await svc.removeAttachment(params.attachmentId);
      if (!removed) throw notFound("Attachment not found");
      const actorInfo = getActorInfo(actor);
      await logActivity(db, { companyId: removed.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "issue.attachment_removed", entityType: "issue", entityId: removed.issueId, details: { attachmentId: removed.id } });
      return { ok: true };
    });
}
