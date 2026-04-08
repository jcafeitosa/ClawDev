<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { api } from "$lib/api";
  import { companyStore, resolveCompanyIdFromPrefix } from "$stores/company.svelte.js";
  import { pluginUiContributionsStore } from "$stores/plugin-ui-contributions.svelte.js";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { toastStore } from "$stores/toast.svelte.js";
  import { PluginLauncherOutlet, PluginRenderer } from "$lib/components/plugins/index.js";
  import { PageSkeleton, PropertiesPanel, PropertyRow, StatusBadge, PriorityIcon, TimeAgo, EmptyState } from "$components/index.js";
  import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Separator, Tabs, TabsList, TabsTrigger, TabsContent, Textarea, Input, Label, Alert } from "$components/ui/index.js";
  import { PageLayout } from "$components/layout/index.js";
  import InlineEditor from "$lib/components/inline-editor.svelte";
  import MarkdownBody from "$lib/components/markdown-body.svelte";
  import LiveRunWidget from "$lib/components/live-run-widget.svelte";
  import CommentThread from "$lib/components/comment-thread.svelte";
  import IssueWorkspaceCard from "$lib/components/issue-workspace-card.svelte";
  import ScrollToBottom from "$lib/components/scroll-to-bottom.svelte";
  import { onMount, onDestroy } from "svelte";
  import { Pencil, GitBranchPlus, GitMerge, Eye, Trash2, Plus, Download, X, Upload, FileText, BookOpen, ExternalLink, Activity, ListTree, Tag, PanelRightOpen, PanelRightClose, ChevronRight, ChevronDown, User, Calendar, Clock, History as HistoryIcon, Copy, Check } from "lucide-svelte";
  import {
    composeStructuredSddDescription,
    parseStructuredSddDescription,
    validateStructuredSddInput,
  } from "@clawdev/shared";

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface Issue {
    id: string;
    identifier?: string;
    title: string;
    description?: string | null;
    status: string;
    priority?: string | null;
    assigneeAgentId?: string | null;
    assigneeUserId?: string | null;
    executionRunId?: string | null;
    projectId?: string | null;
    goalId?: string | null;
    parentId?: string | null;
    companyId: string;
    checkedOutBy?: string | null;
    createdByAgentId?: string | null;
    createdByUserId?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    labels?: Array<{ id: string; name: string; color?: string }> | null;
    createdAt?: string;
    updatedAt?: string;
    project?: { id: string; name: string; status?: string } | null;
    goal?: { id: string; title: string } | null;
    ancestors?: Array<{ id: string; identifier?: string; title: string; status: string }>;
    workProducts?: WorkProduct[];
    documents?: Record<string, unknown>;
    descriptionDocument?: { content?: string } | null;
    planDocument?: { content?: string } | null;
    [key: string]: unknown;
  }

  interface Comment {
    id: string;
    body: string;
    agentId?: string | null;
    userId?: string | null;
    createdAt?: string;
    [key: string]: unknown;
  }

  interface WorkProduct {
    id: string;
    title?: string | null;
    kind?: string;
    url?: string | null;
    status?: string;
    createdAt?: string;
    [key: string]: unknown;
  }

  interface IssueDocument {
    id: string;
    key: string;
    title?: string | null;
    format?: string | null;
    content?: string | null;
    body?: string | null;
    latestRevisionId?: string | null;
    latestRevisionNumber?: number | null;
    updatedAt?: string;
    [key: string]: unknown;
  }

  interface IssueDocumentRevision {
    id: string;
    revisionNumber: number;
    body: string;
    changeSummary?: string | null;
    createdAt: string;
  }

  interface Agent {
    id: string;
    name: string;
    [key: string]: unknown;
  }

  interface Attachment {
    id: string;
    filename: string;
    size?: number;
    mimeType?: string;
    createdAt?: string;
    [key: string]: unknown;
  }

  interface SubIssue {
    id: string;
    identifier?: string;
    title: string;
    status: string;
    priority?: string | null;
    [key: string]: unknown;
  }

  interface ActivityEntry {
    id: string;
    actor?: string | null;
    actorName?: string | null;
    actorType?: string | null;
    actorId?: string | null;
    action: string;
    details?: Record<string, unknown> | null;
    createdAt?: string;
    [key: string]: unknown;
  }

  interface Run {
    id: string;
    status: string;
    agentId?: string | null;
    agentName?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
    summary?: string | null;
    usageJson?: Record<string, unknown> | null;
    resultJson?: Record<string, unknown> | null;
    [key: string]: unknown;
  }

  interface Approval {
    id: string;
    type: string;
    status: string;
    createdAt?: string;
    [key: string]: unknown;
  }

  interface IssueLabel {
    id: string;
    name: string;
    color?: string | null;
    [key: string]: unknown;
  }

  interface PluginDetailTab {
    id: string;
    pluginId: string;
    label: string;
    routePath: string | null;
  }

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const ISSUE_STATUSES = ["backlog", "todo", "in_progress", "in_review", "blocked", "completed", "cancelled"] as const;
  const ISSUE_PRIORITIES = ["critical", "high", "medium", "low"] as const;
  const WP_KINDS = ["code_pull_request", "document", "report", "other"] as const;
  const WP_STATUSES = ["draft", "in_review", "approved", "rejected"] as const;

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let issue = $state<Issue | null>(null);
  let comments = $state<Comment[]>([]);
  let documents = $state<IssueDocument[]>([]);
  let attachments = $state<Attachment[]>([]);
  let agents = $state<Agent[]>([]);
  let subIssues = $state<SubIssue[]>([]);
  let activityEntries = $state<ActivityEntry[]>([]);
  let runs = $state<Run[]>([]);
  let linkedApprovals = $state<Approval[]>([]);
  let pluginDetailTabs = $state<PluginDetailTab[]>([]);
  let labels = $state<IssueLabel[]>([]);
  let approvalsOpen = $state(false);
  let loading = $state(true);
  let notFound = $state(false);
  let activeTab = $state("details");
  let pluginTabsLoadError = $state<string | null>(null);
  // Comment submission/deletion handled by CommentThread component

  // -- Inline edit state
  let editing = $state(false);
  let editTitle = $state("");
  let editStatus = $state("");
  let editPriority = $state("");
  let editAssigneeAgentId = $state("");
  let editLabelIds = $state<string[]>([]);
  let editDescription = $state("");
  let editSddSpec = $state("");
  let editSddDesign = $state("");
  let editSddRisk = $state("");
  let editSddRollout = $state("");
  let editSddRollback = $state("");
  let editSddValidation = $state("");
  let savingEdit = $state(false);

  // -- Delete confirmation state
  let showDeleteConfirm = $state(false);
  let deleting = $state(false);

  // -- Checkout/Release state
  let checkingOut = $state(false);
  let markingRead = $state(false);

  // -- Work product form state
  let showWpForm = $state(false);
  let wpTitle = $state("");
  let wpKind = $state<string>(WP_KINDS[0]);
  let wpUrl = $state("");
  let wpStatus = $state<string>(WP_STATUSES[0]);
  let submittingWp = $state(false);

  // -- Work product edit state
  let editingWpId = $state<string | null>(null);
  let editWpTitle = $state("");
  let editWpKind = $state<string>(WP_KINDS[0]);
  let editWpUrl = $state("");
  let editWpStatus = $state<string>(WP_STATUSES[0]);
  let savingWpEdit = $state(false);

  // -- Attachment upload state
  let uploading = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);

  // -- Sub-issue create state
  let showSubIssueForm = $state(false);
  let newSubIssueTitle = $state("");
  let submittingSubIssue = $state(false);

  // -- New document form state
  let showDocForm = $state(false);
  let newDocKey = $state("");
  let newDocTitle = $state("");
  let newDocContent = $state("");
  let submittingDoc = $state(false);
  let editingDocKey = $state<string | null>(null);
  let editingDocContent = $state("");
  let editingDocTitle = $state("");
  let editingDocSummary = $state("");
  let savingDoc = $state(false);
  let docRevisionKey = $state<string | null>(null);
  let docRevisions = $state<IssueDocumentRevision[]>([]);
  let docRevisionsLoading = $state(false);
  let documentsLoaded = $state(false);
  let foldedDocumentKeys = $state<string[]>([]);
  let copiedDocumentKey = $state<string | null>(null);
  let confirmDeleteDocumentKey = $state<string | null>(null);
  let copiedDocumentTimer: ReturnType<typeof setTimeout> | null = null;

  // -- Properties panel state
  let showPropertiesPanel = $state(true);
  let agentMap = $state<Record<string, string>>({});

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let issueId = $derived($page.params.issueId);
  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(issue?.companyId ?? routeCompanyId ?? companyStore.selectedCompanyId ?? null);
  let isCheckedOut = $derived(!!issue?.checkedOutBy);
  let prefix = $derived($page.params.companyPrefix);
  let issuePluginHostContext = $derived({
    companyId,
    companyPrefix: prefix ?? null,
    projectId: issue?.projectId ?? null,
    entityId: (issue?.id ?? issueId) ?? null,
    entityType: "issue",
    parentEntityId: issue?.parentId ?? null,
    userId: null,
  });

  const issueDocumentFoldStorageKey = (id: string) => `clawdev:issue-document-folds:${id}`;

  function loadFoldedDocumentKeys(issueId: string): string[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(issueDocumentFoldStorageKey(issueId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
    } catch {
      return [];
    }
  }

  function saveFoldedDocumentKeys(issueId: string, keys: string[]) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(issueDocumentFoldStorageKey(issueId), JSON.stringify(keys));
  }

  function isPlanKey(key: string) {
    return key.trim().toLowerCase() === "plan";
  }

  function toggleDocumentFold(key: string) {
    foldedDocumentKeys = foldedDocumentKeys.includes(key)
      ? foldedDocumentKeys.filter((entry) => entry !== key)
      : [...foldedDocumentKeys, key];
  }

  async function copyDocumentBody(key: string, body: string) {
    try {
      await navigator.clipboard.writeText(body);
      copiedDocumentKey = key;
      if (copiedDocumentTimer) clearTimeout(copiedDocumentTimer);
      copiedDocumentTimer = setTimeout(() => {
        copiedDocumentKey = copiedDocumentKey === key ? null : copiedDocumentKey;
      }, 1400);
    } catch {
      toastStore.push({ title: "Failed to copy document", tone: "error" });
    }
  }

  function downloadDocumentFile(key: string, body: string) {
    const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${key}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function deleteDocument(docKey: string) {
    if (!issueId) return;
    const res = await api(`/api/issues/${issueId}/documents/${encodeURIComponent(docKey)}`, { method: "DELETE" });
    if (!res.ok) {
      toastStore.push({ title: "Failed to delete document", body: await res.text(), tone: "error" });
      return;
    }
    toastStore.push({ title: "Document deleted", tone: "success" });
    confirmDeleteDocumentKey = null;
    await loadDocuments();
  }

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function loadIssue() {
    if (!issueId) return;
    loading = true;
    notFound = false;
    try {
      const res = await api(`/api/issues/${issueId}`);
      if (!res.ok) {
        if (res.status === 404) { notFound = true; return; }
        throw new Error(await res.text());
      }
      issue = (await res.json()) as Issue;
      // Build breadcrumb with ancestor chain
      const crumbs: Array<{ label: string; href?: string }> = [
        { label: "Issues", href: `/${$page.params.companyPrefix}/issues` },
      ];
      if (issue.ancestors && issue.ancestors.length > 0) {
        // ancestors come in parent-first order (nearest first)
        const reversed = [...issue.ancestors].reverse();
        for (const a of reversed) {
          crumbs.push({
            label: a.identifier ?? a.title,
            href: `/${$page.params.companyPrefix}/issues/${a.id}`,
          });
        }
      }
      crumbs.push({ label: issue.identifier ?? issue.title });
      breadcrumbStore.set(crumbs);
    } catch (err: any) {
      if (!notFound) {
        toastStore.push({ title: "Failed to load issue", body: err?.message, tone: "error" });
      }
    } finally {
      loading = false;
    }
  }

  async function loadComments() {
    if (!issueId) return;
    try {
      const res = await api(`/api/issues/${issueId}/comments`);
      comments = res.ok ? ((await res.json()) as Comment[]) ?? [] : [];
    } catch {
      comments = [];
    }
  }

  async function loadDocuments() {
    if (!issueId) return;
    try {
      const res = await api(`/api/issues/${issueId}/documents`);
      documents = res.ok ? ((await res.json()) as IssueDocument[]) ?? [] : [];
    } catch {
      documents = [];
    } finally {
      documentsLoaded = true;
    }
  }

  async function loadDocumentRevisions(key: string) {
    if (!issueId) return;
    docRevisionKey = key;
    docRevisionsLoading = true;
    try {
      const res = await api(`/api/issues/${issueId}/documents/${encodeURIComponent(key)}/revisions`);
      docRevisions = res.ok ? ((await res.json()) as IssueDocumentRevision[]) ?? [] : [];
    } catch {
      docRevisions = [];
    } finally {
      docRevisionsLoading = false;
    }
  }

  async function loadAttachments() {
    if (!issueId) return;
    try {
      const res = await api(`/api/issues/${issueId}/attachments`);
      attachments = res.ok ? ((await res.json()) as Attachment[]) ?? [] : [];
    } catch {
      attachments = [];
    }
  }

  async function loadAgents() {
    if (!companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/agents`);
      agents = res.ok ? ((await res.json()) as Agent[]) ?? [] : [];
      const map: Record<string, string> = {};
      for (const a of agents) map[a.id] = a.name;
      agentMap = map;
    } catch {
      agents = [];
    }
  }

  async function loadLabels() {
    if (!companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/labels`);
      labels = res.ok ? ((await res.json()) as IssueLabel[]) ?? [] : [];
    } catch {
      labels = [];
    }
  }

  async function loadSubIssues() {
    if (!issueId || !companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/issues?parentId=${issueId}`);
      if (res.ok) {
        const data = await res.json();
        subIssues = Array.isArray(data) ? data : data.data ?? data.issues ?? [];
      } else {
        subIssues = [];
      }
    } catch {
      subIssues = [];
    }
  }

  async function loadActivity() {
    if (!issueId) return;
    try {
      const res = await api(`/api/issues/${issueId}/activity`);
      activityEntries = res.ok ? ((await res.json()) as ActivityEntry[]) ?? [] : [];
    } catch {
      activityEntries = [];
    }
  }

  async function loadRuns() {
    if (!issueId) return;
    try {
      const res = await api(`/api/issues/${issueId}/runs`);
      runs = res.ok ? ((await res.json()) as Run[]) ?? [] : [];
    } catch {
      runs = [];
    }
  }

  async function loadApprovals() {
    if (!issueId) return;
    try {
      const res = await api(`/api/issues/${issueId}/approvals`);
      linkedApprovals = res.ok ? ((await res.json()) as Approval[]) ?? [] : [];
    } catch {
      linkedApprovals = [];
    }
  }

  async function loadPluginDetailTabs() {
    pluginTabsLoadError = null;
    try {
      const contributions = await pluginUiContributionsStore.load();
      const tabs: PluginDetailTab[] = [];
      for (const contribution of contributions ?? []) {
        for (const slot of contribution.slots ?? []) {
          if (slot.type !== "detailTab") continue;
          tabs.push({
            id: slot.id,
            pluginId: contribution.pluginId,
            label: slot.displayName ?? contribution.displayName ?? contribution.pluginKey ?? contribution.pluginId,
            routePath: slot.routePath ?? null,
          });
        }
      }
      tabs.sort((left, right) => {
        const labelCmp = left.label.localeCompare(right.label);
        if (labelCmp !== 0) return labelCmp;
        return left.id.localeCompare(right.id);
      });
      pluginDetailTabs = tabs;
    } catch (err: any) {
      pluginDetailTabs = [];
      pluginTabsLoadError = err?.message ?? "Failed to load plugin detail tabs";
    }
  }

  // ---------------------------------------------------------------------------
  // Derived: cost summary from linked runs
  // ---------------------------------------------------------------------------
  let costSummary = $derived.by(() => {
    let input = 0, output = 0, cached = 0, cost = 0;
    let hasCost = false, hasTokens = false;
    for (const run of runs) {
      const usage = run.usageJson;
      if (!usage) continue;
      const ri = Number(usage.inputTokens ?? usage.input_tokens ?? 0);
      const ro = Number(usage.outputTokens ?? usage.output_tokens ?? 0);
      const rc = Number(usage.cachedInputTokens ?? usage.cached_input_tokens ?? usage.cache_read_input_tokens ?? 0);
      const result = run.resultJson;
      const runCost = Number(result?.cost_usd ?? usage.cost_usd ?? 0);
      if (runCost > 0) hasCost = true;
      if (ri + ro + rc > 0) hasTokens = true;
      input += ri; output += ro; cached += rc; cost += runCost;
    }
    return { input, output, cached, cost, totalTokens: input + output, hasCost, hasTokens };
  });

  function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  }

  async function submitComment(
    body: string,
    options?: { reopen?: boolean; interrupt?: boolean },
  ) {
    if (!issueId || !body.trim()) return;
    const res = await api(`/api/issues/${issueId}/comments`, {
      method: "POST",
      body: JSON.stringify({
        body: body.trim(),
        ...(options?.reopen === undefined ? {} : { reopen: options.reopen }),
        ...(options?.interrupt === undefined ? {} : { interrupt: options.interrupt }),
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    toastStore.push({ title: "Comment added", tone: "success" });
    await loadComments();
  }

  async function deleteComment(commentId: string) {
    const res = await api(`/api/comments/${commentId}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
    toastStore.push({ title: "Comment deleted", tone: "success" });
    await loadComments();
  }

  // ---------------------------------------------------------------------------
  // InlineEditor title save
  // ---------------------------------------------------------------------------
  async function saveTitle(newTitle: string) {
    if (!issueId) return;
    const res = await api(`/api/issues/${issueId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: newTitle }),
    });
    if (!res.ok) throw new Error(await res.text());
    if (issue) {
      issue = { ...issue, title: newTitle };
      breadcrumbStore.set([
        { label: "Issues", href: `/${prefix}/issues` },
        { label: issue.identifier ?? newTitle },
      ]);
    }
  }

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------
  function startEdit() {
    if (!issue) return;
    const parsed = parseStructuredSddDescription(issue.description ?? issue.descriptionDocument?.content ?? "");
    const hasParsedStructuredSections =
      Boolean(parsed.spec || parsed.design || parsed.risk || parsed.rollout || parsed.rollback || parsed.validation);
    editTitle = issue.title;
    editStatus = issue.status;
    editPriority = issue.priority ?? "";
    editAssigneeAgentId = issue.assigneeAgentId ?? "";
    editLabelIds = issue.labels?.map((label) => label.id) ?? [];
    editDescription = parsed.summary || (!hasParsedStructuredSections ? issue.description || "" : "");
    editSddSpec = parsed.spec;
    editSddDesign = parsed.design;
    editSddRisk = parsed.risk;
    editSddRollout = parsed.rollout;
    editSddRollback = parsed.rollback;
    editSddValidation = parsed.validation;
    editing = true;
  }

  function cancelEdit() {
    editing = false;
  }

  async function saveEdit() {
    if (!issue || !issueId) return;
    savingEdit = true;
    try {
      const structuredSddInput = {
        spec: editSddSpec.trim(),
        design: editSddDesign.trim(),
        risk: editSddRisk.trim(),
        rollout: editSddRollout.trim(),
        rollback: editSddRollback.trim(),
        validation: editSddValidation.trim(),
      };
      const hasStructuredDraft = Object.values(structuredSddInput).some((value) => value.length > 0);
      if (hasStructuredDraft) {
        const sddIssues = validateStructuredSddInput(structuredSddInput);
        if (sddIssues.length > 0) {
          throw new Error(sddIssues.join(" "));
        }
      }
      const body: Record<string, unknown> = {};
      if (editTitle !== issue.title) body.title = editTitle;
      if (editStatus !== issue.status) body.status = editStatus;
      if (editPriority !== (issue.priority ?? "")) body.priority = editPriority || null;
      if (editAssigneeAgentId !== (issue.assigneeAgentId ?? "")) body.assigneeAgentId = editAssigneeAgentId || null;
      const currentLabelIds = issue.labels?.map((label) => label.id) ?? [];
      const nextLabelIds = [...new Set(editLabelIds)];
      const labelsChanged =
        nextLabelIds.length !== currentLabelIds.length ||
        nextLabelIds.some((id) => !currentLabelIds.includes(id)) ||
        currentLabelIds.some((id) => !nextLabelIds.includes(id));
      if (labelsChanged) body.labelIds = nextLabelIds;
      if (hasStructuredDraft) {
        body.description = composeStructuredSddDescription({
          subjectLabel: `Issue: ${issue.identifier ?? issue.title}`,
          summary: editDescription.trim() || null,
          ...structuredSddInput,
        });
      } else if (editDescription.trim() !== (issue.description ?? "").trim()) {
        body.description = editDescription.trim() || null;
      }

      if (Object.keys(body).length === 0) {
        editing = false;
        return;
      }

      const res = await api(`/api/issues/${issueId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Issue updated", tone: "success" });
      editing = false;
      await loadIssue();
    } catch (err: any) {
      toastStore.push({ title: "Failed to update issue", body: err?.message, tone: "error" });
    } finally {
      savingEdit = false;
    }
  }

  async function checkoutIssue() {
    if (!issueId) return;
    const agentId = issue?.assigneeAgentId?.trim() ?? "";
    if (!agentId) {
      toastStore.push({
        title: "Select an assignee first",
        body: "Checkout requires an assigned agent so the backend can claim the issue on behalf of that agent.",
        tone: "error",
      });
      return;
    }
    checkingOut = true;
    try {
      const res = await api(`/api/issues/${issueId}/checkout`, {
        method: "POST",
        body: JSON.stringify({
          agentId,
          expectedStatuses: ["todo", "backlog", "blocked"],
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Issue checked out", tone: "success" });
      await loadIssue();
    } catch (err: any) {
      toastStore.push({ title: "Failed to checkout issue", body: err?.message, tone: "error" });
    } finally {
      checkingOut = false;
    }
  }

  async function releaseIssue() {
    if (!issueId) return;
    checkingOut = true;
    try {
      const res = await api(`/api/issues/${issueId}/release`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Issue released", tone: "success" });
      await loadIssue();
    } catch (err: any) {
      toastStore.push({ title: "Failed to release issue", body: err?.message, tone: "error" });
    } finally {
      checkingOut = false;
    }
  }

  async function markRead() {
    if (!issueId) return;
    markingRead = true;
    try {
      const res = await api(`/api/issues/${issueId}/read`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Marked as read", tone: "success" });
    } catch (err: any) {
      toastStore.push({ title: "Failed to mark as read", body: err?.message, tone: "error" });
    } finally {
      markingRead = false;
    }
  }

  async function deleteIssue() {
    if (!issueId) return;
    deleting = true;
    try {
      const res = await api(`/api/issues/${issueId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Issue deleted", tone: "success" });
      goto(`/${$page.params.companyPrefix}/issues`);
    } catch (err: any) {
      toastStore.push({ title: "Failed to delete issue", body: err?.message, tone: "error" });
    } finally {
      deleting = false;
      showDeleteConfirm = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Sub-issue handlers
  // ---------------------------------------------------------------------------
  async function createSubIssue() {
    if (!issueId || !companyId || !newSubIssueTitle.trim()) return;
    submittingSubIssue = true;
    try {
      const parentTitle = issue?.title ?? "parent issue";
      const subIssueSpec = `Resolve the sub-task "${newSubIssueTitle.trim()}" under ${parentTitle} with a single execution owner.`;
      const subIssueDesign = `Keep the work scoped to the parent issue, with minimal coordination and a clean review path for the owner.`;
      const subIssueRisk = `The main risk is leaking scope outside ${parentTitle}, so keep the work narrow and verify dependencies early.`;
      const subIssueRollout = `Roll out the sub-task as one controlled slice, confirm the first checkpoint, and stop if the parent context shifts.`;
      const subIssueRollback = `If the sub-task becomes unsafe, revert the work, preserve the parent state, and reopen the issue for review.`;
      const subIssueValidation = "Confirm the sub-task satisfies the parent issue's acceptance criteria before closing.";
      const res = await api(`/api/companies/${companyId}/issues`, {
        method: "POST",
        body: JSON.stringify({
          title: newSubIssueTitle.trim(),
          parentId: issueId,
          sddSpec: subIssueSpec,
          sddDesign: subIssueDesign,
          sddRisk: subIssueRisk,
          sddRollout: subIssueRollout,
          sddRollback: subIssueRollback,
          sddValidation: subIssueValidation,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Sub-issue created", tone: "success" });
      newSubIssueTitle = "";
      showSubIssueForm = false;
      await loadSubIssues();
    } catch (err: any) {
      toastStore.push({ title: "Failed to create sub-issue", body: err?.message, tone: "error" });
    } finally {
      submittingSubIssue = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Work Product handlers
  // ---------------------------------------------------------------------------
  function resetWpForm() {
    wpTitle = "";
    wpKind = WP_KINDS[0];
    wpUrl = "";
    wpStatus = WP_STATUSES[0];
    showWpForm = false;
  }

  async function submitWorkProduct() {
    if (!issueId || !wpTitle.trim()) return;
    submittingWp = true;
    try {
      const body: Record<string, unknown> = {
        title: wpTitle.trim(),
        kind: wpKind,
        status: wpStatus,
      };
      if (wpUrl.trim()) body.url = wpUrl.trim();

      const res = await api(`/api/issues/${issueId}/work-products`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Work product added", tone: "success" });
      resetWpForm();
      await loadIssue();
    } catch (err: any) {
      toastStore.push({ title: "Failed to add work product", body: err?.message, tone: "error" });
    } finally {
      submittingWp = false;
    }
  }

  function startEditWp(wp: WorkProduct) {
    editingWpId = wp.id;
    editWpTitle = wp.title ?? "";
    editWpKind = wp.kind ?? WP_KINDS[0];
    editWpUrl = wp.url ?? "";
    editWpStatus = wp.status ?? WP_STATUSES[0];
  }

  function cancelEditWp() {
    editingWpId = null;
  }

  async function saveEditWp() {
    if (!editingWpId || !issueId) return;
    savingWpEdit = true;
    try {
      const body: Record<string, unknown> = {
        title: editWpTitle.trim(),
        kind: editWpKind,
        status: editWpStatus,
      };
      if (editWpUrl.trim()) body.url = editWpUrl.trim();
      else body.url = null;

      const res = await api(`/api/work-products/${editingWpId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Work product updated", tone: "success" });
      editingWpId = null;
      await loadIssue();
    } catch (err: any) {
      toastStore.push({ title: "Failed to update work product", body: err?.message, tone: "error" });
    } finally {
      savingWpEdit = false;
    }
  }

  async function deleteWorkProduct(wpId: string) {
    if (!issueId) return;
    try {
      const res = await api(`/api/work-products/${wpId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Work product removed", tone: "success" });
      await loadIssue();
    } catch (err: any) {
      toastStore.push({ title: "Failed to delete work product", body: err?.message, tone: "error" });
    }
  }

  // ---------------------------------------------------------------------------
  // Attachment handlers
  // ---------------------------------------------------------------------------
  function triggerFileUpload() {
    fileInput?.click();
  }

  async function handleFileUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file || !issueId || !companyId) return;

    uploading = true;
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/companies/${companyId}/issues/${issueId}/attachments`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Attachment uploaded", tone: "success" });
      target.value = "";
      await loadAttachments();
    } catch (err: any) {
      toastStore.push({ title: "Failed to upload attachment", body: err?.message, tone: "error" });
    } finally {
      uploading = false;
    }
  }

  async function deleteAttachment(attachmentId: string) {
    try {
      const res = await api(`/api/attachments/${attachmentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Attachment deleted", tone: "success" });
      await loadAttachments();
    } catch (err: any) {
      toastStore.push({ title: "Failed to delete attachment", body: err?.message, tone: "error" });
    }
  }

  async function createDocument() {
    if (!issueId || !newDocKey.trim()) return;
    submittingDoc = true;
    try {
      const key = newDocKey.trim().toLowerCase();
      const res = await api(`/api/issues/${issueId}/documents/${encodeURIComponent(key)}`, {
        method: "PUT",
      body: JSON.stringify({
          title: newDocTitle.trim() || null,
          format: "markdown",
          body: newDocContent.trim(),
          changeSummary: "Created from issue page",
          baseRevisionId: null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Document created", tone: "success" });
      newDocKey = "";
      newDocTitle = "";
      newDocContent = "";
      showDocForm = false;
      await loadDocuments();
    } catch (err: any) {
      toastStore.push({ title: "Failed to create document", body: err?.message, tone: "error" });
    } finally {
      submittingDoc = false;
    }
  }

  function beginEditDocument(doc: IssueDocument) {
    editingDocKey = doc.key;
    editingDocContent = doc.content ?? doc.body ?? "";
    editingDocTitle = doc.title ?? "";
    editingDocSummary = "";
    foldedDocumentKeys = foldedDocumentKeys.filter((key) => key !== doc.key);
    showDocForm = false;
    newDocKey = "";
    newDocTitle = "";
    newDocContent = "";
    docRevisionKey = null;
    docRevisions = [];
  }

  function cancelEditDocument() {
    editingDocKey = null;
    editingDocContent = "";
    editingDocTitle = "";
    editingDocSummary = "";
  }

  async function saveDocument(doc: IssueDocument) {
    if (!issueId) return;
    savingDoc = true;
    try {
      const res = await api(`/api/issues/${issueId}/documents/${encodeURIComponent(doc.key)}`, {
        method: "PUT",
        body: JSON.stringify({
          title: editingDocTitle.trim() || null,
          format: doc.format ?? "markdown",
          body: editingDocContent.trim(),
          changeSummary: editingDocSummary.trim() || null,
          baseRevisionId: doc.latestRevisionId ?? null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Document saved", tone: "success" });
      editingDocKey = null;
      editingDocContent = "";
      editingDocTitle = "";
      editingDocSummary = "";
      await loadDocuments();
    } catch (err: any) {
      toastStore.push({ title: "Failed to save document", body: err?.message, tone: "error" });
    } finally {
      savingDoc = false;
    }
  }

  async function handleDocumentEditorBlur(event: FocusEvent, doc: IssueDocument) {
    const currentTarget = event.currentTarget as HTMLElement | null;
    if (currentTarget?.contains(event.relatedTarget as Node | null)) return;
    if (editingDocKey !== doc.key) return;
    await saveDocument(doc);
  }

  const ACTION_LABELS: Record<string, string> = {
    'issue.created': 'created the issue',
    'issue.updated': 'updated the issue',
    'issue.checked_out': 'checked out the issue',
    'issue.released': 'released the issue',
    'issue.comment_added': 'added a comment',
    'issue.attachment_added': 'added an attachment',
    'issue.attachment_removed': 'removed an attachment',
    'issue.document_created': 'created a document',
    'issue.document_updated': 'updated a document',
    'issue.document_deleted': 'deleted a document',
    'issue.deleted': 'deleted the issue',
    'agent.created': 'created an agent',
    'agent.updated': 'updated the agent',
    'agent.paused': 'paused the agent',
    'agent.resumed': 'resumed the agent',
    'agent.terminated': 'terminated the agent',
    'heartbeat.invoked': 'invoked a heartbeat',
    'heartbeat.cancelled': 'cancelled a heartbeat',
    'approval.created': 'requested approval',
    'approval.approved': 'approved',
    'approval.rejected': 'rejected',
  };

  function formatAction(action: string, details?: Record<string, unknown> | null): string {
    if (action === 'issue.updated' && details) {
      const prev = (details._previous ?? {}) as Record<string, unknown>;
      const parts: string[] = [];
      if (details.status !== undefined) {
        const from = prev.status;
        parts.push(from
          ? `changed status from ${String(from).replace(/_/g, ' ')} to ${String(details.status).replace(/_/g, ' ')}`
          : `changed status to ${String(details.status).replace(/_/g, ' ')}`);
      }
      if (details.priority !== undefined) {
        const from = prev.priority;
        parts.push(from
          ? `changed priority from ${from} to ${details.priority}`
          : `changed priority to ${details.priority}`);
      }
      if (details.assigneeAgentId !== undefined || details.assigneeUserId !== undefined) {
        parts.push(details.assigneeAgentId || details.assigneeUserId ? 'assigned the issue' : 'unassigned the issue');
      }
      if (details.title !== undefined) parts.push('updated the title');
      if (details.description !== undefined) parts.push('updated the description');
      if (parts.length > 0) return parts.join(', ');
    }
    if ((action === 'issue.document_created' || action === 'issue.document_updated' || action === 'issue.document_deleted') && details) {
      const key = typeof details.key === 'string' ? details.key : 'document';
      const title = typeof details.title === 'string' && details.title ? ` (${details.title})` : '';
      return `${ACTION_LABELS[action] ?? action} ${key}${title}`;
    }
    return ACTION_LABELS[action] ?? action.replace(/[._]/g, ' ');
  }

  function actorLabel(entry: ActivityEntry): string {
    if (entry.actorName) return entry.actorName;
    if (entry.actorType === 'system') return 'System';
    if (entry.actorType === 'user') return 'Board';
    if (entry.actor) return entry.actor;
    return 'Unknown';
  }

  function actorInitials(entry: ActivityEntry): string {
    const name = actorLabel(entry);
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  function formatFileSize(bytes?: number): string {
    if (bytes == null) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ---------------------------------------------------------------------------
  // Status dot color helper
  // ---------------------------------------------------------------------------
  function statusDotColor(status: string): string {
    const map: Record<string, string> = {
      backlog: "bg-zinc-400",
      todo: "bg-zinc-400",
      open: "bg-blue-500",
      in_progress: "bg-amber-500",
      in_review: "bg-purple-500",
      blocked: "bg-red-500",
      completed: "bg-green-500",
      done: "bg-green-500",
      closed: "bg-zinc-500",
      cancelled: "bg-zinc-500",
    };
    return map[status] ?? "bg-zinc-400";
  }

  // ---------------------------------------------------------------------------
  // Priority config for properties panel
  // ---------------------------------------------------------------------------
  function priorityConfig(p: string | null | undefined): { icon: string; color: string; label: string } {
    const map: Record<string, { icon: string; color: string; label: string }> = {
      critical: { icon: "triangle-alert", color: "text-red-500", label: "Critical" },
      urgent: { icon: "triangle-alert", color: "text-red-500", label: "Urgent" },
      high: { icon: "arrow-up", color: "text-orange-500", label: "High" },
      medium: { icon: "minus", color: "text-blue-500", label: "Medium" },
      low: { icon: "arrow-down", color: "text-zinc-400", label: "Low" },
    };
    return map[p ?? "medium"] ?? { icon: "minus", color: "text-zinc-400", label: p ?? "Medium" };
  }

  // ---------------------------------------------------------------------------
  // Date formatter for properties panel
  // ---------------------------------------------------------------------------
  function formatDate(d: string | Date | null | undefined): string {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  // ---------------------------------------------------------------------------
  // Agent name resolver
  // ---------------------------------------------------------------------------
  function agentName(agentId: string | null | undefined): string | null {
    if (!agentId) return null;
    return agentMap[agentId] ?? null;
  }

  function agentInitials(name: string): string {
    return name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  // ---------------------------------------------------------------------------
  // Parent issue display (from ancestors)
  // ---------------------------------------------------------------------------
  let parentAncestor = $derived(
    issue?.ancestors && issue.ancestors.length > 0 ? issue.ancestors[0] : null
  );

  // ---------------------------------------------------------------------------
  // Label color helper
  // ---------------------------------------------------------------------------
  function labelStyle(color?: string | null): string {
    if (!color) return '';
    const c = color.startsWith('#') ? color : `#${color}`;
    return `background-color: ${c}20; color: ${c}; border-color: ${c}40;`;
  }

  function toggleEditLabel(labelId: string) {
    editLabelIds = editLabelIds.includes(labelId)
      ? editLabelIds.filter((id) => id !== labelId)
      : [...editLabelIds, labelId];
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  $effect(() => {
    if (!issueId) return;

    issue = null;
    comments = [];
    documents = [];
    attachments = [];
    activityEntries = [];
    runs = [];
    linkedApprovals = [];
    showDocForm = false;
    newDocKey = "";
    newDocTitle = "";
    newDocContent = "";
    submittingDoc = false;
    editingDocKey = null;
    editingDocContent = "";
    editingDocTitle = "";
    editingDocSummary = "";
    savingDoc = false;
    docRevisionKey = null;
    docRevisions = [];
    docRevisionsLoading = false;
    documentsLoaded = false;
    foldedDocumentKeys = loadFoldedDocumentKeys(issueId);
    copiedDocumentKey = null;
    confirmDeleteDocumentKey = null;
    loading = true;
    notFound = false;

    void loadIssue();
    void loadComments();
    void loadDocuments();
    void loadAttachments();
    void loadActivity();
    void loadRuns();
    void loadApprovals();
  });

  $effect(() => {
    if (!issueId || !companyId) return;
    void loadAgents();
    void loadLabels();
    void loadSubIssues();
  });

  $effect(() => {
    if (!issueId || !documentsLoaded) return;
    const validKeys = new Set(documents.map((doc) => doc.key));
    const next = foldedDocumentKeys.filter((key) => validKeys.has(key));
    if (next.length !== foldedDocumentKeys.length) {
      foldedDocumentKeys = next;
    }
    saveFoldedDocumentKeys(issueId, next);
  });

  onMount(() => {
    void loadPluginDetailTabs();
  });

  onDestroy(() => {
    if (copiedDocumentTimer) {
      clearTimeout(copiedDocumentTimer);
    }
  });
</script>

<PageLayout title={issue?.title ?? 'Issue'} fullWidth>
{#if loading}
  <PageSkeleton lines={10} />
{:else if notFound}
  <EmptyState title="Issue not found" description="The issue you're looking for doesn't exist or you don't have access." icon="📋">
    <a href="/{$page.params.companyPrefix}/issues" class="text-sm text-primary hover:underline">Back to issues</a>
  </EmptyState>
{:else if issue}
  <div>
    <!-- Header -->
    <div class="flex items-start justify-between gap-4 mb-4">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-3 mb-1">
          {#if issue.identifier}
            <div class="inline-flex items-center gap-1.5 shrink-0">
              <span class="size-2.5 rounded-full {statusDotColor(issue.status)}"></span>
              <span class="text-sm font-mono text-muted-foreground">{issue.identifier}</span>
              <button
                class="p-0.5 rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Copy identifier"
                onclick={() => {
                  navigator.clipboard.writeText(issue?.identifier ?? '');
                  toastStore.push({ title: 'Copied identifier', tone: 'success' });
                }}
              >
                <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
            </div>
          {/if}
          <InlineEditor
            value={issue.title}
            onSave={saveTitle}
            tag="h1"
            class="text-xl font-semibold"
            placeholder="Issue title..."
          />
        </div>
        <!-- Ancestor breadcrumb -->
        {#if issue.ancestors && issue.ancestors.length > 0}
          <nav class="flex items-center gap-1 text-xs text-muted-foreground mt-1.5 overflow-x-auto">
            {#if issue.project}
              <a href="/{prefix}/projects/{issue.project.id}" class="inline-flex items-center gap-1 hover:text-primary transition-colors shrink-0">
                <span class="size-2 rounded-full bg-primary shrink-0"></span>
                {issue.project.name}
              </a>
              <ChevronRight class="size-3 text-muted-foreground/70 shrink-0" />
            {/if}
            {#each [...issue.ancestors].reverse() as ancestor}
              <a
                href="/{prefix}/issues/{ancestor.id}"
                class="inline-flex items-center gap-1 hover:text-primary transition-colors shrink-0 max-w-[200px] truncate"
                title={ancestor.title}
              >
                <span class="size-2 rounded-full {statusDotColor(ancestor.status)} shrink-0"></span>
                {ancestor.identifier ?? ancestor.title}
              </a>
              <ChevronRight class="size-3 text-muted-foreground/70 shrink-0" />
            {/each}
            <span class="text-foreground/80 font-medium shrink-0">{issue.identifier ?? issue.title}</span>
          </nav>
        {/if}
      </div>
      <div class="flex items-center gap-2 shrink-0 flex-wrap">
        <Button variant="outline" size="sm" onclick={startEdit} disabled={editing}>
          <Pencil class="size-3.5 mr-1" />
          Edit
        </Button>
        {#if isCheckedOut}
          <Button variant="outline" size="sm" onclick={releaseIssue} disabled={checkingOut}>
            <GitMerge class="size-3.5 mr-1" />
            {checkingOut ? "Releasing..." : "Release"}
          </Button>
        {:else}
          <Button variant="outline" size="sm" onclick={checkoutIssue} disabled={checkingOut || !issue?.assigneeAgentId}>
            <GitBranchPlus class="size-3.5 mr-1" />
            {checkingOut ? "Checking out..." : "Checkout"}
          </Button>
        {/if}
        <Button variant="outline" size="sm" onclick={markRead} disabled={markingRead}>
          <Eye class="size-3.5 mr-1" />
          {markingRead ? "Marking..." : "Mark Read"}
        </Button>
        {#if showDeleteConfirm}
          <Alert variant="destructive" class="flex items-center gap-1.5 py-1 px-2.5">
            <span class="text-xs">Delete this issue?</span>
            <Button variant="destructive" size="sm" onclick={deleteIssue} disabled={deleting}>
              {deleting ? "Deleting..." : "Confirm"}
            </Button>
            <Button variant="outline" size="sm" onclick={() => showDeleteConfirm = false}>
              Cancel
            </Button>
          </Alert>
        {:else}
          <Button variant="outline" size="sm" class="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/40" onclick={() => showDeleteConfirm = true}>
            <Trash2 class="size-3.5 mr-1" />
            Delete
          </Button>
        {/if}
        <Button variant="outline" size="sm" href="/{prefix}/issues">
          Back
        </Button>
        <Button
          variant="outline"
          size="sm"
          onclick={() => showPropertiesPanel = !showPropertiesPanel}
          title={showPropertiesPanel ? "Hide properties" : "Show properties"}
        >
          {#if showPropertiesPanel}
            <PanelRightClose class="size-3.5" />
          {:else}
            <PanelRightOpen class="size-3.5" />
          {/if}
        </Button>
      </div>
    </div>

    <!-- Live Run Widget -->
    {#if companyId}
      <LiveRunWidget {issueId} companyId={companyId} companyPrefix={prefix} />
    {/if}

    {#snippet fallback()}
      <div class="text-sm text-muted-foreground">No issue launchers installed.</div>
    {/snippet}

    <Card class="mt-4 mb-6 rounded-xl border-border/60 backdrop-blur-sm">
      <CardHeader>
        <CardTitle class="text-sm">Plugin launchers</CardTitle>
        <p class="text-xs text-muted-foreground">Contextual issue actions exposed by installed plugins.</p>
      </CardHeader>
      <CardContent>
        <PluginLauncherOutlet
          placementZones={["detailTab", "taskDetailView", "toolbarButton", "contextMenuItem", "commentContextMenuItem"]}
          context={{
            companyId,
            companyPrefix: prefix ?? null,
            projectId: issue.projectId ?? null,
            entityId: issue.id,
            entityType: "issue",
            parentEntityId: issue.parentId ?? null,
            userId: null,
          }}
          itemClassName="flex flex-wrap gap-2"
          fallback={fallback}
        />
      </CardContent>
    </Card>

    <!-- Inline Edit Form -->
    {#if editing}
      <Card class="mb-6">
        <CardContent class="pt-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Title</Label>
              <Input bind:value={editTitle} placeholder="Issue title" />
            </div>
            <div class="md:col-span-2">
              <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Overview</Label>
              <Textarea bind:value={editDescription} rows={3} class="min-h-[88px]" placeholder="High-level issue summary or fallback description." />
              <p class="mt-1 text-[11px] text-muted-foreground">
                When the structured fields below are filled, this overview becomes the `Overview` section in the composed issue description.
              </p>
            </div>
            <div>
              <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Status</Label>
              <select
                bind:value={editStatus}
                class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none dark:bg-input/30"
              >
                {#each ISSUE_STATUSES as s}
                  <option value={s}>{s.replace(/_/g, " ")}</option>
                {/each}
              </select>
            </div>
            <div>
              <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Priority</Label>
              <select
                bind:value={editPriority}
                class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none dark:bg-input/30"
              >
                <option value="">None</option>
                {#each ISSUE_PRIORITIES as p}
                  <option value={p}>{p}</option>
                {/each}
              </select>
            </div>
            <div>
              <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Assignee Agent</Label>
              <select
                bind:value={editAssigneeAgentId}
                class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none dark:bg-input/30"
              >
                <option value="">Unassigned</option>
                {#each agents as agent}
                  <option value={agent.id}>{agent.name}</option>
                {/each}
              </select>
            </div>
            <div class="md:col-span-2">
              <div class="flex items-center justify-between gap-3 mb-1.5">
                <Label class="text-xs font-medium text-muted-foreground block">Labels</Label>
                <span class="text-[11px] text-muted-foreground">{editLabelIds.length} selected</span>
              </div>
              {#if labels.length === 0}
                <p class="text-xs text-muted-foreground">No labels available.</p>
              {:else}
                <div class="flex flex-wrap gap-2">
                  {#each labels as label}
                    {@const selected = editLabelIds.includes(label.id)}
                    <button
                      type="button"
                      onclick={() => toggleEditLabel(label.id)}
                      class={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        selected
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-muted/50'
                      }`}
                    >
                      <span class="h-2 w-2 rounded-full" style={labelStyle(label.color)}></span>
                      {label.name}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
            <div class="md:col-span-2 rounded-lg border border-border/70 bg-muted/20 p-4 space-y-4">
              <div class="space-y-1">
                <p class="text-sm font-medium text-foreground">Structured delivery</p>
                <p class="text-xs text-muted-foreground">
                  Fill all six sections to preserve the delivery contract. Partial drafts are rejected to avoid corrupting the structured description.
                </p>
              </div>
              <div class="grid gap-3">
                <div>
                  <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Spec</Label>
                  <Textarea bind:value={editSddSpec} rows={3} class="min-h-[88px]" placeholder="What is being changed, why, and how success is judged." />
                </div>
                <div>
                  <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Design</Label>
                  <Textarea bind:value={editSddDesign} rows={3} class="min-h-[88px]" placeholder="Implementation shape, dependencies, and integration path." />
                </div>
                <div>
                  <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Risk</Label>
                  <Textarea bind:value={editSddRisk} rows={3} class="min-h-[88px]" placeholder="Failure modes, blast radius, and likely blockers." />
                </div>
                <div>
                  <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Rollout</Label>
                  <Textarea bind:value={editSddRollout} rows={3} class="min-h-[88px]" placeholder="How to ship this safely and in stages." />
                </div>
                <div>
                  <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Rollback</Label>
                  <Textarea bind:value={editSddRollback} rows={3} class="min-h-[88px]" placeholder="How to revert if a checkpoint fails." />
                </div>
                <div>
                  <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Validation</Label>
                  <Textarea bind:value={editSddValidation} rows={3} class="min-h-[88px]" placeholder="What must be verified before completion." />
                </div>
              </div>
            </div>
          </div>
          <Separator class="mt-4" />
          <div class="flex items-center gap-2 pt-3">
            <Button size="sm" onclick={saveEdit} disabled={savingEdit || !editTitle.trim()}>
              {savingEdit ? "Saving..." : "Save Changes"}
            </Button>
            <Button variant="outline" size="sm" onclick={cancelEdit}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    {/if}

    <!-- Main content + sidebar -->
    <div class="flex flex-col lg:flex-row gap-6">
      <!-- Main content area -->
      <div class="flex-1 min-w-0">
        <Tabs bind:value={activeTab}>
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="comments">Comments ({comments.length})</TabsTrigger>
            <TabsTrigger value="sub-issues">Sub-Issues ({subIssues.length})</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="work-products">Work Products</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            {#each pluginDetailTabs as tab (tab.id)}
              <TabsTrigger value={`plugin:${tab.pluginId}:${tab.id}`}>{tab.label}</TabsTrigger>
            {/each}
          </TabsList>

          <!-- ============================================================= -->
          <!-- Details Tab                                                    -->
          <!-- ============================================================= -->
          <TabsContent value="details">
            <div class="space-y-6 mt-4">
              <!-- Description -->
              <Card>
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardContent>
                  {#if issue.descriptionDocument?.content}
                    <MarkdownBody content={issue.descriptionDocument.content} />
                  {:else if issue.description}
                    <MarkdownBody content={issue.description} />
                  {:else}
                    <p class="text-sm text-muted-foreground italic">No description provided.</p>
                  {/if}
                </CardContent>
              </Card>

              <!-- Plan Document (if exists) -->
              {#if issue.planDocument?.content}
                <Card>
                  <CardHeader>
                    <CardTitle>Plan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MarkdownBody content={issue.planDocument.content} />
                  </CardContent>
                </Card>
              {/if}

              <!-- Attachments -->
              <Card>
                <CardHeader>
                  <div class="flex items-center justify-between w-full">
                    <CardTitle>Attachments</CardTitle>
                    <div>
                      <input
                        type="file"
                        class="hidden"
                        bind:this={fileInput}
                        onchange={handleFileUpload}
                      />
                      <Button variant="outline" size="sm" onclick={triggerFileUpload} disabled={uploading}>
                        <Upload class="size-3.5 mr-1" />
                        {uploading ? "Uploading..." : "Upload"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {#if attachments.length === 0}
                    <p class="text-sm text-muted-foreground italic">No attachments.</p>
                  {:else}
                    <Card class="overflow-hidden rounded-lg py-0 gap-0 divide-y divide-border">
                      {#each attachments as att}
                        <div class="flex items-center justify-between p-3 text-sm hover:bg-accent/50 transition-colors duration-150">
                          <div class="flex items-center gap-2 min-w-0">
                            <FileText class="size-4 text-muted-foreground/70 shrink-0" />
                            <div class="min-w-0">
                              <p class="font-medium truncate">{att.filename}</p>
                              {#if att.size != null}
                                <p class="text-xs text-muted-foreground mt-0.5">{formatFileSize(att.size)}</p>
                              {/if}
                            </div>
                          </div>
                          <div class="flex items-center gap-2 shrink-0">
                            <a
                              href="/api/attachments/{att.id}/content"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <Download class="size-3" />
                              Download
                            </a>
                            <Button variant="ghost" size="sm" class="h-7 px-2 text-red-600 hover:text-red-700 dark:text-red-400" onclick={() => deleteAttachment(att.id)}>
                              <Trash2 class="size-3" />
                            </Button>
                          </div>
                        </div>
                      {/each}
                    </Card>
                  {/if}
                </CardContent>
              </Card>

              <!-- Execution Workspace -->
              {#if (issue as any)?.executionWorkspace ?? (issue as any)?.workspace ?? ((issue as any)?.workspaces?.[0])}
                <IssueWorkspaceCard
                  workspace={(issue as any).executionWorkspace ?? (issue as any).workspace ?? (issue as any).workspaces[0]}
                  prefix={prefix ?? ''}
                />
              {/if}
            </div>
          </TabsContent>

          <!-- ============================================================= -->
          <!-- Comments Tab                                                   -->
          <!-- ============================================================= -->
          <TabsContent value="comments">
            <div class="mt-4">
              <CommentThread
                {comments}
                onSubmit={submitComment}
                onDelete={deleteComment}
                allowInterrupt={Boolean(issue?.executionRunId)}
                activeRunLabel={issue?.executionRunId ? issue.executionRunId.slice(0, 8) : null}
                pluginHostContext={issuePluginHostContext}
              />
            </div>
          </TabsContent>

          <!-- ============================================================= -->
          <!-- Sub-Issues Tab                                                 -->
          <!-- ============================================================= -->
          <TabsContent value="sub-issues">
            <div class="mt-4 space-y-4">
              <div class="flex justify-end">
                <Button variant="outline" size="sm" onclick={() => showSubIssueForm = !showSubIssueForm}>
                  {#if showSubIssueForm}
                    <X class="size-3.5 mr-1" />
                    Cancel
                  {:else}
                    <Plus class="size-3.5 mr-1" />
                    Create Sub-Issue
                  {/if}
                </Button>
              </div>

              {#if showSubIssueForm}
                <Card>
                  <CardContent class="pt-4">
                    <div class="space-y-3">
                      <div>
                        <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Title</Label>
                        <Input bind:value={newSubIssueTitle} placeholder="Sub-issue title..." />
                      </div>
                      <div class="flex items-center gap-2">
                        <Button size="sm" onclick={createSubIssue} disabled={submittingSubIssue || !newSubIssueTitle.trim()}>
                          {submittingSubIssue ? "Creating..." : "Create"}
                        </Button>
                        <Button variant="outline" size="sm" onclick={() => { showSubIssueForm = false; newSubIssueTitle = ''; }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              {/if}

              {#if subIssues.length === 0}
                <EmptyState title="No sub-issues" description="Break this issue into smaller tasks by creating sub-issues." icon="🧩" />
              {:else}
                <Card class="overflow-hidden rounded-lg py-0 gap-0 divide-y divide-border">
                  {#each subIssues as sub}
                    <a
                      href="/{prefix}/issues/{sub.id}"
                      class="flex items-center justify-between p-3 text-sm cursor-pointer hover:bg-accent/50 transition-colors duration-150"
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        {#if sub.identifier}
                          <span class="text-xs font-mono text-muted-foreground shrink-0">{sub.identifier}</span>
                        {/if}
                        <span class="truncate font-medium">{sub.title}</span>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        {#if sub.priority}
                          <PriorityIcon priority={sub.priority} />
                        {/if}
                        <StatusBadge status={sub.status} />
                      </div>
                    </a>
                  {/each}
                </Card>
              {/if}
            </div>
          </TabsContent>

          <!-- ============================================================= -->
          <!-- Activity Tab                                                   -->
          <!-- ============================================================= -->
          <TabsContent value="activity">
            <div class="mt-4 space-y-4">
              <!-- Cost Summary -->
              {#if runs.length > 0 && (costSummary.hasCost || costSummary.hasTokens)}
                <Card class="rounded-lg px-3 py-2 gap-1 border-border/60 backdrop-blur-sm">
                  <div class="text-sm font-medium text-muted-foreground">Cost Summary</div>
                  <div class="flex flex-wrap gap-3 text-xs tabular-nums text-muted-foreground">
                    {#if costSummary.hasCost}
                      <Badge variant="secondary" class="text-xs font-medium">${costSummary.cost.toFixed(4)}</Badge>
                    {/if}
                    {#if costSummary.hasTokens}
                      <span>
                        Tokens {formatTokens(costSummary.totalTokens)}{#if costSummary.cached > 0}
                          (in {formatTokens(costSummary.input)}, out {formatTokens(costSummary.output)}, cached {formatTokens(costSummary.cached)}){:else}
                          (in {formatTokens(costSummary.input)}, out {formatTokens(costSummary.output)}){/if}
                      </span>
                    {/if}
                  </div>
                </Card>
              {/if}

              <!-- Activity feed -->
              <Card>
                <CardHeader>
                  <CardTitle class="flex items-center gap-2">
                    <Activity class="size-4" />
                    Activity Feed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {#if activityEntries.length === 0}
                    <p class="text-sm text-muted-foreground italic">No activity recorded yet.</p>
                  {:else}
                    <div class="space-y-1.5">
                      {#each activityEntries as entry}
                        <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold uppercase">{actorInitials(entry)}</span>
                          <span class="font-medium text-foreground/80">{actorLabel(entry)}</span>
                          <span>{formatAction(entry.action, entry.details)}</span>
                          {#if entry.createdAt}
                            <TimeAgo date={entry.createdAt} class="ml-auto shrink-0" />
                          {/if}
                        </div>
                      {/each}
                    </div>
                  {/if}
                </CardContent>
              </Card>

              <!-- Run history -->
              <Card>
                <CardHeader>
                  <CardTitle class="flex items-center gap-2">
                    <ListTree class="size-4" />
                    Run History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {#if runs.length === 0}
                    <p class="text-sm text-muted-foreground italic">No runs recorded.</p>
                  {:else}
                    <Card class="overflow-hidden rounded-lg py-0 gap-0 divide-y divide-border">
                      {#each runs as run}
                        <a
                          href="/{prefix}/runs/{run.id}"
                          class="flex items-center justify-between p-3 text-sm cursor-pointer hover:bg-accent/50 transition-colors duration-150"
                        >
                          <div class="flex items-center gap-3 min-w-0">
                            <StatusBadge status={run.status} />
                            <span class="truncate">
                              {run.agentName ?? run.agentId?.slice(0, 8) ?? 'Unknown agent'}
                            </span>
                            {#if run.summary}
                              <span class="text-muted-foreground truncate">&mdash; {run.summary}</span>
                            {/if}
                          </div>
                          <div class="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                            {#if run.startedAt}
                              <TimeAgo date={run.startedAt} />
                            {/if}
                            <ExternalLink class="size-3" />
                          </div>
                        </a>
                      {/each}
                    </Card>
                  {/if}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <!-- ============================================================= -->
          <!-- Work Products Tab                                              -->
          <!-- ============================================================= -->
          <TabsContent value="work-products">
            <div class="mt-4 space-y-4">
              <!-- Add Work Product button -->
              <div class="flex justify-end">
                <Button variant="outline" size="sm" onclick={() => showWpForm = !showWpForm}>
                  {#if showWpForm}
                    <X class="size-3.5 mr-1" />
                    Cancel
                  {:else}
                    <Plus class="size-3.5 mr-1" />
                    Add Work Product
                  {/if}
                </Button>
              </div>

              <!-- Create Work Product form -->
              {#if showWpForm}
                <Card>
                  <CardContent class="pt-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div class="md:col-span-2">
                        <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Title</Label>
                        <Input bind:value={wpTitle} placeholder="Work product title" />
                      </div>
                      <div>
                        <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Kind</Label>
                        <select
                          bind:value={wpKind}
                          class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none dark:bg-input/30"
                        >
                          {#each WP_KINDS as k}
                            <option value={k}>{k.replace(/_/g, " ")}</option>
                          {/each}
                        </select>
                      </div>
                      <div>
                        <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Status</Label>
                        <select
                          bind:value={wpStatus}
                          class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none dark:bg-input/30"
                        >
                          {#each WP_STATUSES as s}
                            <option value={s}>{s.replace(/_/g, " ")}</option>
                          {/each}
                        </select>
                      </div>
                      <div class="md:col-span-2">
                        <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">URL (optional)</Label>
                        <Input bind:value={wpUrl} placeholder="https://..." />
                      </div>
                    </div>
                    <Separator class="mt-4" />
                    <div class="flex items-center gap-2 pt-3">
                      <Button size="sm" onclick={submitWorkProduct} disabled={submittingWp || !wpTitle.trim()}>
                        {submittingWp ? "Adding..." : "Add Work Product"}
                      </Button>
                      <Button variant="outline" size="sm" onclick={resetWpForm}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              {/if}

              <!-- Work products list -->
              {#if !issue.workProducts || issue.workProducts.length === 0}
                <EmptyState title="No work products" description="No work products have been attached to this issue yet." icon="📦" />
              {:else}
                <Card class="overflow-hidden rounded-lg py-0 gap-0 divide-y divide-border">
                  {#each issue.workProducts as wp}
                    {#if editingWpId === wp.id}
                      <!-- Inline edit row -->
                      <div class="p-3 space-y-3 bg-accent/30">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div class="md:col-span-2">
                            <Input bind:value={editWpTitle} placeholder="Title" class="text-sm" />
                          </div>
                          <select
                            bind:value={editWpKind}
                            class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none dark:bg-input/30"
                          >
                            {#each WP_KINDS as k}
                              <option value={k}>{k.replace(/_/g, " ")}</option>
                            {/each}
                          </select>
                          <select
                            bind:value={editWpStatus}
                            class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none dark:bg-input/30"
                          >
                            {#each WP_STATUSES as s}
                              <option value={s}>{s.replace(/_/g, " ")}</option>
                            {/each}
                          </select>
                          <div class="md:col-span-2">
                            <Input bind:value={editWpUrl} placeholder="URL (optional)" class="text-sm" />
                          </div>
                        </div>
                        <div class="flex items-center gap-2">
                          <Button size="sm" onclick={saveEditWp} disabled={savingWpEdit || !editWpTitle.trim()}>
                            {savingWpEdit ? "Saving..." : "Save"}
                          </Button>
                          <Button variant="outline" size="sm" onclick={cancelEditWp}>Cancel</Button>
                        </div>
                      </div>
                    {:else}
                      <!-- Display row -->
                      <div class="flex items-center justify-between p-3 text-sm hover:bg-accent/50 transition-colors duration-150">
                        <div class="min-w-0">
                          <p class="font-medium truncate">{wp.title ?? "Untitled"}</p>
                          {#if wp.kind}
                            <p class="text-xs text-muted-foreground mt-0.5">{wp.kind.replace(/_/g, " ")}</p>
                          {/if}
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                          {#if wp.status}
                            <StatusBadge status={wp.status} />
                          {/if}
                          {#if wp.url}
                            <a href={wp.url} target="_blank" rel="noopener noreferrer" class="text-xs text-primary hover:underline inline-flex items-center gap-1">
                              <ExternalLink class="size-3" />
                              Open
                            </a>
                          {/if}
                          <Button variant="ghost" size="sm" class="h-7 px-2" onclick={() => startEditWp(wp)}>
                            <Pencil class="size-3" />
                          </Button>
                          <Button variant="ghost" size="sm" class="h-7 px-2 text-red-600 hover:text-red-700 dark:text-red-400" onclick={() => deleteWorkProduct(wp.id)}>
                            <Trash2 class="size-3" />
                          </Button>
                        </div>
                      </div>
                    {/if}
                  {/each}
                </Card>
              {/if}
            </div>
          </TabsContent>

          <!-- ============================================================= -->
          <!-- Documents Tab                                                  -->
          <!-- ============================================================= -->
          <TabsContent value="documents">
            <div class="mt-4 space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="space-y-1">
                  <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Document workspace</p>
                  <p class="text-sm text-muted-foreground">Work on issue-scoped documents here or jump to the company library for cross-issue browsing.</p>
                </div>
                <div class="flex items-center gap-2">
                  <Button variant="outline" size="sm" href="/{prefix}/documents">
                    <BookOpen class="size-3.5 mr-1" />
                    Company documents
                  </Button>
                  <Button variant="outline" size="sm" onclick={() => showDocForm = !showDocForm}>
                  {#if showDocForm}
                    <X class="size-3.5 mr-1" />
                    Cancel
                  {:else}
                    <FileText class="size-3.5 mr-1" />
                    New Document
                  {/if}
                  </Button>
                </div>
              </div>

              {#if showDocForm}
                <Card>
                  <CardContent class="pt-4">
                    <div class="space-y-3">
                      <div>
                        <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Document Key</Label>
                        <Input bind:value={newDocKey} placeholder="e.g. notes, spec, requirements..." />
                      </div>
                      <div>
                        <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Title (optional)</Label>
                        <Input bind:value={newDocTitle} placeholder="Optional display title" />
                      </div>
                      <div>
                        <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Content (optional)</Label>
                        <Textarea bind:value={newDocContent} placeholder="Document content (Markdown supported)..." rows={4} />
                      </div>
                      <div class="flex items-center gap-2">
                        <Button size="sm" onclick={createDocument} disabled={submittingDoc || !newDocKey.trim()}>
                          {submittingDoc ? "Creating..." : "Create"}
                        </Button>
                        <Button variant="outline" size="sm" onclick={() => { showDocForm = false; newDocKey = ''; newDocTitle = ''; newDocContent = ''; }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              {/if}

              {#if documents.length === 0 && !showDocForm}
                <EmptyState title="No documents" description="No documents have been attached to this issue yet." icon="📄" />
              {:else if documents.length > 0}
                <div class="space-y-4">
                  {#each documents as doc}
                    <Card>
                      <CardHeader class="space-y-2">
                        <div class="flex items-start justify-between gap-3">
                          <div class="min-w-0">
                            <div class="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                class="shrink-0"
                                aria-label={foldedDocumentKeys.includes(doc.key) ? `Expand ${doc.key}` : `Collapse ${doc.key}`}
                                onclick={() => toggleDocumentFold(doc.key)}
                              >
                                {#if foldedDocumentKeys.includes(doc.key)}
                                  <ChevronRight class="size-3.5" />
                                {:else}
                                  <ChevronDown class="size-3.5" />
                                {/if}
                              </Button>
                              <CardTitle class="capitalize">{doc.key.replace(/_/g, " ")}</CardTitle>
                              {#if isPlanKey(doc.key)}
                                <Badge variant="outline" class="text-[10px] uppercase tracking-[0.14em]">Plan</Badge>
                              {/if}
                            </div>
                            {#if doc.title}
                              <p class="text-sm text-muted-foreground">{doc.title}</p>
                            {/if}
                          </div>
                          <div class="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              class={copiedDocumentKey === doc.key ? "text-foreground" : "text-muted-foreground"}
                              title={copiedDocumentKey === doc.key ? "Copied" : "Copy document"}
                              onclick={() => void copyDocumentBody(doc.key, doc.content ?? doc.body ?? "")}
                            >
                              {#if copiedDocumentKey === doc.key}
                                <Check class="size-3.5" />
                              {:else}
                                <Copy class="size-3.5" />
                              {/if}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              class="text-muted-foreground"
                              title="Download document"
                              onclick={() => downloadDocumentFile(doc.key, doc.content ?? doc.body ?? "")}
                            >
                              <Download class="size-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onclick={() => {
                                if (editingDocKey === doc.key) {
                                  cancelEditDocument();
                                } else {
                                  beginEditDocument(doc);
                                }
                              }}
                            >
                              {#if editingDocKey === doc.key}
                                <X class="size-3.5 mr-1" />
                                Cancel edit
                              {:else}
                                <Pencil class="size-3.5 mr-1" />
                                Edit
                              {/if}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onclick={async () => {
                                if (docRevisionKey === doc.key) {
                                  docRevisionKey = null;
                                  docRevisions = [];
                                } else {
                                  await loadDocumentRevisions(doc.key);
                                }
                              }}
                            >
                              <HistoryIcon class="size-3.5 mr-1" />
                              {docRevisionKey === doc.key ? "Hide revisions" : "Revisions"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              class="text-muted-foreground"
                              title="Delete document"
                              onclick={() => { confirmDeleteDocumentKey = doc.key; }}
                            >
                              <Trash2 class="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {#if foldedDocumentKeys.includes(doc.key)}
                          <p class="text-sm text-muted-foreground">Document folded. Expand to view or edit.</p>
                        {:else if editingDocKey === doc.key}
                          <div class="space-y-3" onblurcapture={(event) => void handleDocumentEditorBlur(event, doc)}>
                            <div>
                              <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Title</Label>
                              <Input bind:value={editingDocTitle} placeholder="Optional title" />
                            </div>
                            <div>
                              <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Content</Label>
                              <Textarea bind:value={editingDocContent} placeholder="Markdown content..." rows={6} />
                            </div>
                            <div>
                              <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Change summary</Label>
                              <Input bind:value={editingDocSummary} placeholder="Describe the change" />
                            </div>
                            <div class="flex items-center gap-2">
                              <Button size="sm" onclick={() => saveDocument(doc)} disabled={savingDoc || !editingDocContent.trim()}>
                                {savingDoc ? "Saving..." : "Save"}
                              </Button>
                              <Button variant="outline" size="sm" onclick={cancelEditDocument} disabled={savingDoc}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        {:else if doc.content || doc.body}
                          <MarkdownBody content={doc.content ?? doc.body ?? ""} />
                        {:else}
                          <p class="text-sm text-muted-foreground italic">No content.</p>
                        {/if}
                        {#if doc.updatedAt}
                          <div class="mt-3 pt-2 border-t border-border">
                            <TimeAgo date={doc.updatedAt} class="text-xs" />
                          </div>
                        {/if}
                        {#if docRevisionKey === doc.key}
                          <div class="mt-4 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                            <div class="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Revisions</div>
                            {#if docRevisionsLoading}
                              <p class="text-sm text-muted-foreground">Loading revisions...</p>
                            {:else if docRevisions.length === 0}
                              <p class="text-sm text-muted-foreground">No revisions found.</p>
                            {:else}
                              <div class="space-y-2">
                                {#each docRevisions as revision}
                                  <div class="rounded-md border border-border bg-background p-3 text-sm">
                                    <div class="flex items-center justify-between gap-2">
                                      <span class="font-medium">Revision {revision.revisionNumber}</span>
                                      <TimeAgo date={revision.createdAt} class="text-xs text-muted-foreground" />
                                    </div>
                                    {#if revision.changeSummary}
                                      <p class="mt-1 text-xs text-muted-foreground">{revision.changeSummary}</p>
                                    {/if}
                                  </div>
                                {/each}
                              </div>
                            {/if}
                          </div>
                        {/if}
                        {#if confirmDeleteDocumentKey === doc.key}
                          <div class="mt-4 flex items-center justify-between gap-3 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3">
                            <p class="text-sm text-destructive font-medium">
                              Delete this document? This cannot be undone.
                            </p>
                            <div class="flex items-center gap-2 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onclick={() => { confirmDeleteDocumentKey = null; }}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onclick={() => void deleteDocument(doc.key)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        {/if}
                      </CardContent>
                    </Card>
                  {/each}
                </div>
              {/if}
            </div>
          </TabsContent>

          {#each pluginDetailTabs as tab (tab.id)}
            <TabsContent value={`plugin:${tab.pluginId}:${tab.id}`}>
              <div class="mt-4 space-y-3">
                <div>
                  <p class="text-sm font-medium text-foreground">{tab.label}</p>
                  <p class="text-xs text-muted-foreground">Plugin-contributed issue detail tab.</p>
                </div>
                <PluginRenderer
                  pluginId={tab.pluginId}
                  view="detailTab"
                  context={issuePluginHostContext}
                  routePath={tab.routePath}
                />
              </div>
            </TabsContent>
          {/each}
        </Tabs>

        <!-- Linked Approvals (collapsible, shown when present) -->
        {#if linkedApprovals.length > 0}
          <Card class="mt-4 rounded-lg border-border/60 py-0 gap-0">
            <button
              type="button"
              onclick={() => approvalsOpen = !approvalsOpen}
              class="flex w-full items-center justify-between px-3 py-2 text-left cursor-pointer"
            >
              <span class="text-sm font-medium text-muted-foreground">
                Linked Approvals ({linkedApprovals.length})
              </span>
              <ChevronRight class="h-4 w-4 text-muted-foreground transition-transform duration-150 {approvalsOpen ? 'rotate-90' : ''}" />
            </button>
            {#if approvalsOpen}
              <Separator />
              <div class="divide-y divide-border">
                {#each linkedApprovals as approval}
                  <a
                    href="/{prefix}/approvals/{approval.id}"
                    class="flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors duration-150 hover:bg-accent/50"
                  >
                    <div class="flex items-center gap-2">
                      <StatusBadge status={approval.status} />
                      <span class="font-medium">{approval.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
                      <span class="font-mono text-muted-foreground">{approval.id.slice(0, 8)}</span>
                    </div>
                    {#if approval.createdAt}
                      <TimeAgo date={approval.createdAt} class="text-muted-foreground" />
                    {/if}
                  </a>
                {/each}
              </div>
            {/if}
          </Card>
        {/if}
      </div>

      <!-- Properties drawer panel -->
      {#if showPropertiesPanel}
        <aside class="w-full lg:w-80 shrink-0">
          <Card class="sticky top-4 rounded-lg border-border/60 backdrop-blur-sm gap-0 py-0">
            <!-- Panel header -->
            <CardHeader class="flex flex-row items-center justify-between px-4 py-3 border-b border-border">
              <CardTitle class="text-sm">Properties</CardTitle>
              <Button
                variant="ghost"
                size="icon-xs"
                onclick={() => showPropertiesPanel = false}
                title="Close properties panel"
                class="cursor-pointer"
              >
                <X class="size-4" />
              </Button>
            </CardHeader>

            <div class="p-4 space-y-0.5">
              <!-- Status -->
              <div class="flex items-center justify-between py-2 text-sm">
                <span class="text-muted-foreground">Status</span>
                <Badge variant="outline" class="gap-1.5 capitalize">
                  <span class="size-2 rounded-full {statusDotColor(issue.status)}"></span>
                  {issue.status.replace(/_/g, " ")}
                </Badge>
              </div>

              <!-- Priority -->
              <div class="flex items-center justify-between py-2 text-sm">
                <span class="text-muted-foreground">Priority</span>
                <Badge variant="outline" class="gap-1.5 capitalize">
                  <PriorityIcon priority={issue.priority} />
                  {priorityConfig(issue.priority).label}
                </Badge>
              </div>

              <!-- Labels -->
              <div class="flex items-start justify-between py-2 text-sm">
                <span class="text-muted-foreground pt-0.5">Labels</span>
                <div class="text-right">
                  {#if issue.labels && issue.labels.length > 0}
                    <div class="flex flex-wrap gap-1.5 justify-end">
                      {#each issue.labels as label}
                        <Badge variant="outline" class="gap-1 text-xs font-medium" style={labelStyle(label.color)}>
                          <Tag class="size-3" />
                          {label.name}
                        </Badge>
                      {/each}
                    </div>
                  {:else}
                    <span class="text-muted-foreground text-xs">No labels</span>
                  {/if}
                </div>
              </div>

              <!-- Assignee -->
              <div class="flex items-center justify-between py-2 text-sm">
                <span class="text-muted-foreground">Assignee</span>
                <div class="text-right">
                  {#if issue.assigneeAgentId}
                    {@const name = agentName(issue.assigneeAgentId)}
                    <a
                      href="/{prefix}/agents/{issue.assigneeAgentId}"
                      class="inline-flex items-center gap-2 text-foreground hover:text-primary transition-colors"
                    >
                      <span class="inline-flex items-center justify-center size-5 rounded-full bg-primary/15 text-[10px] font-bold text-primary shrink-0">
                        {agentInitials(name ?? "AG")}
                      </span>
                      <span class="text-sm">{name ?? issue.assigneeAgentId.slice(0, 8)}</span>
                      <ChevronRight class="size-3 text-muted-foreground/70" />
                    </a>
                  {:else if issue.assigneeUserId}
                    <span class="inline-flex items-center gap-2 text-foreground">
                      <User class="size-3.5 text-muted-foreground/70" />
                      <span class="text-sm">{issue.assigneeUserId.slice(0, 12)}</span>
                    </span>
                  {:else}
                    <span class="text-muted-foreground text-xs">Unassigned</span>
                  {/if}
                </div>
              </div>

              <!-- Project -->
              <div class="flex items-center justify-between py-2 text-sm">
                <span class="text-muted-foreground">Project</span>
                <div class="text-right">
                  {#if issue.project}
                    <a
                      href="/{prefix}/projects/{issue.project.id}"
                      class="inline-flex items-center gap-2 text-foreground hover:text-primary transition-colors"
                    >
                      <span class="size-2.5 rounded-full bg-primary shrink-0"></span>
                      <span class="text-sm">{issue.project.name}</span>
                      <ChevronRight class="size-3 text-muted-foreground/70" />
                    </a>
                  {:else}
                    <span class="text-muted-foreground text-xs">No project</span>
                  {/if}
                </div>
              </div>

              <!-- Goal -->
              {#if issue.goal}
                <div class="flex items-center justify-between py-2 text-sm">
                  <span class="text-muted-foreground">Goal</span>
                  <a
                    href="/{prefix}/goals/{issue.goal.id}"
                    class="inline-flex items-center gap-2 text-foreground hover:text-primary transition-colors"
                  >
                    <span class="text-sm truncate max-w-[160px]">{issue.goal.title}</span>
                    <ChevronRight class="size-3 text-muted-foreground/70" />
                  </a>
                </div>
              {/if}

              <!-- Parent issue -->
              <div class="flex items-center justify-between py-2 text-sm">
                <span class="text-muted-foreground">Parent</span>
                <div class="text-right">
                  {#if parentAncestor}
                    <a
                      href="/{prefix}/issues/{parentAncestor.id}"
                      class="text-sm text-foreground hover:text-primary transition-colors truncate max-w-[180px] block"
                      title={parentAncestor.title}
                    >
                      {parentAncestor.identifier ?? parentAncestor.title}
                    </a>
                  {:else if issue.parentId}
                    <a
                      href="/{prefix}/issues/{issue.parentId}"
                      class="text-sm text-foreground hover:text-primary transition-colors font-mono"
                    >
                      {issue.parentId.slice(0, 8)}...
                    </a>
                  {:else}
                    <span class="text-muted-foreground text-xs">No parent</span>
                  {/if}
                </div>
              </div>

              <!-- Separator before metadata -->
              <Separator class="my-2" />

              <!-- Created by -->
              <div class="flex items-center justify-between py-2 text-sm">
                <span class="text-muted-foreground">Created by</span>
                <div class="text-right">
                  {#if issue.createdByAgentId}
                    {@const name = agentName(issue.createdByAgentId)}
                    <a
                      href="/{prefix}/agents/{issue.createdByAgentId}"
                      class="inline-flex items-center gap-2 text-foreground hover:text-primary transition-colors"
                    >
                      <span class="inline-flex items-center justify-center size-5 rounded-full bg-muted text-[10px] font-bold text-muted-foreground shrink-0">
                        {agentInitials(name ?? "AG")}
                      </span>
                      <span class="text-sm">{name ?? issue.createdByAgentId.slice(0, 8)}</span>
                    </a>
                  {:else if issue.createdByUserId}
                    <span class="inline-flex items-center gap-2 text-foreground">
                      <User class="size-3.5 text-zinc-400" />
                      <span class="text-sm">{issue.createdByUserId.slice(0, 12)}</span>
                    </span>
                  {:else}
                    <span class="text-muted-foreground text-xs">System</span>
                  {/if}
                </div>
              </div>

              <!-- Started -->
              <div class="flex items-center justify-between py-2 text-sm">
                <span class="text-muted-foreground">Started</span>
                <span class="text-foreground text-sm">
                  {#if issue.startedAt}
                    {formatDate(issue.startedAt)}
                  {:else}
                    <span class="text-muted-foreground text-xs">Not started</span>
                  {/if}
                </span>
              </div>

              <!-- Created -->
              <div class="flex items-center justify-between py-2 text-sm">
                <span class="text-muted-foreground">Created</span>
                <span class="text-foreground text-sm">{formatDate(issue.createdAt)}</span>
              </div>

              <!-- Updated -->
              <div class="flex items-center justify-between py-2 text-sm">
                <span class="text-muted-foreground">Updated</span>
                <TimeAgo date={issue.updatedAt} class="text-sm" />
              </div>

              <!-- Separator before ID -->
              <Separator class="my-2" />

              <!-- ID -->
              <div class="flex items-center justify-between py-2 text-sm">
                <span class="text-muted-foreground">ID</span>
                <button
                  class="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer truncate max-w-[180px]"
                  title="Click to copy: {issue.id}"
                  onclick={() => {
                    navigator.clipboard.writeText(issue?.id ?? '');
                    toastStore.push({ title: 'Copied issue ID', tone: 'success' });
                  }}
                >
                  {issue.id.slice(0, 12)}...
                </button>
              </div>
            </div>
          </Card>
        </aside>
      {/if}
    </div>
  </div>
  <ScrollToBottom />
{/if}
</PageLayout>
